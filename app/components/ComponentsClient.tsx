"use client";
import { useState } from "react";
import { Component, getCategoryLabel, getCategoryColor } from "@/lib/types";
import Link from "next/link";
import { Plus, Search, Package2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const ALL = "ALL";

export default function ComponentsClient({ initialComponents }: { initialComponents: Component[] }) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>(ALL);

  // Build unique category list from the components themselves
  const categoryMap = new Map<string, { label: string; color: string }>();
  initialComponents.forEach((c) => {
    if (!categoryMap.has(c.category)) {
      categoryMap.set(c.category, { label: getCategoryLabel(c), color: getCategoryColor(c) });
    }
  });

  const filtered = initialComponents.filter((c) => {
    const matchesCat = selectedCat === ALL || c.category === selectedCat;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      (c.boxName ?? "").toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Components</h1>
          <p className="text-slate-500 text-sm mt-0.5">{initialComponents.length} total items</p>
        </div>
        <Link
          href="/components/new"
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Component
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, part number, box..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCat(ALL)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCat === ALL
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {Array.from(categoryMap.entries()).map(([cat, { label, color }]) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat === selectedCat ? ALL : cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                selectedCat === cat ? color : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No components found</p>
          {initialComponents.length === 0 && (
            <Link href="/components/new" className="text-indigo-600 text-sm hover:underline mt-1 block">
              Add your first component
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Part No.</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Category</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Box</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Qty</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">{c.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 text-sm">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">{c.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(c)}`}>
                      {getCategoryLabel(c)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.boxName ? (
                      <div>
                        <div className="text-sm text-slate-700">{c.boxName}</div>
                        <div className="text-xs text-slate-400 font-mono">{c.boxId}</div>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${
                      Number(c.quantity) === 0 ? "text-red-600"
                      : Number(c.quantity) <= 2 ? "text-amber-600"
                      : "text-slate-700"
                    }`}>
                      {c.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/components/${encodeURIComponent(c.id)}`} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
