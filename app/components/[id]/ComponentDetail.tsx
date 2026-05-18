"use client";
import { useState } from "react";
import { Component, Transaction, getCategoryLabel, getCategoryColor } from "@/lib/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Minus, Trash2, Package2, MapPin, Clock, User } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

export default function ComponentDetail({
  component: initial,
  transactions: initialTx,
}: {
  component: Component;
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [component, setComponent] = useState(initial);
  const [transactions] = useState(initialTx);
  const [loading, setLoading] = useState(false);

  // Stock in/out dialog state
  const [stockDialog, setStockDialog] = useState<"in" | "out" | null>(null);
  const [stockQty, setStockQty] = useState("1");
  const [stockBy, setStockBy] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<"soft" | "hard" | null>(null);
  const [deleteBy, setDeleteBy] = useState("");

  const handleStock = async () => {
    if (!stockBy.trim()) { toast.error("Please enter your name"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(component.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: stockDialog === "in" ? "STOCK_IN" : "STOCK_OUT",
          quantity: Number(stockQty),
          performedBy: stockBy.trim(),
          notes: stockNotes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: Component = await res.json();
      setComponent(updated);
      toast.success(`${stockDialog === "in" ? "Added" : "Removed"} ${stockQty} units`);
      setStockDialog(null);
      setStockQty("1");
      setStockBy("");
      setStockNotes("");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBy.trim()) { toast.error("Please enter your name"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(component.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performedBy: deleteBy.trim(),
          hardDelete: deleteDialog === "hard",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(deleteDialog === "hard" ? "Component deleted" : "Stock cleared");
      if (deleteDialog === "hard") {
        router.push("/components");
      } else {
        setComponent({ ...component, quantity: 0 });
        setDeleteDialog(null);
        router.refresh();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/components" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">{component.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-sm text-slate-500 font-mono">{component.id}</code>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(component)}`}>
              {getCategoryLabel(component)}
            </span>
          </div>
        </div>
        <div
          className={`text-3xl font-bold ${
            Number(component.quantity) === 0
              ? "text-red-600"
              : Number(component.quantity) <= 2
              ? "text-amber-600"
              : "text-slate-700"
          }`}
        >
          {component.quantity}
          <span className="text-sm font-normal text-slate-400 ml-1">units</span>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        {component.description && (
          <p className="text-sm text-slate-600">{component.description}</p>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {component.boxName && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-700">{component.boxName}</div>
                <div className="text-xs text-slate-400 font-mono">{component.boxId}</div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 text-xs">Added by</div>
              <div className="font-medium text-slate-700">{component.addedBy}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 text-xs">Created</div>
              <div className="font-medium text-slate-700">{format(new Date(component.createdAt), "dd MMM yyyy")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
        <button
          onClick={() => { setStockDialog("in"); setStockQty("1"); }}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Stock In
        </button>
        <button
          onClick={() => { setStockDialog("out"); setStockQty("1"); }}
          disabled={Number(component.quantity) === 0}
          className="flex items-center justify-center gap-2 bg-amber-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-40"
        >
          <Minus className="w-4 h-4" />
          Stock Out
        </button>
        <button
          onClick={() => setDeleteDialog("soft")}
          disabled={Number(component.quantity) === 0}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          <Minus className="w-4 h-4" />
          Clear Stock
        </button>
        <button
          onClick={() => setDeleteDialog("hard")}
          className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Component
        </button>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">History</h2>
        {transactions.length === 0 ? (
          <p className="text-slate-400 text-sm">No history yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${txTypeColor[tx.type]}`}>
                  {txTypeLabel[tx.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-600">
                    {tx.type === "STOCK_IN" && <span className="text-blue-600 font-semibold">+{tx.quantityChange}</span>}
                    {tx.type === "STOCK_OUT" && <span className="text-amber-600 font-semibold">-{tx.quantityChange}</span>}
                    {" "}by <span className="font-medium">{tx.performedBy}</span>
                  </div>
                  {tx.notes && <div className="text-xs text-slate-400 truncate">{tx.notes}</div>}
                </div>
                <div className="text-xs text-slate-400 shrink-0 text-right">
                  <div>{format(new Date(tx.timestamp), "dd MMM")}</div>
                  <div>{format(new Date(tx.timestamp), "HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock dialog */}
      <Dialog open={!!stockDialog} onOpenChange={() => setStockDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{stockDialog === "in" ? "Add Stock" : "Remove Stock"}</DialogTitle>
            <DialogDescription>
              Current quantity: {component.quantity}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Quantity <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="1"
                max={stockDialog === "out" ? component.quantity : undefined}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Your Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Who is doing this?" value={stockBy} onChange={(e) => setStockBy(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional reason" value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStockDialog(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleStock}
                disabled={loading}
                className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${stockDialog === "in" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                {loading ? "Saving..." : stockDialog === "in" ? "Add Stock" : "Remove Stock"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {deleteDialog === "hard" ? "Delete Component" : "Clear All Stock"}
            </DialogTitle>
            <DialogDescription>
              {deleteDialog === "hard"
                ? "This permanently removes the component from the database. This cannot be undone."
                : `This will set the stock of "${component.name}" to 0 and log it. The component remains in the database.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Your Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Who is doing this?" value={deleteBy} onChange={(e) => setDeleteBy(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteDialog(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading ? "..." : deleteDialog === "hard" ? "Delete Forever" : "Clear Stock"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
