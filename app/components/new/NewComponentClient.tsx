"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CategoryDef, COLOR_OPTIONS, Component, Box } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Package2, Plus, ArrowLeft, Tag, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function NewComponentClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"search" | "create">("search");
  const [loading, setLoading] = useState(false);

  // Categories
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  // Search mode
  const [searchQ, setSearchQ] = useState("");
  const debouncedSearch = useDebounce(searchQ, 250);
  const [suggestions, setSuggestions] = useState<Component[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  // Shared fields
  const [qty, setQty] = useState("1");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");

  // Box search
  const [boxSearch, setBoxSearch] = useState("");
  const debouncedBox = useDebounce(boxSearch, 250);
  const [boxSuggestions, setBoxSuggestions] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [showBoxDropdown, setShowBoxDropdown] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [description, setDescription] = useState("");
  const [initialStock, setInitialStock] = useState("0");

  // New category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[0].value);
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryDef[]) => { setCategories(data); setCatLoading(false); })
      .catch(() => setCatLoading(false));
  }, []);

  useEffect(() => {
    if (!debouncedSearch.trim()) { setSuggestions([]); return; }
    fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}&type=components`)
      .then((r) => r.json()).then(setSuggestions).catch(() => {});
  }, [debouncedSearch]);

  useEffect(() => {
    if (!debouncedBox.trim()) { setBoxSuggestions([]); return; }
    fetch(`/api/search?q=${encodeURIComponent(debouncedBox)}&type=boxes`)
      .then((r) => r.json()).then(setBoxSuggestions).catch(() => {});
  }, [debouncedBox]);

  const handleSelectComponent = (c: Component) => {
    setSelectedComponent(c);
    setSearchQ(c.name);
    setSuggestions([]);
    if (c.boxId) {
      setBoxSearch(c.boxName ?? "");
      setSelectedBox({ id: c.boxId, name: c.boxName ?? "", location: "", createdBy: "", createdAt: "", boxType: "GENERAL" });
    }
  };

  const handleSelectBox = (b: Box) => {
    setSelectedBox(b);
    setBoxSearch(`${b.name} (${b.id})`);
    setBoxSuggestions([]);
    setShowBoxDropdown(false);
  };

  const handleCreateCategory = async () => {
    if (!newCatCode.trim() || !newCatLabel.trim()) {
      toast.error("Code and label are required");
      return;
    }
    setCatSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCatCode.trim(), label: newCatLabel.trim(), color: newCatColor }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created: CategoryDef = await res.json();
      setCategories((prev) => [...prev, created]);
      setCategory(created);
      setCatDialog(false);
      setNewCatCode("");
      setNewCatLabel("");
      setNewCatColor(COLOR_OPTIONS[0].value);
      toast.success(`Category "${created.label}" created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCatSaving(false);
    }
  };

  const handleAddToExisting = async () => {
    if (!selectedComponent || !performedBy.trim()) {
      toast.error("Select a component and enter your name");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(selectedComponent.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "STOCK_IN",
          quantity: Number(qty),
          performedBy: performedBy.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Added ${qty} units to ${selectedComponent.name}`);
      router.push(`/components/${encodeURIComponent(selectedComponent.id)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !category || !performedBy.trim()) {
      toast.error("Name, category and your name are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.code,
          categoryLabel: category.label,
          categoryColor: category.color,
          description: description.trim(),
          quantity: Number(initialStock),
          initialStock: Number(initialStock),
          boxId: selectedBox?.id ?? "",
          boxName: selectedBox?.name ?? "",
          addedBy: performedBy.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created: Component = await res.json();
      toast.success(`Created ${created.id}`);
      router.push(`/components/${encodeURIComponent(created.id)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/components" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add Component</h1>
          <p className="text-slate-500 text-sm">Search existing or create new</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
        <button
          onClick={() => setMode("search")}
          className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-colors",
            mode === "search" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          Add to Existing
        </button>
        <button
          onClick={() => setMode("create")}
          className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-colors",
            mode === "create" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          Create New
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {mode === "search" ? (
          <div className="space-y-1.5">
            <Label>Search Component</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Type component name or part number..."
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setSelectedComponent(null); }}
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {suggestions.map((c) => (
                    <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      onClick={() => handleSelectComponent(c)}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{c.id}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">Qty: {c.quantity}{c.boxName && ` · ${c.boxName}`}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedComponent && (
              <div className="flex items-center gap-2 mt-2 p-2.5 bg-indigo-50 rounded-lg">
                <Package2 className="w-4 h-4 text-indigo-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-indigo-800">{selectedComponent.name}</div>
                  <div className="text-xs text-indigo-500 font-mono">{selectedComponent.id} · Current stock: {selectedComponent.quantity}</div>
                </div>
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              <Label>Quantity to Add <span className="text-red-500">*</span></Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Component Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. DHT11 Temperature Sensor" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* Category selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category <span className="text-red-500">*</span></Label>
                <button
                  onClick={() => setCatDialog(true)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  New Category
                </button>
              </div>
              {catLoading ? (
                <div className="text-sm text-slate-400">Loading categories...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.code}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "text-left px-3 py-2 rounded-lg border text-sm transition-colors",
                        category?.code === cat.code
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", cat.color.split(" ").find(c => c.startsWith("bg-"))?.replace("100", "400") ?? "bg-gray-400")} />
                        <span>{cat.label}</span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">{cat.code}/</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label>Initial Stock Quantity</Label>
              <Input type="number" min="0" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
            </div>
          </>
        )}

        {/* Box search — shared */}
        <div className="space-y-1.5">
          <Label>Storage Box</Label>
          <div className="relative">
            <Input
              placeholder="Search or type box name..."
              value={boxSearch}
              onChange={(e) => { setBoxSearch(e.target.value); setSelectedBox(null); setShowBoxDropdown(true); }}
              onFocus={() => setShowBoxDropdown(true)}
            />
            {showBoxDropdown && boxSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                {boxSuggestions.map((b) => (
                  <button key={b.id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    onClick={() => handleSelectBox(b)}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{b.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{b.id}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{b.location}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedBox?.id && (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <span className="font-mono">{selectedBox.id}</span>
              <span>·</span>
              <span>{selectedBox.location}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">
            No box?{" "}
            <Link href="/boxes/new" className="text-indigo-600 hover:underline">Create one first</Link>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Your Name <span className="text-red-500">*</span></Label>
          <Input placeholder="Who is adding this?" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button
          onClick={mode === "search" ? handleAddToExisting : handleCreate}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? "Saving..." : mode === "search" ? "Add to Stock" : "Create Component"}
        </button>
      </div>

      {/* New category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              New Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Category Code <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. BATT, RF, IC (max 6 chars)"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              />
              {newCatCode && (
                <p className="text-xs text-slate-500">
                  Part numbers will look like: <span className="font-mono font-medium">{newCatCode}/{new Date().getFullYear()}/001</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Label <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Batteries, RF Modules" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNewCatColor(opt.value)}
                    title={opt.label}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all",
                      opt.dot,
                      newCatColor === opt.value ? "border-slate-700 scale-110" : "border-transparent hover:border-slate-300"
                    )}
                  />
                ))}
              </div>
              <div className={cn("text-xs font-medium px-2 py-0.5 rounded-full border w-fit mt-1", newCatColor)}>
                {newCatLabel || "Preview"}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCatDialog(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={catSaving}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {catSaving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
