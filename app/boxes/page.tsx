export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Box, Component } from "@/lib/types";
import Link from "next/link";
import { Box as BoxIcon, MapPin, Plus, Package2 } from "lucide-react";

async function getBoxes() {
  const [boxIds, componentIds] = await Promise.all([
    redis.smembers(keys.boxesAll()),
    redis.smembers(keys.componentsAll()),
  ]);
  if (!boxIds.length) return [];

  const pipeline = redis.pipeline();
  boxIds.forEach((id) => pipeline.hgetall(keys.box(id)));
  // only add component commands if there are any, to avoid empty-pipeline error
  if (componentIds.length) {
    componentIds.forEach((id) => pipeline.hgetall(keys.component(id)));
  }
  const results = await pipeline.exec();

  const boxes = results.slice(0, boxIds.length).map((r) => r as Box | null).filter(Boolean) as Box[];
  const components = results.slice(boxIds.length).map((r) => r as Component | null).filter(Boolean) as Component[];

  return boxes
    .map((b) => ({
      ...b,
      componentCount: components.filter((c) => c.boxId === b.id).length,
      totalQty: components.filter((c) => c.boxId === b.id).reduce((s, c) => s + Number(c.quantity), 0),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default async function BoxesPage() {
  const boxes = await getBoxes();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Boxes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{boxes.length} storage boxes</p>
        </div>
        <Link
          href="/boxes/new"
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Box
        </Link>
      </div>

      {boxes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BoxIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No boxes yet</p>
          <Link href="/boxes/new" className="text-indigo-600 text-sm hover:underline mt-1 block">
            Create your first box
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((box) => {
            const isEklavya = box.boxType === "EKLAVYA";
            return (
              <Link
                key={box.id}
                href={`/boxes/${box.id}`}
                className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all group ${
                  isEklavya
                    ? "border-amber-200 hover:border-amber-300"
                    : "border-slate-200 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEklavya ? "bg-amber-50" : "bg-purple-50"}`}>
                    <BoxIcon className={`w-5 h-5 ${isEklavya ? "text-amber-600" : "text-purple-600"}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isEklavya && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Eklavya
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{box.id}</span>
                  </div>
                </div>
                <div className={`font-semibold text-slate-800 transition-colors ${isEklavya ? "group-hover:text-amber-700" : "group-hover:text-indigo-700"}`}>
                  {box.name}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3 h-3" />
                  {box.location}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Package2 className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{box.componentCount}</span>
                    <span className="text-slate-400">types</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">{box.totalQty}</span>
                    <span className="text-slate-400"> units</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
