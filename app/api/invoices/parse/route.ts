export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError, GenerativeModel } from "@google/generative-ai";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";
import { InvoiceItem } from "@/lib/types";

// Comfortably under Gemini's inline-data limit, and well past any real invoice.
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

// 429 (rate limited) and 503 (temporarily overloaded) are transient — Google's
// own guidance is to back off and retry rather than treat them as a hard
// failure. Observed in practice: some invoices from lower-traffic vendors
// looked "unparseable" when really the free-tier quota had just been hit by
// an earlier upload in the same session.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

async function generateWithRetry(
  model: GenerativeModel,
  parts: Parameters<GenerativeModel["generateContent"]>[0]
) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await model.generateContent(parts);
    } catch (e) {
      const status = e instanceof GoogleGenerativeAIFetchError ? e.status : undefined;
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (!status || !RETRYABLE_STATUSES.has(status) || isLastAttempt) throw e;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error("unreachable");
}

const systemInstruction = `You read vendor invoices and receipts for a student robotics club's inventory system.
Extract every distinct component or item line from the invoice. Ignore shipping, tax, discount, subtotal and total lines — those are not inventory items.

Return ONLY a valid JSON array, no markdown fences, no explanation. Each element must look like:
{ "name": "string", "category": "CODE", "quantity": integer, "description": "string" }

CATEGORY CODES:
TOOL = Tools, SENS = Sensors, MOTR = Motors, DEVB = Dev Boards, CABL = Cables, MECH = Mechanical, POWR = Power, MISC = Miscellaneous

Rules:
1. Infer category from the item name: ultrasonic/IR/temperature/light/proximity sensor -> SENS, servo/motor/stepper -> MOTR, Arduino/ESP32/Raspberry Pi/microcontroller -> DEVB, wire/cable/connector -> CABL, nut/bolt/bracket/chassis -> MECH, battery/regulator/capacitor -> POWR, drill/wrench/soldering iron -> TOOL, else -> MISC
2. quantity must be a positive integer. If the invoice line does not state one, use 1
3. description is optional extra context from the invoice line (model number, specs) — use "" if there is none
4. If the invoice is unreadable or contains no item lines, return an empty array []`;

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a file" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WEBP or PDF files are accepted" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 8MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  let result: Awaited<ReturnType<GenerativeModel["generateContent"]>>;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction });
    result = await generateWithRetry(model, [
      { inlineData: { data: base64, mimeType: file.type } },
      { text: "Extract the inventory items from this invoice." },
    ]);
  } catch (e) {
    const status = e instanceof GoogleGenerativeAIFetchError ? e.status : undefined;
    const message = status && RETRYABLE_STATUSES.has(status)
      ? "Google's invoice reader is busy right now — wait a moment and try again."
      : "Couldn't read that invoice. Try a clearer photo or scan.";
    return NextResponse.json({ items: [], error: message });
  }

  try {
    const text = result.response.text().trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("not an array");

    const items: InvoiceItem[] = parsed
      .filter((it): it is Record<string, unknown> => it != null && typeof it === "object")
      .map((it) => ({
        name: String(it.name ?? "").trim(),
        category: (String(it.category ?? "MISC").trim().toUpperCase() || "MISC"),
        quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
        description: String(it.description ?? "").trim(),
      }))
      .filter((it) => it.name.length > 0);

    if (!items.length) {
      return NextResponse.json({ items: [], error: "No items were found on that invoice" });
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({
      items: [],
      error: "Couldn't read that invoice. Try a clearer photo or scan.",
    });
  }
}
