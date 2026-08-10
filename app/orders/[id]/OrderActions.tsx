"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Order } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [saving, setSaving] = useState(false);

  const patch = async (action: "RECEIVE" | "CANCEL", performedBy: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, performedBy }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(
        action === "RECEIVE"
          ? "Order received, stock updated"
          : "Order cancelled"
      );
      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = () => {
    if (!receivedBy.trim()) {
      toast.error("Enter your name");
      return;
    }
    patch("RECEIVE", receivedBy.trim());
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <PackageCheck className="w-4 h-4" />
          Mark Received
        </button>
        <button
          onClick={() => patch("CANCEL", "")}
          disabled={saving}
          className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          <X className="w-4 h-4" />
          Cancel Order
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              Mark as Received
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="text-sm text-slate-600 space-y-2">
              <p>This will update the inventory right away:</p>
              <ul className="space-y-1">
                {order.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-slate-400 shrink-0">{item.quantity}x</span>
                    <span className="flex-1">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-400">
                        {item.componentId
                          ? ` stock goes up by ${item.quantity}`
                          : " will be created as a new component"}
                        {item.boxName && ` in ${item.boxName}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label>Your Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Who received this?"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {saving ? "Receiving..." : "Confirm"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
