export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { CategoryDef, DEFAULT_CATEGORIES } from "@/lib/types";

async function seedDefaults() {
  const now = new Date().toISOString();
  const pipeline = redis.pipeline();
  for (const cat of DEFAULT_CATEGORIES) {
    const full: CategoryDef = { code: cat.code, label: cat.label, color: cat.color, isDefault: "true", createdAt: now };
    pipeline.hset(keys.category(cat.code), full);
    pipeline.sadd(keys.categoriesAll(), cat.code);
  }
  await pipeline.exec();
}

export async function GET() {
  try {
    const codes = (await redis.smembers(keys.categoriesAll())) as string[];

    if (!codes.length) {
      await seedDefaults();
      return NextResponse.json(
        DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          isDefault: "true",
          createdAt: new Date().toISOString(),
        }))
      );
    }

    const pipeline = redis.pipeline();
    codes.forEach((code) => pipeline.hgetall(keys.category(code)));
    const results = await pipeline.exec();
    const categories = (results.map((r) => r as CategoryDef | null).filter(Boolean) as CategoryDef[])
      .sort((a, b) => {
        // defaults first, then by label
        if (a.isDefault === "true" && b.isDefault !== "true") return -1;
        if (a.isDefault !== "true" && b.isDefault === "true") return 1;
        return a.label.localeCompare(b.label);
      });

    return NextResponse.json(categories);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, label, color } = await req.json() as {
      code: string;
      label: string;
      color: string;
    };

    if (!code || !label || !color) {
      return NextResponse.json({ error: "code, label and color are required" }, { status: 400 });
    }

    const upperCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!upperCode) {
      return NextResponse.json({ error: "Invalid category code" }, { status: 400 });
    }

    const existing = await redis.smembers(keys.categoriesAll());
    if (existing.includes(upperCode)) {
      return NextResponse.json({ error: `Category code "${upperCode}" already exists` }, { status: 409 });
    }

    const category: CategoryDef = {
      code: upperCode,
      label: label.trim(),
      color,
      isDefault: "false",
      createdAt: new Date().toISOString(),
    };

    const pipeline = redis.pipeline();
    pipeline.hset(keys.category(upperCode), category);
    pipeline.sadd(keys.categoriesAll(), upperCode);
    await pipeline.exec();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
