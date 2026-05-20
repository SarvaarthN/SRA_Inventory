export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys, queueSheetUpdate } from "@/lib/redis";
import { Component, Transaction } from "@/lib/types";

export async function GET() {
  try {
    const ids = await redis.smembers(keys.componentsAll());
    if (!ids.length) return NextResponse.json([]);

    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(keys.component(id)));
    const results = await pipeline.exec();

    const components = results
      .map((r) => r as Component | null)
      .filter(Boolean) as Component[];

    components.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(components);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch components" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, category, categoryLabel, categoryColor,
      description, quantity, boxId, boxName, addedBy, initialStock,
    } = body as {
      name: string;
      category: string;
      categoryLabel: string;
      categoryColor: string;
      description?: string;
      quantity: number;
      boxId?: string;
      boxName?: string;
      addedBy: string;
      initialStock?: number;
    };

    if (!name || !category || !addedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const counterKey = keys.counter(category, year);
    const uniqueNum = await redis.incr(counterKey);
    const id = `${category}/${year}/${String(uniqueNum).padStart(3, "0")}`;
    const now = new Date().toISOString();
    const qty = initialStock ?? quantity ?? 0;

    const component: Component = {
      id,
      name,
      category,
      categoryLabel: categoryLabel ?? category,
      categoryColor: categoryColor ?? "",
      year,
      uniqueNum,
      quantity: qty,
      description: description ?? "",
      boxId: boxId ?? "",
      boxName: boxName ?? "",
      addedBy,
      createdAt: now,
      updatedAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(keys.component(id), component);
    pipeline.sadd(keys.componentsAll(), id);
    pipeline.sadd(keys.componentsByCategory(category), id);

    const txId = `TX-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const tx: Transaction = {
      id: txId,
      componentId: id,
      componentName: name,
      type: "CREATED",
      quantityChange: qty,
      quantityAfter: qty,
      performedBy: addedBy,
      notes: `Component created with initial stock of ${qty}`,
      timestamp: now,
    };
    pipeline.hset(keys.transaction(txId), tx);
    pipeline.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
    pipeline.zadd(keys.transactionsByComponent(id), { score: Date.now(), member: txId });

    await pipeline.exec();

    // Sync in background to Google Sheets
    const sheetData = {
      "Part Number": component.id,
      "Name": component.name,
      "Category": component.category,
      "Quantity": Number(component.quantity),
      "Box ID": component.boxId,
      "Box Name": component.boxName,
      "Description": component.description,
      "Added By": component.addedBy,
      "Created At": component.createdAt,
    };
    queueSheetUpdate("Components", "CREATE", "Part Number", component.id, sheetData);

    const sheetTx = {
      id: tx.id,
      componentId: tx.componentId,
      componentName: tx.componentName,
      type: tx.type,
      quantityChange: Number(tx.quantityChange),
      quantityAfter: Number(tx.quantityAfter),
      performedBy: tx.performedBy,
      "notes`````": tx.notes,
      timestamp: tx.timestamp
    };
    queueSheetUpdate("Transactions", "CREATE", "id", tx.id, sheetTx);

    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create component" }, { status: 500 });
  }
}
