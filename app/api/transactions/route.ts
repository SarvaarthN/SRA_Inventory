export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Transaction } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const componentId = searchParams.get("componentId");
    const limit = Number(searchParams.get("limit") ?? "50");

    let txIds: string[];
    if (componentId) {
      txIds = await redis.zrange(keys.transactionsByComponent(componentId), 0, -1, { rev: true });
    } else {
      txIds = await redis.zrange(keys.transactionsAll(), 0, limit - 1, { rev: true });
    }

    if (!txIds.length) return NextResponse.json([]);

    const pipeline = redis.pipeline();
    txIds.forEach((id) => pipeline.hgetall(keys.transaction(id)));
    const results = await pipeline.exec();

    const transactions = results
      .map((r) => r as Transaction | null)
      .filter(Boolean) as Transaction[];

    return NextResponse.json(transactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
