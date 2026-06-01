export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Box, Component } from "@/lib/types";

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const box = await redis.hgetall<Box>(keys.box(id));
    if (!box) return NextResponse.json({ error: "Box not found" }, { status: 404 });

    const componentIds = await redis.smembers(keys.componentsAll());
    if (componentIds.length) {
      const pipeline = redis.pipeline();
      componentIds.forEach((cid) => pipeline.hgetall(keys.component(cid)));
      const results = await pipeline.exec();
      const hasComponents = (results.map((r) => r as Component | null).filter(Boolean) as Component[])
        .some((c) => c.boxId === id);
      if (hasComponents) {
        return NextResponse.json({ error: "Cannot delete a box that still has components. Move or delete the components first." }, { status: 400 });
      }
    }

    const pipeline = redis.pipeline();
    pipeline.del(keys.box(id));
    pipeline.srem(keys.boxesAll(), id);
    await pipeline.exec();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete box" }, { status: 500 });
  }
}

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
