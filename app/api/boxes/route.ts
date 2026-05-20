export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys, queueSheetUpdate } from "@/lib/redis";
import { Box, Component } from "@/lib/types";


export async function GET() {
  try {
    const ids = await redis.smembers(keys.boxesAll());
    if (!ids.length) return NextResponse.json([]);

    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(keys.box(id)));
    const results = await pipeline.exec();

    const componentIds = await redis.smembers(keys.componentsAll());
    let components: Component[] = [];
    if (componentIds.length) {
      const compPipeline = redis.pipeline();
      componentIds.forEach((id) => compPipeline.hgetall(keys.component(id)));
      const compResults = await compPipeline.exec();
      components = compResults.map((r) => r as Component | null).filter(Boolean) as Component[];
    }

    const boxes = results
      .map((r) => r as Box | null)
      .filter(Boolean)
      .map((box) => ({
        ...box,
        componentCount: components.filter((c) => c.boxId === box!.id).length,
      })) as (Box & { componentCount: number })[];

    boxes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(boxes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch boxes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, location, createdBy, boxType } = await req.json() as {
      name: string;
      location: string;
      createdBy: string;
      boxType?: string;
    };

    if (!name || !location || !createdBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const num = await redis.incr(keys.boxCounter());
    const id = `BOX-${String(num).padStart(3, "0")}`;
    const now = new Date().toISOString();

    const box: Box = {
      id,
      name,
      location,
      createdBy,
      createdAt: now,
      boxType: boxType === "EKLAVYA" ? "EKLAVYA" : "GENERAL",
    };
    const pipeline = redis.pipeline();
    pipeline.hset(keys.box(id), box);
    pipeline.sadd(keys.boxesAll(), id);
    await pipeline.exec();

    // Sync in background to Google Sheets
    queueSheetUpdate("Boxes", "CREATE", "1ID", box.id, {
      "1ID": box.id,
      name: box.name,
      location: box.location,
      createdBy: box.createdBy,
      createdAt: box.createdAt,
      boxType: box.boxType
    });

    return NextResponse.json(box, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create box" }, { status: 500 });
  }
}
