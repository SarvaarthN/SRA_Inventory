export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Order, OrderItem, parseOrderItems } from "@/lib/types";

// Orders are held in a sorted set scored by expected delivery date, so the
// "what's arriving when" list is a single zrange instead of a sort in JS.
function scoreFor(expectedAt: string, orderedAt: string): number {
  const expected = new Date(expectedAt).getTime();
  if (!Number.isNaN(expected)) return expected;
  const ordered = new Date(orderedAt).getTime();
  return Number.isNaN(ordered) ? Date.now() : ordered;
}

export async function GET() {
  try {
    const ids = await redis.zrange<string[]>(keys.ordersAll(), 0, -1);
    if (!ids.length) return NextResponse.json([]);

    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(keys.order(id)));
    const results = await pipeline.exec();

    const orders = (results.map((r) => r as Order | null).filter(Boolean) as Order[]).map(
      (o) => ({ ...o, items: parseOrderItems(o.items) })
    );
    return NextResponse.json(orders);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      vendor, vendorUrl, orderNumber, orderedAt, expectedAt,
      totalCost, notes, orderedBy, items,
    } = body as {
      vendor: string;
      vendorUrl?: string;
      orderNumber?: string;
      orderedAt?: string;
      expectedAt?: string;
      totalCost?: string;
      notes?: string;
      orderedBy: string;
      items: OrderItem[];
    };

    if (!vendor?.trim() || !orderedBy?.trim()) {
      return NextResponse.json({ error: "Vendor and your name are required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Add at least one item to the order" }, { status: 400 });
    }

    // Normalise up front so receive doesn't have to cope with junk later.
    const cleanItems: OrderItem[] = [];
    for (const item of items) {
      if (!item?.name?.trim()) {
        return NextResponse.json({ error: "Every item needs a name" }, { status: 400 });
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          { error: `Quantity for "${item.name}" must be greater than 0` },
          { status: 400 }
        );
      }
      // A brand-new component needs a category to build its part number from.
      if (!item.componentId && !item.category?.trim()) {
        return NextResponse.json(
          { error: `Pick a category for the new component "${item.name}"` },
          { status: 400 }
        );
      }
      cleanItems.push({
        componentId: item.componentId?.trim() ?? "",
        name: item.name.trim(),
        category: item.category?.trim() ?? "",
        categoryLabel: item.categoryLabel ?? "",
        categoryColor: item.categoryColor ?? "",
        quantity: qty,
        boxId: item.boxId ?? "",
        boxName: item.boxName ?? "",
      });
    }

    const num = await redis.incr(keys.orderCounter());
    const id = `ORD-${String(num).padStart(3, "0")}`;
    const now = new Date().toISOString();
    const ordered = orderedAt || now;

    const order: Order = {
      id,
      vendor: vendor.trim(),
      vendorUrl: vendorUrl?.trim() ?? "",
      orderNumber: orderNumber?.trim() ?? "",
      status: "ORDERED",
      orderedAt: ordered,
      expectedAt: expectedAt ?? "",
      receivedAt: "",
      orderedBy: orderedBy.trim(),
      receivedBy: "",
      totalCost: totalCost?.trim() ?? "",
      notes: notes?.trim() ?? "",
      items: cleanItems,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(keys.order(id), { ...order, items: JSON.stringify(cleanItems) });
    pipeline.zadd(keys.ordersAll(), {
      score: scoreFor(order.expectedAt, ordered),
      member: id,
    });
    await pipeline.exec();

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
