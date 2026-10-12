export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Component, Transaction } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const component = await redis.hgetall<Component>(keys.component(decodedId));
    if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(component);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const body = await req.json();
    const { action, quantity, performedBy, notes, boxId, boxName } = body as {
      action: "STOCK_IN" | "STOCK_OUT" | "UPDATE_BOX";
      quantity?: number;
      performedBy: string;
      notes?: string;
      boxId?: string;
      boxName?: string;
    };

    const component = await redis.hgetall<Component>(keys.component(decodedId));
    if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date().toISOString();
    const pipeline = redis.pipeline();

    if (action === "STOCK_IN" || action === "STOCK_OUT") {
      if (!quantity || !performedBy) {
        return NextResponse.json({ error: "Missing quantity or performer" }, { status: 400 });
      }
      const delta = action === "STOCK_IN" ? quantity : -quantity;
      const newQty = Number(component.quantity) + delta;
      if (newQty < 0) {
        return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
      }

      // Stocking something in may also relocate it: the "Add to Existing" form
      // offers a box picker, and choosing a different box there means "the new
      // stock is going here". Previously only UPDATE_BOX ever wrote the box, so
      // that choice was silently discarded and the component stayed put.
      //
      // An absent or empty boxId means "I did not pick one", never "unassign" —
      // clearing a box is UPDATE_BOX's job. Stocking OUT never relocates.
      const requestedBoxId = typeof boxId === "string" ? boxId.trim() : "";
      const movingBox =
        action === "STOCK_IN" &&
        requestedBoxId !== "" &&
        requestedBoxId !== String(component.boxId ?? "");

      pipeline.hset(keys.component(decodedId), {
        quantity: newQty,
        updatedAt: now,
        ...(movingBox ? { boxId: requestedBoxId, boxName: boxName ?? "" } : {}),
      });

      // Keep the move in the audit trail, without inventing a transaction type
      // that every History view would have to learn to render.
      const movedNote = movingBox ? `Moved to ${boxName?.trim() || requestedBoxId}` : "";
      const combinedNotes = [notes?.trim(), movedNote].filter(Boolean).join(" · ");

      const txId = `TX-${await redis.incr(keys.txCounter())}`;
      const tx: Transaction = {
        id: txId,
        componentId: decodedId,
        componentName: component.name,
        type: action,
        quantityChange: quantity,
        quantityAfter: newQty,
        performedBy,
        notes: combinedNotes,
        timestamp: now,
      };
      pipeline.hset(keys.transaction(txId), tx);
      pipeline.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
      pipeline.zadd(keys.transactionsByComponent(decodedId), { score: Date.now(), member: txId });
    } else if (action === "UPDATE_BOX") {
      pipeline.hset(keys.component(decodedId), {
        boxId: boxId ?? "",
        boxName: boxName ?? "",
        updatedAt: now,
      });
    }

    await pipeline.exec();
    const updated = await redis.hgetall<Component>(keys.component(decodedId));
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const { performedBy, hardDelete } = await req.json() as {
      performedBy: string;
      hardDelete: boolean;
    };

    const component = await redis.hgetall<Component>(keys.component(decodedId));
    if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date().toISOString();
    const pipeline = redis.pipeline();

    if (hardDelete) {
      pipeline.del(keys.component(decodedId));
      pipeline.srem(keys.componentsAll(), decodedId);
      pipeline.srem(keys.componentsByCategory(component.category), decodedId);
    } else {
      // Stock-out all remaining quantity
      pipeline.hset(keys.component(decodedId), { quantity: 0, updatedAt: now });
    }

    const txId = `TX-${await redis.incr(keys.txCounter())}`;
    const tx: Transaction = {
      id: txId,
      componentId: decodedId,
      componentName: component.name,
      type: "DELETED",
      quantityChange: Number(component.quantity),
      quantityAfter: 0,
      performedBy,
      notes: hardDelete
        ? "Component permanently removed from database"
        : `All stock (${component.quantity}) removed`,
      timestamp: now,
    };
    pipeline.hset(keys.transaction(txId), tx);
    pipeline.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
    pipeline.zadd(keys.transactionsByComponent(decodedId), { score: Date.now(), member: txId });

    await pipeline.exec();
    return NextResponse.json({ success: true, hardDelete });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
