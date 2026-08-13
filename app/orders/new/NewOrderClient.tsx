"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Truck } from "lucide-react";
import { CategoryDef, OrderItem } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import OrderItemRow from "./OrderItemRow";

const emptyItem = (): OrderItem => ({
  componentId: "",
  name: "",
  category: "",
  categoryLabel: "",
  categoryColor: "",
  quantity: 1,
  boxId: "",
  boxName: "",
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewOrderClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryDef[]>([]);

  const [vendor, setVendor] = useState("");
  const [vendorUrl, setVendorUrl] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderedAt, setOrderedAt] = useState(today());
  const [expectedAt, setExpectedAt] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [orderedBy, setOrderedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!vendor.trim() || !orderedBy.trim()) {
      toast.error("Vendor and your name are required");
      return;
    }
    for (const [i, item] of items.entries()) {
      if (!item.name.trim()) {
        toast.error(`Item ${i + 1} needs a component`);
        return;
      }
      if (!item.componentId && !item.category) {
        toast.error(`Item ${i + 1} is a new component, so it needs a category`);
        return;
      }
      if (!item.quantity || item.quantity < 1) {
        toast.error(`Item ${i + 1} needs a quantity of at least 1`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor.trim(),
          vendorUrl: vendorUrl.trim(),
          orderNumber: orderNumber.trim(),
          orderedAt,
          expectedAt,
          totalCost: totalCost.trim(),
          notes: notes.trim(),
          orderedBy: orderedBy.trim(),
          items,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const order = await res.json();
      toast.success(`Order ${order.id} logged`);
      router.refresh();
      router.push(`/orders/${order.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Order</h1>
          <p className="text-slate-500 text-sm">Log what was ordered and from where</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl mx-auto bg-blue-50">
          <Truck className="w-6 h-6 text-blue-600" />
        </div>

        <div className="space-y-1.5">
          <Label>Vendor <span className="text-red-500">*</span></Label>
          <Input
            placeholder="e.g. Robu.in, Amazon, ElectronicsComp"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Vendor Link</Label>
          <Input
            placeholder="https://..."
            value={vendorUrl}
            onChange={(e) => setVendorUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Order Number</Label>
          <Input
            placeholder="The vendor's order reference"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Ordered On</Label>
            <Input type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Delivery</Label>
            <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Total Cost</Label>
          <Input
            placeholder="e.g. 1450"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Your Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Who placed this order?"
            value={orderedBy}
            onChange={(e) => setOrderedBy(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            placeholder="Optional notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">
            Items ({items.length})
          </h2>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus className="w-3 h-3" />
            Add Item
          </button>
        </div>

        {items.map((item, i) => (
          <OrderItemRow
            key={i}
            index={i}
            item={item}
            categories={categories}
            canRemove={items.length > 1}
            onChange={(patch) => updateItem(i, patch)}
            onRemove={() => removeItem(i)}
          />
        ))}
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        {loading ? "Saving..." : "Log Order"}
      </button>
    </div>
  );
}
