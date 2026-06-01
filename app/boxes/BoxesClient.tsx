"use client";
import { useState } from "react";
import { Box } from "@/lib/types";
import Link from "next/link";
import { Box as BoxIcon, MapPin, Plus, Package2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type BoxWithStats = Box & { componentCount: number; totalQty: number };

export default function BoxesClient({ boxes }: { boxes: BoxWithStats[] }) {
  const [search, setSearch] = useState("");

  const filtered = boxes.filter((b) => {
    const q = search.toLowerCase();
    return (
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      String(b.location ?? "").toLowerCase().includes(q)
    );
  });

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search by name, location, or box ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {boxes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BoxIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No boxes yet</p>
          <Link href="/boxes/new" className="text-indigo-600 text-sm hover:underline mt-1 block">
            Create your first box
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No boxes match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((box) => {
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
