export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { User } from "@/lib/types";
import { createSession, SessionPayload } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as {
      userId: string;
    };

    if (!userId?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const email = userId.trim().toLowerCase();

    // Check if user email is present in the Users spreadsheet
    const user = await redis.hgetall<User>(keys.user(email));
    if (!user) {
      return NextResponse.json(
        { error: "Your email is not authorized. Please contact the Electronics Head." },
        { status: 401 }
      );
    }

    // Auto-generate internal USR-XXX ID if missing
    const internalId = user.internalId || `USR-${String(await redis.incr(keys.userCounter())).padStart(3, "0")}`;

    const payload: SessionPayload = {
      id: internalId,
      name: String(user.name || email.split("@")[0]),
      userId: email,
      year: (user.year || "SY") as SessionPayload["year"],
      isAdmin: String(user.isAdmin).toLowerCase() === "true",
    };
    
    await createSession(payload);

    return NextResponse.json({ ok: true, user: payload });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
