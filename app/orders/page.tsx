export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Order, parseOrderItems, isOverdue } from "@/lib/types";
import Link from "next/link";
import { Truck, Plus, PackageCheck, AlertTriangle, Calendar, Store } from "lucide-react";
import { getSession } from "@/lib/session";

async function getOrders(): Promise<Order[]> {
  const ids = await redis.zrange<string[]>(keys.ordersAll(), 0, -1);
  if (!ids.length) return [];

  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(keys.order(id)));
  const results = await pipeline.exec();

  return (results.map((r) => r as Order | null).filter(Boolean) as Order[]).map((o) => ({
    ...o,
    items: parseOrderItems(o.items),
  }));
}

function formatDate(iso: string): string {
  if (!iso) return "not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysAway(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "arriving today";
  if (diff === 1) return "arriving tomorrow";
  if (diff > 1) return `in ${diff} days`;
  if (diff === -1) return "1 day late";
  return `${Math.abs(diff)} days late`;
}

function OrderCard({ order }: { order: Order }) {
  const late = isOverdue(order);
  const units = order.items.reduce((s, i) => s + Number(i.quantity), 0);
  const when = daysAway(order.expectedAt);

  return (
    <Link
      href={`/orders/${order.id}`}
      className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all group block ${
        late ? "border-red-200 hover:border-red-300" : "border-slate-200 hover:border-indigo-200"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            order.status === "RECEIVED"
              ? "bg-green-50"
              : late
                ? "bg-red-50"
                : "bg-blue-50"
          }`}
        >
          {order.status === "RECEIVED" ? (
            <PackageCheck className="w-5 h-5 text-green-600" />
          ) : late ? (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          ) : (
            <Truck className="w-5 h-5 text-blue-600" />
          )}
        </div>
        <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
          {order.id}
        </span>
      </div>

      <div className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors flex items-center gap-1.5">
        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {order.vendor}
      </div>
      {order.orderNumber && (
        <div className="text-xs text-slate-400 mt-0.5 font-mono">#{order.orderNumber}</div>
      )}

      <div className="flex items-center gap-1 text-xs mt-2">
        <Calendar className="w-3 h-3 text-slate-400" />
        {order.status === "RECEIVED" ? (
          <span className="text-green-600">Received {formatDate(order.receivedAt)}</span>
        ) : (
          <span className={late ? "text-red-600 font-medium" : "text-slate-500"}>
            {formatDate(order.expectedAt)}
            {when && ` (${when})`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600">
        <div>
          <span className="font-medium">{order.items.length}</span>
          <span className="text-slate-400"> items</span>
        </div>
        <div>
          <span className="font-medium">{units}</span>
          <span className="text-slate-400"> units</span>
        </div>
        {order.totalCost && (
          <div className="ml-auto text-slate-500">Rs {order.totalCost}</div>
        )}
      </div>
    </Link>
  );
}

export default async function OrdersPage() {
  const [orders, session] = await Promise.all([getOrders(), getSession()]);
  const canWrite = session?.year === "TY" || session?.year === "LY";

  const incoming = orders.filter((o) => o.status === "ORDERED");
  const received = orders.filter((o) => o.status === "RECEIVED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const lateCount = incoming.filter(isOverdue).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {incoming.length} incoming
            {lateCount > 0 && <span className="text-red-600"> ({lateCount} late)</span>}
            {received.length > 0 && ` · ${received.length} received`}
          </p>
        </div>
        {canWrite && (
          <Link
            href="/orders/new"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </Link>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No orders yet</p>
          {canWrite && (
            <Link href="/orders/new" className="text-indigo-600 text-sm hover:underline mt-1 block">
              Log your first order
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {incoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Incoming
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {incoming.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}

          {received.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Received
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {received.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}

          {cancelled.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Cancelled
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cancelled.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
