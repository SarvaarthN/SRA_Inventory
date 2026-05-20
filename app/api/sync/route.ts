import { NextRequest, NextResponse } from "next/server";
import { syncAllRedisToSheets, syncAllSheetsToRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const direction = url.searchParams.get("direction"); // "to-sheets" or "to-redis"
    const secret = url.searchParams.get("secret");

    if (!secret || secret !== process.env.DB_SECRET_TOKEN) {
      return NextResponse.json({ error: "Unauthorized: invalid or missing secret token" }, { status: 401 });
    }

    if (direction === "to-sheets") {
      console.log("Admin initiated sync from Redis to Google Sheets...");
      await syncAllRedisToSheets();
      return NextResponse.json({ success: true, message: "Successfully synced all Redis data to Google Sheets!" });
    } else if (direction === "to-redis") {
      console.log("Admin initiated sync from Google Sheets to Redis...");
      await syncAllSheetsToRedis();
      return NextResponse.json({ success: true, message: "Successfully synced all Google Sheets data to Redis!" });
    } else {
      return NextResponse.json({ error: "Invalid direction parameter. Must be 'to-sheets' or 'to-redis'." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Sync API error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during sync" }, { status: 500 });
  }
}
