export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, keys } from "@/lib/redis";
import { User } from "@/lib/types";
import { createSession, SessionPayload } from "@/lib/session";

export async function GET() {
  const count = await redis.scard(keys.usersAll());
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req: NextRequest) {
  try {
    const count = await redis.scard(keys.usersAll());
    if (count > 0) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
    }

    const { name, userId, password } = (await req.json()) as {
      name: string;
      userId: string;
      password: string;
    };

    if (!name?.trim() || !userId?.trim() || !password) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const normalizedId = userId.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const num = await redis.incr(keys.userCounter());
    const internalId = `USR-${String(num).padStart(3, "0")}`;
    const now = new Date().toISOString();

    const user: User = {
      internalId,
      name: name.trim(),
      userId: normalizedId,
      passwordHash,
      year: "TY",
      isAdmin: "true",
      createdAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(keys.user(normalizedId), user);
    pipeline.sadd(keys.usersAll(), normalizedId);
    await pipeline.exec();

    const payload: SessionPayload = {
      id: internalId,
      name: user.name,
      userId: normalizedId,
      year: "TY",
      isAdmin: true,
    };
    await createSession(payload);

    return NextResponse.json({ ok: true, user: payload }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
