export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, keys } from "@/lib/redis";
import { User } from "@/lib/types";
import { createSession, SessionPayload } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { userId, password } = (await req.json()) as {
      userId: string;
      password: string;
    };

    if (!userId?.trim() || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const user = await redis.hgetall<User>(keys.user(userId.trim().toLowerCase()));
    if (!user) {
      return NextResponse.json({ error: "Invalid user ID or password" }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Invalid user ID or password" }, { status: 401 });
    }

    const payload: SessionPayload = {
      id: user.internalId,
      name: user.name,
      userId: user.userId,
      year: user.year as SessionPayload["year"],
      isAdmin: String(user.isAdmin) === "true",
    };
    await createSession(payload);

    return NextResponse.json({ ok: true, user: payload });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
