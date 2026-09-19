export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { redis, keys } from "@/lib/redis";
import { Box, Component, Transaction, DEFAULT_CATEGORIES, CategoryDef } from "@/lib/types";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";
import { lc } from "@/lib/utils";

type CreateBoxAction = {
  action: "create_box";
  name: string;
  location: string;
};
type CreateComponentAction = {
  action: "create_component";
  name: string;
  category: string;
  quantity: number;
  boxName: string;
  description?: string;
};
type AddStockAction = {
  action: "add_stock";
  componentId: string;
  quantity: number;
  notes?: string;
};
type GeminiAction = CreateBoxAction | CreateComponentAction | AddStockAction;

export type ResultItem = {
  type: "box" | "component_new" | "stock" | "error";
  message: string;
  sub?: string;
  id?: string;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canWrite(session)) {
    return NextResponse.json({ error: "Only TY/LY members can add inventory" }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const body = await req.json() as { message: string };
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  // Fetch context data
  const [boxIds, componentIds, categoryIds] = await Promise.all([
    redis.smembers(keys.boxesAll()),
    redis.smembers(keys.componentsAll()),
    redis.smembers(keys.categoriesAll()),
  ]);

  let boxes: Box[] = [];
  let components: Component[] = [];
  const categories: CategoryDef[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    isDefault: "true",
    createdAt: "",
  }));

  if (boxIds.length) {
    const p = redis.pipeline();
    boxIds.forEach((id) => p.hgetall(keys.box(id)));
    const res = await p.exec();
    boxes = res.map((r) => r as Box | null).filter(Boolean) as Box[];
  }

  if (componentIds.length) {
    const p = redis.pipeline();
    componentIds.slice(0, 100).forEach((id) => p.hgetall(keys.component(id)));
    const res = await p.exec();
    components = res.map((r) => r as Component | null).filter(Boolean) as Component[];
  }

  if (categoryIds.length) {
    const p = redis.pipeline();
    categoryIds.forEach((code) => p.hgetall(keys.category(code)));
    const res = await p.exec();
    const custom = res.map((r) => r as CategoryDef | null).filter(Boolean) as CategoryDef[];
    const map = new Map(categories.map((c) => [c.code, c]));
    custom.forEach((c) => map.set(c.code, c));
    categories.splice(0, categories.length, ...Array.from(map.values()));
  }

  const systemInstruction = `You are an inventory parser for a student robotics club. Parse the user's message and return a JSON array of inventory actions.

EXISTING BOXES:
${boxes.length ? boxes.map((b) => `  - "${b.name}" (id: ${b.id})`).join("\n") : "  (none)"}

EXISTING COMPONENTS:
${components.length ? components.map((c) => `  - "${c.name}" (id: ${c.id}, qty: ${c.quantity})`).join("\n") : "  (none)"}

CATEGORY CODES:
${categories.map((c) => `  ${c.code} = ${c.label}`).join("\n")}

Return ONLY a valid JSON array, no markdown fences, no explanation. Each element must be one of:

create_box: { "action": "create_box", "name": "string", "location": "string" }
create_component: { "action": "create_component", "name": "string", "category": "CODE", "quantity": number, "boxName": "string", "description": "string" }
add_stock: { "action": "add_stock", "componentId": "existing-id", "quantity": number, "notes": "string" }

Rules:
1. If a component name closely matches an existing component (same product), use add_stock with its exact id — do NOT create a duplicate
2. If a box name closely matches an existing box, use the exact existing box name in boxName — do NOT create a duplicate box
3. If multiple different items are mentioned, return multiple action objects
4. If a new box is needed, put create_box BEFORE any create_component that references it
5. Infer category: ultrasonic/IR/temperature/light/proximity → SENS, servo/motor/stepper → MOTR, Arduino/ESP32/Pi → DEVB, wire/cable/connector → CABL, nut/bolt/bracket/chassis → MECH, battery/regulator/capacitor → POWR, drill/wrench/soldering → TOOL, else → MISC
6. Quantity must be a positive integer`;

  let actions: GeminiAction[];
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction });
    const result = await model.generateContent(message);
    const text = result.response.text().trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    actions = JSON.parse(text);
    if (!Array.isArray(actions)) throw new Error("not array");
  } catch {
    return NextResponse.json({
      results: [{
        type: "error",
        message: "Couldn't understand that",
        sub: 'Try: "15 HC-SR04 sensors in Workbench box"',
      }] as ResultItem[],
    });
  }

  const results: ResultItem[] = [];
  const createdBoxes: { name: string; id: string }[] = [];

  for (const action of actions) {
    try {
      if (action.action === "create_box") {
        const num = await redis.incr(keys.boxCounter());
        const id = `BOX-${String(num).padStart(3, "0")}`;
        const now = new Date().toISOString();
        const box: Box = {
          id,
          name: action.name,
          location: action.location || "Unknown",
          createdBy: session.name,
          createdAt: now,
          boxType: "GENERAL",
        };
        const p = redis.pipeline();
        p.hset(keys.box(id), box);
        p.sadd(keys.boxesAll(), id);
        await p.exec();
        createdBoxes.push({ name: action.name, id });
        boxes.push(box);
        results.push({ type: "box", message: `Box "${action.name}" created`, sub: `${id} · ${action.location || "Unknown"}`, id });
      } else if (action.action === "create_component") {
        const boxMatch =
          createdBoxes.find((b) => lc(b.name) === lc(action.boxName)) ??
          boxes.find((b) => lc(b.name) === lc(action.boxName));

        const boxId = boxMatch?.id ?? "";
        const boxName = boxMatch?.name ?? action.boxName ?? "";

        const catMatch =
          categories.find((c) => c.code === action.category) ??
          categories.find((c) => lc(c.label) === lc(action.category)) ??
          categories.find((c) => c.code === "MISC") ??
          categories[0];

        const year = new Date().getFullYear();
        const seqNum = await redis.incr(keys.counter(catMatch.code, year));
        const id = `${catMatch.code}/${year}/${String(seqNum).padStart(3, "0")}`;
        const now = new Date().toISOString();

        const component: Component = {
          id,
          name: action.name,
          category: catMatch.code,
          categoryLabel: catMatch.label,
          categoryColor: catMatch.color,
          year,
          uniqueNum: seqNum,
          quantity: action.quantity,
          description: action.description ?? "",
          boxId,
          boxName,
          addedBy: session.name,
          createdAt: now,
          updatedAt: now,
        };

        const txId = `TX-${await redis.incr(keys.txCounter())}`;
        const tx: Transaction = {
          id: txId,
          componentId: id,
          componentName: action.name,
          type: "CREATED",
          quantityChange: action.quantity,
          quantityAfter: action.quantity,
          performedBy: session.name,
          notes: "Added via Quick Add",
          timestamp: now,
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
          message: `"${action.name}" created`,
          sub: `${id} · ${action.quantity} units${boxName ? ` · ${boxName}` : ""}`,
          id,
        });
      } else if (action.action === "add_stock") {
        const existing = await redis.hgetall<Component>(keys.component(action.componentId));
        if (!existing) {
          results.push({ type: "error", message: `Component not found: ${action.componentId}` });
          continue;
        }
        const newQty = Number(existing.quantity) + action.quantity;
        const now = new Date().toISOString();
        const txId = `TX-${await redis.incr(keys.txCounter())}`;
        const tx: Transaction = {
          id: txId,
          componentId: action.componentId,
          componentName: existing.name,
          type: "STOCK_IN",
          quantityChange: action.quantity,
          quantityAfter: newQty,
          performedBy: session.name,
          notes: action.notes ?? "Added via Quick Add",
          timestamp: now,
        };

        const p = redis.pipeline();
        p.hset(keys.component(action.componentId), { quantity: newQty, updatedAt: now });
        p.hset(keys.transaction(txId), tx);
        p.zadd(keys.transactionsAll(), { score: Date.now(), member: txId });
        p.zadd(keys.transactionsByComponent(action.componentId), { score: Date.now(), member: txId });
        await p.exec();

        results.push({
          type: "stock",
          message: `+${action.quantity} × ${existing.name}`,
          sub: `Now ${newQty} units`,
          id: action.componentId,
        });
      }
    } catch (e) {
      results.push({ type: "error", message: "Action failed", sub: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  if (results.length === 0) {
    results.push({ type: "error", message: "No actions were performed", sub: "Try being more specific about what you received" });
  }

  return NextResponse.json({ results });
}
