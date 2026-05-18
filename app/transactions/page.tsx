export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Transaction } from "@/lib/types";
import { format } from "date-fns";
import Link from "next/link";
import { History } from "lucide-react";

async function getTransactions() {
  const txIds = (await redis.zrange(keys.transactionsAll(), 0, 199, { rev: true })) as string[];
  if (!txIds.length) return [];
  const pipeline = redis.pipeline();
  txIds.forEach((id) => pipeline.hgetall(keys.transaction(id)));
  const results = await pipeline.exec();
  return results.map((r) => r as Transaction | null).filter(Boolean) as Transaction[];
}

const txTypeColor: Record<string, string> = {
  CREATED: "text-green-700 bg-green-50 border-green-100",
  STOCK_IN: "text-blue-700 bg-blue-50 border-blue-100",
  STOCK_OUT: "text-amber-700 bg-amber-50 border-amber-100",
  DELETED: "text-red-700 bg-red-50 border-red-100",
};
const txTypeLabel: Record<string, string> = {
  CREATED: "Created",
  STOCK_IN: "Stock In",
  STOCK_OUT: "Stock Out",
  DELETED: "Deleted",
};

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">Full history of all inventory changes</p>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Component</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">By</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Change</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">After</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${txTypeColor[tx.type]}`}>
                      {txTypeLabel[tx.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/components/${encodeURIComponent(tx.componentId)}`}
                      className="text-sm font-medium text-slate-700 hover:text-indigo-600"
                    >
                      {tx.componentName}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono">{tx.componentId}</div>
                    {tx.notes && <div className="text-xs text-slate-400 italic">{tx.notes}</div>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-slate-600">{tx.performedBy}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {tx.type === "STOCK_IN" && (
                      <span className="text-sm font-semibold text-blue-600">+{tx.quantityChange}</span>
                    )}
                    {tx.type === "STOCK_OUT" && (
                      <span className="text-sm font-semibold text-amber-600">-{tx.quantityChange}</span>
                    )}
                    {(tx.type === "CREATED" || tx.type === "DELETED") && (
                      <span className="text-sm text-slate-400">{tx.quantityChange}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm font-medium text-slate-700">{tx.quantityAfter}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-xs text-slate-500">{format(new Date(tx.timestamp), "dd MMM")}</div>
                    <div className="text-xs text-slate-400">{format(new Date(tx.timestamp), "HH:mm")}</div>
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
