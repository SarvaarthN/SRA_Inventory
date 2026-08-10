export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Order, parseOrderItems, isOverdue, ORDER_STATUS_STYLES } from "@/lib/types";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Store, Calendar, User, Package2, ExternalLink,
  AlertTriangle, StickyNote, IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import OrderActions from "./OrderActions";

type Params = { params: Promise<{ id: string }> };

function formatDate(iso: string): string {
  if (!iso) return "not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function OrderDetailPage({ params }: Params) {
  const { id } = await params;
  const orderId = decodeURIComponent(id);

  const [raw, session] = await Promise.all([
    redis.hgetall<Order>(keys.order(orderId)),
    getSession(),
  ]);
  if (!raw) notFound();

  const order: Order = { ...raw, items: parseOrderItems(raw.items) };
  const canWrite = session?.year === "TY" || session?.year === "LY";
  const late = isOverdue(order);
  const units = order.items.reduce((s, i) => s + Number(i.quantity), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{order.vendor}</h1>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border",
                ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.CANCELLED
              )}
            >
              {String(order.status).toLowerCase()}
            </span>
            {late && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                overdue
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-mono mt-0.5">
            {order.id}
            {order.orderNumber && ` · #${order.orderNumber}`}
          </p>
        </div>
      </div>

      {order.status === "ORDERED" && canWrite && <OrderActions order={order} />}

      <div className="bg-white rounded-xl border border-slate-200 p-5 grid sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-2.5">
          <Store className="w-4 h-4 text-slate-400 mt-0.5" />
          <div>
            <div className="text-xs text-slate-400">Vendor</div>
            <div className="text-sm text-slate-700">{order.vendor}</div>
            {order.vendorUrl && (
              <a
                href={order.vendorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                Open link
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
          <div>
            <div className="text-xs text-slate-400">Ordered</div>
            <div className="text-sm text-slate-700">{formatDate(order.orderedAt)}</div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Calendar className={cn("w-4 h-4 mt-0.5", late ? "text-red-400" : "text-slate-400")} />
          <div>
            <div className="text-xs text-slate-400">
              {order.status === "RECEIVED" ? "Received" : "Expected"}
            </div>
            <div className={cn("text-sm", late ? "text-red-600 font-medium" : "text-slate-700")}>
              {order.status === "RECEIVED"
                ? formatDate(order.receivedAt)
                : formatDate(order.expectedAt)}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <User className="w-4 h-4 text-slate-400 mt-0.5" />
          <div>
            <div className="text-xs text-slate-400">
              {order.status === "RECEIVED" ? "Ordered / received by" : "Ordered by"}
            </div>
            <div className="text-sm text-slate-700">
              {order.orderedBy}
              {order.receivedBy && ` / ${order.receivedBy}`}
            </div>
          </div>
        </div>

        {order.totalCost && (
          <div className="flex items-start gap-2.5">
            <IndianRupee className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400">Total cost</div>
              <div className="text-sm text-slate-700">{order.totalCost}</div>
            </div>
          </div>
        )}

        {order.notes && (
          <div className="flex items-start gap-2.5 sm:col-span-2">
            <StickyNote className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400">Notes</div>
              <div className="text-sm text-slate-700">{order.notes}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Items ({order.items.length})
          </h2>
          <span className="text-xs text-slate-400">{units} units total</span>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((item, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                <Package2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{item.name}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                  {item.componentId ? (
                    <Link
                      href={`/components/${encodeURIComponent(item.componentId)}`}
                      className="font-mono text-indigo-600 hover:underline"
                    >
                      {item.componentId}
                    </Link>
                  ) : (
                    <span className="text-amber-600">
                      new {item.categoryLabel || item.category} component
                    </span>
                  )}
                  {item.boxName && <span>· {item.boxName}</span>}
                </div>
              </div>
              <div className="text-sm font-medium text-slate-700 shrink-0">x{item.quantity}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
