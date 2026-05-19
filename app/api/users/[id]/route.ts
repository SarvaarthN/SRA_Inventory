export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent deleting yourself
  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const exists = await redis.hgetall(keys.user(id));
  if (!exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const pipeline = redis.pipeline();
  pipeline.del(keys.user(id));
  pipeline.srem(keys.usersAll(), id);
  await pipeline.exec();

  return NextResponse.json({ ok: true });
}
