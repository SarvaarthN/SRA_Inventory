export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Box, Component } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const box = await redis.hgetall<Box>(keys.box(id));
    if (!box) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const componentIds = await redis.smembers(keys.componentsAll());
    let contents: Component[] = [];
    if (componentIds.length) {
      const pipeline = redis.pipeline();
      componentIds.forEach((cid) => pipeline.hgetall(keys.component(cid)));
      const results = await pipeline.exec();
      contents = (results.map((r) => r as Component | null).filter(Boolean) as Component[])
        .filter((c) => c.boxId === id);
    }

    return NextResponse.json({ ...box, contents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch box" }, { status: 500 });
  }
}
