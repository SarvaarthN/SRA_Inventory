export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, keys } from "@/lib/redis";
import { User } from "@/lib/types";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userIds = await redis.smembers(keys.usersAll());
  if (!userIds.length) return NextResponse.json([]);

  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.hgetall(keys.user(id)));
  const results = await pipeline.exec();

  const users = results
    .map((r) => r as User | null)
    .filter(Boolean)
    .map((u) => ({
      internalId: u!.internalId,
      name: u!.name,
      userId: u!.userId,
      year: u!.year,
      isAdmin: u!.isAdmin,
      createdAt: u!.createdAt,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, userId, password, year, isAdmin } = (await req.json()) as {
      name: string;
      userId: string;
      password: string;
      year: string;
      isAdmin?: boolean;
    };

    if (!name?.trim() || !userId?.trim() || !password || !year) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["SY", "TY", "LY"].includes(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const normalizedId = userId.trim().toLowerCase();

    const existing = await redis.hgetall(keys.user(normalizedId));
    if (existing) {
      return NextResponse.json({ error: "User ID already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const num = await redis.incr(keys.userCounter());
    const internalId = `USR-${String(num).padStart(3, "0")}`;
    const now = new Date().toISOString();

    const user: User = {
      internalId,
      name: name.trim(),
      userId: normalizedId,
      passwordHash,
      year,
      isAdmin: isAdmin ? "true" : "false",
      createdAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(keys.user(normalizedId), user);
    pipeline.sadd(keys.usersAll(), normalizedId);
    await pipeline.exec();

    return NextResponse.json(
      { internalId, name: user.name, userId: normalizedId, year, isAdmin: user.isAdmin, createdAt: now },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
