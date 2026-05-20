export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { redis, keys } from "@/lib/redis";
import { User } from "@/lib/types";
import { createSession, SessionPayload } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = (await req.json()) as {
      email: string;
      password: string;
      name?: string;
    };

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user is in the Google Sheet allowed list
    const user = await redis.hgetall<User>(keys.user(normalizedEmail));
    if (!user) {
      return NextResponse.json(
        { error: "Your email is not pre-authorized. Please contact the Electronics Head." },
        { status: 403 }
      );
    }

    // Check if user has already set up their password
    if (user.passwordHash) {
      return NextResponse.json(
        { error: "Account already registered. Please sign in instead." },
        { status: 400 }
      );
    }

    // Set password hash, timestamp, and assign USR-XXX ID if missing
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const internalId = user.internalId || `USR-${String(await redis.incr(keys.userCounter())).padStart(3, "0")}`;

    const updatedUser: User = {
      ...user,
      internalId,
      name: user.name || name || email.split("@")[0],
      passwordHash,
      createdAt: now,
    };

    // Save back to the Google Sheet (via Redis hset emulator)
    await redis.hset(keys.user(normalizedEmail), updatedUser);

    // Automatically establish session
    const payload: SessionPayload = {
      id: internalId,
      name: updatedUser.name,
      userId: normalizedEmail,
      year: updatedUser.year as SessionPayload["year"],
      isAdmin: updatedUser.isAdmin === "true",
    };
    await createSession(payload);

    return NextResponse.json({ ok: true, user: payload }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
