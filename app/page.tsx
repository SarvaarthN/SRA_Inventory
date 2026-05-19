export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Component, Transaction, getCategoryLabel, getCategoryColor } from "@/lib/types";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { Package2, Box, AlertTriangle, TrendingUp, ArrowRight, Plus, ArrowLeftRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

async function getDashboardData() {
  const [componentIds, boxIds, recentTxIds] = await Promise.all([
    redis.smembers(keys.componentsAll()),
    redis.smembers(keys.boxesAll()),
    redis.zrange(keys.transactionsAll(), 0, 9, { rev: true }) as Promise<string[]>,
  ]);

  if (!componentIds.length && !recentTxIds.length) {
    return { components: [], transactions: [], boxCount: boxIds.length };
  }

  const pipeline = redis.pipeline();
  componentIds.forEach((id) => pipeline.hgetall(keys.component(id)));
  recentTxIds.forEach((id) => pipeline.hgetall(keys.transaction(id)));
  const results = await pipeline.exec();

  const components = results
    .slice(0, componentIds.length)
    .map((r) => r as Component | null)
    .filter(Boolean) as Component[];

  const transactions = results
    .slice(componentIds.length)
    .map((r) => r as Transaction | null)
    .filter(Boolean) as Transaction[];

  return { components, transactions, boxCount: boxIds.length };
}

export default async function DashboardPage() {
  const [{ components, transactions, boxCount }, session] = await Promise.all([
    getDashboardData(),
    getSession(),
  ]);
  const canWrite = session?.year === "TY" || session?.year === "LY";

  const totalQty = components.reduce((s, c) => s + Number(c.quantity), 0);
  const lowStock = components.filter((c) => Number(c.quantity) > 0 && Number(c.quantity) <= 2);
  const outOfStock = components.filter((c) => Number(c.quantity) === 0);

  // Build category summary: code -> { label, color, count }
  const byCategoryMap = new Map<string, { label: string; color: string; count: number }>();
  components.forEach((c) => {
    const prev = byCategoryMap.get(c.category);
    byCategoryMap.set(c.category, {
      label: getCategoryLabel(c),
      color: getCategoryColor(c),
      count: (prev?.count ?? 0) + 1,
    });
  });

  const txTypeColor: Record<string, string> = {
    CREATED: "text-green-700 bg-green-50",
    STOCK_IN: "text-blue-700 bg-blue-50",
    STOCK_OUT: "text-amber-700 bg-amber-50",
    DELETED: "text-red-700 bg-red-50",
  };
  const txTypeLabel: Record<string, string> = {
    CREATED: "Created",
    STOCK_IN: "Stock In",
    STOCK_OUT: "Stock Out",
    DELETED: "Deleted",
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Overview of your club inventory</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/stock"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Check In/Out
          </Link>
          {canWrite && (
            <>
              <Link
                href="/components/new"
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Component
              </Link>
              <Link
                href="/boxes/new"
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Box
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Components", value: components.length, icon: Package2, color: "text-indigo-600 bg-indigo-50" },
          { label: "Total Units", value: totalQty, icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
          { label: "Storage Boxes", value: boxCount, icon: Box, color: "text-purple-600 bg-purple-50" },
          {
            label: "Low / Out of Stock",
            value: `${lowStock.length} / ${outOfStock.length}`,
            icon: AlertTriangle,
            color: outOfStock.length > 0 ? "text-red-600 bg-red-50" : lowStock.length > 0 ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">By Category</h2>
          {byCategoryMap.size === 0 ? (
            <p className="text-slate-400 text-sm">No components yet</p>
          ) : (
            <div className="space-y-2">
              {Array.from(byCategoryMap.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .map(([cat, { label, color, count }]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Low stock warnings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Low / Out of Stock</h2>
            {(lowStock.length + outOfStock.length) > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {lowStock.length + outOfStock.length} items
              </span>
            )}
          </div>
          {lowStock.length + outOfStock.length === 0 ? (
            <p className="text-slate-400 text-sm">All items are well stocked</p>
          ) : (
            <div className="space-y-2">
              {[...outOfStock, ...lowStock].slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <Link href={`/components/${encodeURIComponent(c.id)}`} className="text-sm font-medium text-slate-700 hover:text-indigo-600">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono">{c.id}</div>
                  </div>
                  <span className={`text-sm font-bold ${Number(c.quantity) === 0 ? "text-red-600" : "text-amber-600"}`}>
                    {c.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Recent Activity</h2>
          <Link href="/transactions" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {transactions.length === 0 ? (
          <p className="text-slate-400 text-sm">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${txTypeColor[tx.type]}`}>
                  {txTypeLabel[tx.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 truncate block">{tx.componentName}</span>
                  <span className="text-xs text-slate-400">by {tx.performedBy}</span>
                </div>
                {tx.type !== "DELETED" && tx.type !== "CREATED" && (
                  <span className={`text-sm font-semibold shrink-0 ${tx.type === "STOCK_IN" ? "text-blue-600" : "text-amber-600"}`}>
                    {tx.type === "STOCK_IN" ? "+" : "-"}{tx.quantityChange}
                  </span>
                )}
                <span className="text-xs text-slate-400 shrink-0">
                  {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
