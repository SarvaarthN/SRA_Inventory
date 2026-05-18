"use client";
import { useState, useEffect } from "react";
import { CategoryDef, COLOR_OPTIONS } from "@/lib/types";
import { toast } from "sonner";
import { Plus, Tag, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryDef[]) => { setCategories(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), label: label.trim(), color }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created: CategoryDef = await res.json();
      setCategories((prev) => [...prev, created]);
      setCode("");
      setLabel("");
      setColor(COLOR_OPTIONS[0].value);
      toast.success(`Category "${created.label}" created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage component categories and their part number codes</p>
      </div>

      {/* Existing categories */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">All Categories</h2>
          <span className="text-xs text-slate-400">{categories.length} categories</span>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.code} className="flex items-center gap-4 px-5 py-3">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border w-28 text-center", cat.color)}>
                  {cat.label}
                </span>
                <code className="text-sm font-mono text-slate-500 flex-1">{cat.code}/YEAR/###</code>
                {cat.isDefault === "true" ? (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Lock className="w-3 h-3" />
                    Default
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Custom</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new category form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-600" />
          Add New Category
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Category Code <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. BATT, RF, IC"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Label <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Batteries"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        {code && (
          <p className="text-xs text-slate-500 -mt-2">
            Part numbers will look like: <span className="font-mono font-medium">{code}/{new Date().getFullYear()}/001</span>
          </p>
        )}

        <div className="space-y-2">
          <Label>Badge Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setColor(opt.value)}
                title={opt.label}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-all",
                  opt.dot,
                  color === opt.value ? "border-slate-700 scale-110" : "border-transparent hover:border-slate-300"
                )}
              />
            ))}
          </div>
          <div className={cn("text-xs font-medium px-2.5 py-1 rounded-full border w-fit", color)}>
            {label || "Preview"}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          <Tag className="w-4 h-4" />
          {saving ? "Creating..." : "Create Category"}
        </button>
      </div>
    </div>
  );
}
