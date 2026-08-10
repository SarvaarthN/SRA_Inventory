export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Component, Order, OrderItem, Transaction, parseOrderItems } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

async function loadOrder(id: string): Promise<Order | null> {
  const order = await redis.hgetall<Order>(keys.order(id));
  if (!order) return null;
  return { ...order, items: parseOrderItems(order.items) };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const order = await loadOrder(decodeURIComponent(id));
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const orderId = decodeURIComponent(id);
    const { action, performedBy } = (await req.json()) as {
      action: "RECEIVE" | "CANCEL";
      performedBy: string;
    };

    const order = await loadOrder(orderId);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Both actions are only legal from ORDERED. This is what stops a double
    // click on Received from adding the stock twice.
    if (order.status !== "ORDERED") {
      return NextResponse.json(
        { error: `This order is already ${String(order.status).toLowerCase()}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === "CANCEL") {
      await redis.hset(keys.order(orderId), { status: "CANCELLED" });
      return NextResponse.json({ ...order, status: "CANCELLED" });
    }

    if (action !== "RECEIVE") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (!performedBy?.trim()) {
      return NextResponse.json({ error: "Who received this order?" }, { status: 400 });
    }

    const receiver = performedBy.trim();
    const reference = order.orderNumber ? `${order.vendor} #${order.orderNumber}` : order.vendor;
    const pipeline = redis.pipeline();
    // Items are written back with the component ids filled in, so the order
    // page can link to the parts it produced.
    const resolvedItems: OrderItem[] = [];

    for (const item of order.items) {
      const qty = Number(item.quantity);
      const existing = item.componentId
        ? await redis.hgetall<Component>(keys.component(item.componentId))
        : null;

      let componentId: string;
      let quantityAfter: number;

      if (existing) {
        // Top up a part we already stock.
        componentId = item.componentId;
        quantityAfter = Number(existing.quantity) + qty;
        const patch: Record<string, unknown> = { quantity: quantityAfter, updatedAt: now };
        // An order can also relocate a part to a different box.
        if (item.boxId && item.boxId !== existing.boxId) {
          patch.boxId = item.boxId;
          patch.boxName = item.boxName ?? "";
        }
        pipeline.hset(keys.component(componentId), patch);
      } else {
        // Either a brand-new component, or one that was deleted between
        // ordering and delivery. Create it the same way /api/components does.
        const category = item.category || "MISC";
        const year = new Date().getFullYear();
        const uniqueNum = await redis.incr(keys.counter(category, year));
        componentId = `${category}/${year}/${String(uniqueNum).padStart(3, "0")}`;
        quantityAfter = qty;

        const component: Component = {
          id: componentId,
          name: item.name,
          category,
          categoryLabel: item.categoryLabel || category,
          categoryColor: item.categoryColor || "",
          year,
          uniqueNum,
          quantity: qty,
          description: `Received from ${reference}`,
          boxId: item.boxId ?? "",
          boxName: item.boxName ?? "",
          addedBy: receiver,
          createdAt: now,
          updatedAt: now,
        };
        pipeline.hset(keys.component(componentId), component);
        pipeline.sadd(keys.componentsAll(), componentId);
        pipeline.sadd(keys.componentsByCategory(category), componentId);
      }

      const txId = `TX-${await redis.incr(keys.txCounter())}`;
      const tx: Transaction = {
        id: txId,
        componentId,
        componentName: item.name,
        type: "ORDER_RECEIVED",
        quantityChange: qty,
        quantityAfter,
        performedBy: receiver,
        notes: `Order ${order.id} received from ${reference}`,
        timestamp: now,
      };
      pipeline.hset(keys.transaction(txId), tx);
      pipeline.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
      pipeline.zadd(keys.transactionsByComponent(componentId), { score: Date.now(), member: txId });

      resolvedItems.push({ ...item, componentId });
    }

    pipeline.hset(keys.order(orderId), {
      status: "RECEIVED",
      receivedAt: now,
      receivedBy: receiver,
      items: JSON.stringify(resolvedItems),
    });
    await pipeline.exec();

    return NextResponse.json({
      ...order,
      status: "RECEIVED",
      receivedAt: now,
      receivedBy: receiver,
      items: resolvedItems,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const orderId = decodeURIComponent(id);
    const order = await loadOrder(orderId);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Received orders are part of the stock history, so they stay.
    if (order.status === "RECEIVED") {
      return NextResponse.json(
        { error: "Received orders can't be deleted, they're part of the stock history" },
        { status: 400 }
      );
    }

    const pipeline = redis.pipeline();
    pipeline.del(keys.order(orderId));
    pipeline.zrem(keys.ordersAll(), orderId);
    await pipeline.exec();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
