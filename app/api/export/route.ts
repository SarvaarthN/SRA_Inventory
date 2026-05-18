export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { redis, keys } from "@/lib/redis";
import { Component } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

export async function GET() {
  try {
    const ids = await redis.smembers(keys.componentsAll());
    if (!ids.length) {
      const csv = "Part Number,Name,Category,Quantity,Box,Location,Description,Added By,Created At\n";
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="inventory-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(keys.component(id)));
    const results = await pipeline.exec();

    const components = (results.map((r) => r as Component | null).filter(Boolean) as Component[])
      .sort((a, b) => a.id.localeCompare(b.id));

    const escape = (val: string | undefined) => `"${(val ?? "").replace(/"/g, '""')}"`;

    const header = "Part Number,Name,Category,Quantity,Box ID,Box Name,Description,Added By,Created At\n";
    const rows = components.map((c) =>
      [
        escape(c.id),
        escape(c.name),
        escape(CATEGORY_LABELS[c.category] ?? c.category),
        c.quantity,
        escape(c.boxId),
        escape(c.boxName),
        escape(c.description),
        escape(c.addedBy),
        escape(new Date(c.createdAt).toLocaleString()),
      ].join(",")
    );

    const csv = header + rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="inventory-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
