export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import {
  Box,
  CategoryDef,
  Component,
  DEFAULT_CATEGORIES,
  InvoiceItem,
  InvoiceResultItem,
  Transaction,
} from "@/lib/types";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canWrite(session)) {
    return NextResponse.json({ error: "Only TY/LY members can add inventory" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    companyName?: string;
    location?: string;
    items?: InvoiceItem[];
  } | null;

  const companyName = body?.companyName?.trim();
  if (!companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const items = (body?.items ?? []).filter(
    (it) => it && typeof it.name === "string" && it.name.trim().length > 0
  );
  if (!items.length) {
    return NextResponse.json({ error: "No items to add" }, { status: 400 });
  }

  // Load categories so items can match club-defined categories, not just the defaults.
  const categoryIds = await redis.smembers(keys.categoriesAll());
  let categories: CategoryDef[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    isDefault: "true",
    createdAt: "",
  }));
  if (categoryIds.length) {
    const p = redis.pipeline();
    categoryIds.forEach((code) => p.hgetall(keys.category(code)));
    const res = await p.exec();
    const custom = res.map((r) => r as CategoryDef | null).filter(Boolean) as CategoryDef[];
    const map = new Map(categories.map((c) => [c.code, c]));
    custom.forEach((c) => map.set(c.code, c));
    categories = Array.from(map.values());
  }

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10); // YYYY-MM-DD, computed server-side
  const boxName = `${companyName}_${dateStamp}`;

  const results: InvoiceResultItem[] = [];

  // Every invoice gets its own box, so a delivery stays identifiable and never
  // gets mixed into general storage — see INVENTORY_GUIDE.md's cleaning protocol.
  const boxNum = await redis.incr(keys.boxCounter());
  const boxId = `BOX-${String(boxNum).padStart(3, "0")}`;
  const box: Box = {
    id: boxId,
    name: boxName,
    location: body?.location?.trim() || "Unknown",
    createdBy: session.name,
    createdAt: now.toISOString(),
    boxType: "GENERAL",
  };
  const boxPipeline = redis.pipeline();
  boxPipeline.hset(keys.box(boxId), box);
  boxPipeline.sadd(keys.boxesAll(), boxId);
  await boxPipeline.exec();
  results.push({
    type: "box",
    message: `Box "${boxName}" created`,
    sub: `${boxId} · ${box.location}`,
    id: boxId,
  });

  for (const item of items) {
    try {
      const requestedCode = String(item.category ?? "").trim().toUpperCase();
      const catMatch =
        categories.find((c) => c.code === requestedCode) ??
        categories.find((c) => c.code === "MISC") ??
        categories[0];

      const year = now.getFullYear();
      const seqNum = await redis.incr(keys.counter(catMatch.code, year));
      const id = `${catMatch.code}/${year}/${String(seqNum).padStart(3, "0")}`;
      const componentNow = new Date().toISOString();
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const name = item.name.trim();

      const component: Component = {
        id,
        name,
        category: catMatch.code,
        categoryLabel: catMatch.label,
        categoryColor: catMatch.color,
        year,
        uniqueNum: seqNum,
        quantity,
        description: item.description?.trim() ?? "",
        boxId,
        boxName,
        addedBy: session.name,
        createdAt: componentNow,
        updatedAt: componentNow,
      };

      const txId = `TX-${await redis.incr(keys.txCounter())}`;
      const tx: Transaction = {
        id: txId,
        componentId: id,
        componentName: name,
        type: "CREATED",
        quantityChange: quantity,
        quantityAfter: quantity,
        performedBy: session.name,
        notes: `Added from invoice, box ${boxName}`,
        timestamp: componentNow,
      };

      const p = redis.pipeline();
      p.hset(keys.component(id), component);
      p.sadd(keys.componentsAll(), id);
      p.sadd(keys.componentsByCategory(catMatch.code), id);
      p.hset(keys.transaction(txId), tx);
      p.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
      p.zadd(keys.transactionsByComponent(id), { score: Date.now(), member: txId });
      await p.exec();

      results.push({
        type: "component_new",
        message: `"${name}" created`,
        sub: `${id} · ${quantity} units`,
        id,
      });
    } catch (e) {
      results.push({
        type: "error",
        message: `Failed to add "${item.name}"`,
        sub: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ boxId, boxName, results });
}
