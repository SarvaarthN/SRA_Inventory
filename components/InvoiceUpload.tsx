"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Loader2,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { CategoryDef, InvoiceItem, InvoiceResultItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditableItem = InvoiceItem & { key: string };

let itemSeq = 0;
const nextKey = () => `item-${++itemSeq}`;

const resultBorder = (type: InvoiceResultItem["type"]) => {
  if (type === "error") return "border-l-red-300 bg-red-50/70";
  if (type === "box") return "border-l-blue-300 bg-blue-50/50";
  return "border-l-green-300 bg-green-50/50";
};

const ResultIcon = ({ type }: { type: InvoiceResultItem["type"] }) => {
  if (type === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px" />;
  return <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-px" />;
};

export default function InvoiceUpload() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");

  const [file, setFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [parsing, setParsing] = useState(false);

  const [items, setItems] = useState<EditableItem[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [committing, setCommitting] = useState(false);
  const [results, setResults] = useState<InvoiceResultItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && categories.length === 0) {
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data: CategoryDef[]) => setCategories(data))
        .catch(() => {});
    }
  }, [open, categories.length]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setCompanyName("");
    setLocation("");
    setItems([]);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleParse = async () => {
    if (!file) {
      toast.error("Choose an invoice photo, scan or PDF");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Enter the vendor/company name");
      return;
    }
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/invoices/parse", { method: "POST", body: form });
      const data = await res.json() as { items?: InvoiceItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to read invoice");
      const parsedItems = data.items ?? [];
      if (!parsedItems.length) {
        toast.error(data.error ?? "No items were found on that invoice");
        return;
      }
      setItems(parsedItems.map((it) => ({ ...it, key: nextKey() })));
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read invoice");
    } finally {
      setParsing(false);
    }
  };

  const updateItem = (key: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: nextKey(), name: "", category: "MISC", quantity: 1, description: "" },
    ]);
  };

  const handleCommit = async () => {
    const valid = items
      .filter((it) => it.name.trim().length > 0 && Number(it.quantity) > 0)
      .map((it) => ({
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        description: it.description,
      }));
    if (!valid.length) {
      toast.error("Add at least one item with a name and quantity");
      return;
    }
    setCommitting(true);
    try {
      const res = await fetch("/api/invoices/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          location: location.trim(),
          items: valid,
        }),
      });
      const data = await res.json() as { results?: InvoiceResultItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add to inventory");
      setResults(data.results ?? []);
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add to inventory");
    } finally {
      setCommitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const previewBoxName = `${companyName.trim() || "Company"}_${today}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Upload Invoice</span>
        <span className="sm:hidden">Invoice</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            {step === "upload" && "Upload Invoice"}
            {step === "review" && "Review Items"}
            {step === "done" && "Added to Inventory"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a photo, scan or PDF of the invoice. Every item on it is added as a new
              component in a new box named after the vendor and today&rsquo;s date.
            </p>
            <div className="space-y-1.5">
              <Label>Invoice File <span className="text-red-500">*</span></Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm file:font-medium hover:file:bg-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor / Company Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Robu.in"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Box Location</Label>
              <Input
                placeholder="Optional, e.g. Cabinet 3, Shelf 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            {companyName.trim() && (
              <p className="text-xs text-slate-400">
                New box will be named{" "}
                <span className="font-mono text-slate-600">{previewBoxName}</span>
              </p>
            )}
            <button
              onClick={handleParse}
              disabled={parsing}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {parsing ? "Reading invoice..." : "Parse Invoice"}
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-500">
              Box <span className="font-mono text-slate-700">{previewBoxName}</span> will be
              created with these {items.length} item{items.length === 1 ? "" : "s"}. Fix anything
              the AI misread before adding.
            </p>

            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="border border-slate-200 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Item name"
                      value={it.name}
                      onChange={(e) => updateItem(it.key, { name: e.target.value })}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeItem(it.key)}
                      className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={it.category}
                      onChange={(e) => updateItem(it.key, { category: e.target.value })}
                      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-slate-700 outline-none focus-visible:border-ring"
                    >
                      {categories.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                      className="w-20"
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={it.description}
                      onChange={(e) => updateItem(it.key, { description: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addItem}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus className="w-3 h-3" />
              Add missing item
            </button>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {committing ? "Adding..." : "Add to Inventory"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className={cn("border-l-4 rounded-r-lg px-3 py-2", resultBorder(r.type))}>
                  <div className="flex items-start gap-1.5">
                    <ResultIcon type={r.type} />
                    <span className="text-xs font-medium text-slate-700 leading-5">{r.message}</span>
                  </div>
                  {r.sub && <p className="text-[10px] text-slate-500 font-mono pl-5 mt-0.5">{r.sub}</p>}
                </div>
              ))}
            </div>
            <button
              onClick={reset}
              className="w-full py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
            >
              Upload Another
            </button>
          </div>
        )}
      </DialogContent>
      </Dialog>
    </>
  );
}
