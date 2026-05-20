"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Component, getCategoryLabel, getCategoryColor } from "@/lib/types";
import { toast } from "sonner";
import { Search, MapPin, ArrowDownCircle, ArrowUpCircle, X, Package2, CheckCircle2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ActionState = {
  componentId: string;
  mode: "in" | "out";
  qty: string;
  name: string;
  notes: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function StockClient({
  canWrite,
  userName,
}: {
  canWrite: boolean;
  userName: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);
  const [results, setResults] = useState<Component[]>([]);
  const [searching, setSearching] = useState(false);
  const [allComponents, setAllComponents] = useState<Component[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [action, setAction] = useState<ActionState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastDone, setLastDone] = useState<{ id: string; mode: "in" | "out"; qty: number } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((data: Component[]) => { setAllComponents(data); setLoaded(true); })
      .catch(() => setLoaded(true));
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const filtered = allComponents.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.boxName ?? "").toLowerCase().includes(q) ||
        getCategoryLabel(c).toLowerCase().includes(q)
    );
    setResults(filtered);
    setSearching(false);
  }, [debounced, allComponents]);

  const openAction = (c: Component, mode: "in" | "out") => {
    setAction({ componentId: c.id, mode, qty: "1", name: userName, notes: "" });
    setLastDone(null);
  };

  const closeAction = () => setAction(null);

  const handleSubmit = async () => {
    if (!action) return;
    if (!action.name.trim()) { toast.error("Please enter your name"); return; }
    const qty = Number(action.qty);
    if (!qty || qty < 1) { toast.error("Enter a valid quantity"); return; }

    const component = allComponents.find((c) => c.id === action.componentId);
    if (!component) return;
    if (action.mode === "out" && qty > Number(component.quantity)) {
      toast.error(`Only ${component.quantity} units available`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(action.componentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action.mode === "in" ? "STOCK_IN" : "STOCK_OUT",
          quantity: qty,
          performedBy: action.name.trim(),
          notes: action.notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: Component = await res.json();

      setAllComponents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setResults((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

      setLastDone({ id: action.componentId, mode: action.mode, qty });
      setAction(null);
      router.refresh();
      toast.success(
        action.mode === "in"
          ? `Checked in ${qty} × ${component.name}`
          : `Checked out ${qty} × ${component.name}`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const showEmpty = loaded && query.trim() && results.length === 0 && !searching;
  const showHint = !query.trim();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Check In / Out</h1>
          <p className="text-slate-500 text-sm mt-0.5">Search any component and record a transaction</p>
        </div>
        {!canWrite && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            View only (SY)
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by name, part number, category, box…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setAction(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showHint && (
        <div className="text-center py-14 text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Start typing to find a component</p>
          <p className="text-xs mt-1 opacity-70">{allComponents.length} components in inventory</p>
        </div>
      )}

      {showEmpty && (
        <div className="text-center py-14 text-slate-400">
          <Package2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No components match &ldquo;{query}&rdquo;</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((c) => {
          const isActive = action?.componentId === c.id;
          const justDone = lastDone?.id === c.id;
          const qty = Number(c.quantity);
          const isOut = qty === 0;
          const isLow = qty > 0 && qty <= 2;

          return (
            <div
              key={c.id}
              className={cn(
                "bg-white rounded-xl border transition-all",
                isActive ? "border-indigo-300 shadow-md" : "border-slate-200 shadow-sm"
              )}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-base">{c.name}</span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", getCategoryColor(c))}>
                      {getCategoryLabel(c)}
                    </span>
                    {justDone && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{c.id}</span>
                    {c.boxName && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />
                        {c.boxName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right mr-1">
                    <div className={cn("text-2xl font-bold", isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-slate-700")}>
                      {c.quantity}
                    </div>
                    <div className="text-xs text-slate-400">in stock</div>
                  </div>

                  <button
                    onClick={() => canWrite && (isActive && action?.mode === "in" ? closeAction() : openAction(c, "in"))}
                    disabled={!canWrite}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      !canWrite
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : isActive && action?.mode === "in"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    )}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    In
                  </button>
                  <button
                    onClick={() => canWrite && (isActive && action?.mode === "out" ? closeAction() : openAction(c, "out"))}
                    disabled={isOut || !canWrite}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      !canWrite || isOut
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : isActive && action?.mode === "out"
                        ? "bg-amber-500 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Out
                  </button>
                </div>
              </div>

              {isActive && action && canWrite && (
                <div className={cn(
                  "border-t px-4 py-4 space-y-3",
                  action.mode === "in" ? "border-blue-100 bg-blue-50/40" : "border-amber-100 bg-amber-50/40"
                )}>
                  <p className="text-sm font-medium text-slate-700">
                    {action.mode === "in" ? "Returning to stock" : "Taking from stock"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min="1"
                        max={action.mode === "out" ? c.quantity : undefined}
                        value={action.qty}
                        onChange={(e) => setAction({ ...action, qty: e.target.value })}
                        className="bg-white"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Your Name <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Who is doing this?"
                        value={action.name}
                        onChange={(e) => setAction({ ...action, name: e.target.value })}
                        className="bg-white"
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                      placeholder="Reason, project, etc."
                      value={action.notes}
                      onChange={(e) => setAction({ ...action, notes: e.target.value })}
                      className="bg-white"
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={closeAction}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60",
                        action.mode === "in" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600"
                      )}
                    >
                      {submitting
                        ? "Saving…"
                        : action.mode === "in"
                        ? `Confirm Check In (${action.qty})`
                        : `Confirm Check Out (${action.qty})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
