export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Component, Box } from "@/lib/types";
import { filterBoxes, filterComponents } from "@/lib/search";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").toLowerCase().trim();
    const type = searchParams.get("type") ?? "components"; // "components" | "boxes"

    if (!q) return NextResponse.json([]);

    if (type === "boxes") {
      const ids = await redis.smembers(keys.boxesAll());
      if (!ids.length) return NextResponse.json([]);
      const pipeline = redis.pipeline();
      ids.forEach((id) => pipeline.hgetall(keys.box(id)));
      const results = await pipeline.exec();
      const all = results.map((r) => r as Box | null).filter(Boolean) as Box[];
      return NextResponse.json(filterBoxes(all, q).slice(0, 8));
    }

    const ids = await redis.smembers(keys.componentsAll());
    if (!ids.length) return NextResponse.json([]);
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(keys.component(id)));
    const results = await pipeline.exec();
    const all = results.map((r) => r as Component | null).filter(Boolean) as Component[];
    return NextResponse.json(filterComponents(all, q).slice(0, 8));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
