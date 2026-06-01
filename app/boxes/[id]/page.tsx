export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Box, Component, getCategoryLabel, getCategoryColor } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, User, Package2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import DeleteBoxButton from "./DeleteBoxButton";

type Props = { params: Promise<{ id: string }> };

async function getData(id: string) {
  const box = await redis.hgetall<Box>(keys.box(id));
  if (!box) return null;

  const componentIds = await redis.smembers(keys.componentsAll());
  let contents: Component[] = [];
  if (componentIds.length) {
    const pipeline = redis.pipeline();
    componentIds.forEach((cid) => pipeline.hgetall(keys.component(cid)));
    const results = await pipeline.exec();
    contents = (results.map((r) => r as Component | null).filter(Boolean) as Component[])
      .filter((c) => c.boxId === id);
  }

  return { box, contents };
}

export default async function BoxDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { box, contents } = data;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/boxes" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 truncate">{box.name}</h1>
            {box.boxType === "EKLAVYA" && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                Eklavya
              </span>
            )}
          </div>
          <span className="font-mono text-sm text-slate-400">{box.id}</span>
        </div>
        <DeleteBoxButton id={box.id} hasComponents={contents.length > 0} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 text-xs">Location</div>
              <div className="font-medium text-slate-700">{box.location}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 text-xs">Created by</div>
              <div className="font-medium text-slate-700">{box.createdBy}</div>
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Created</div>
            <div className="font-medium text-slate-700">{format(new Date(box.createdAt), "dd MMM yyyy")}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Contents</div>
            <div className="font-medium text-slate-700">
              {contents.length} types · {contents.reduce((s, c) => s + Number(c.quantity), 0)} units
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Contents</h2>
          <Link
            href={`/components/new`}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Add to box
          </Link>
        </div>
        {contents.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Package2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Box is empty</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contents.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${getCategoryColor(c)}`}>
                  {getCategoryLabel(c)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{c.id}</div>
                </div>
                <span className={`text-sm font-bold shrink-0 ${Number(c.quantity) === 0 ? "text-red-600" : Number(c.quantity) <= 2 ? "text-amber-600" : "text-slate-700"}`}>
                  {c.quantity}
                </span>
                <Link href={`/components/${encodeURIComponent(c.id)}`} className="text-slate-400 hover:text-indigo-600 shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
