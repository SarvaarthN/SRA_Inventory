"use client";
import { useState, useEffect } from "react";
import { CategoryDef, Component, Box, OrderItem } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Trash2, Package2 } from "lucide-react";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function OrderItemRow({
  index,
  item,
  categories,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  item: OrderItem;
  categories: CategoryDef[];
  canRemove: boolean;
  onChange: (patch: Partial<OrderItem>) => void;
  onRemove: () => void;
}) {
  // "existing" tops up a part we already stock, "new" creates it on receive.
  const isNew = !item.componentId;
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const [nameQuery, setNameQuery] = useState(item.name);
  const debouncedName = useDebounce(nameQuery, 250);
  const [suggestions, setSuggestions] = useState<Component[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [boxSearch, setBoxSearch] = useState(item.boxName);
  const debouncedBox = useDebounce(boxSearch, 250);
  const [boxSuggestions, setBoxSuggestions] = useState<Box[]>([]);
  const [showBoxes, setShowBoxes] = useState(false);

  useEffect(() => {
    if (mode !== "existing" || !debouncedName.trim()) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(debouncedName)}&type=components`)
      .then((r) => r.json())
      .then(setSuggestions)
      .catch(() => {});
  }, [debouncedName, mode]);

  useEffect(() => {
    if (!debouncedBox.trim()) {
      setBoxSuggestions([]);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(debouncedBox)}&type=boxes`)
      .then((r) => r.json())
      .then(setBoxSuggestions)
      .catch(() => {});
  }, [debouncedBox]);

  const switchMode = (next: "existing" | "new") => {
    setMode(next);
    setNameQuery("");
    setSuggestions([]);
    // Clearing componentId is what tells the API to create rather than top up.
    onChange({ componentId: "", name: "", category: "", categoryLabel: "", categoryColor: "" });
  };

  const pickComponent = (c: Component) => {
    setNameQuery(c.name);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({
      componentId: c.id,
      name: c.name,
      category: c.category,
      categoryLabel: c.categoryLabel ?? "",
      categoryColor: c.categoryColor ?? "",
      // Default the destination to where this part already lives.
      ...(c.boxId && !item.boxId ? { boxId: c.boxId, boxName: c.boxName ?? "" } : {}),
    });
    if (c.boxId && !item.boxId) setBoxSearch(c.boxName ?? "");
  };

  const pickBox = (b: Box) => {
    setBoxSearch(`${b.name} (${b.id})`);
    setBoxSuggestions([]);
    setShowBoxes(false);
    onChange({ boxId: b.id, boxName: b.name });
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-600 transition-colors"
            title="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
        <button
          type="button"
          onClick={() => switchMode("existing")}
          className={cn(
            "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "existing" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Existing Component
        </button>
        <button
          type="button"
          onClick={() => switchMode("new")}
          className={cn(
            "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "new" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          New Component
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1.5">
          <Label>Search Component <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Type a component name or part number..."
              value={nameQuery}
              onChange={(e) => {
                setNameQuery(e.target.value);
                setShowSuggestions(true);
                onChange({ componentId: "", name: e.target.value });
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    onClick={() => pickComponent(c)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{c.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{c.id}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Qty: {c.quantity}
                      {c.boxName && ` · ${c.boxName}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {item.componentId ? (
            <div className="flex items-center gap-2 mt-2 p-2.5 bg-indigo-50 rounded-lg">
              <Package2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-indigo-800 truncate">{item.name}</div>
                <div className="text-xs text-indigo-500 font-mono">{item.componentId}</div>
              </div>
            </div>
          ) : (
            nameQuery.trim() && (
              <p className="text-xs text-amber-600">
                Pick one from the list, or switch to New Component to create it.
              </p>
            )
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Component Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. BMI160 IMU"
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value, componentId: "" })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() =>
                    onChange({
                      category: cat.code,
                      categoryLabel: cat.label,
                      categoryColor: cat.color,
                    })
                  }
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border text-sm transition-colors bg-white",
                    item.category === cat.code
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        cat.color.split(" ").find((c) => c.startsWith("bg-"))?.replace("100", "400") ??
                          "bg-gray-400"
                      )}
                    />
                    <span>{cat.label}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">{cat.code}/</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              The part number is generated when the order is received.
            </p>
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Qty <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Goes Into Box</Label>
          <div className="relative">
            <Input
              placeholder="Search box..."
              value={boxSearch}
              onChange={(e) => {
                setBoxSearch(e.target.value);
                setShowBoxes(true);
                onChange({ boxId: "", boxName: "" });
              }}
              onFocus={() => setShowBoxes(true)}
            />
            {showBoxes && boxSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {boxSuggestions.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    onClick={() => pickBox(b)}
                  >
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
        </div>
      </div>
      {isNew && !item.boxId && (
        <p className="text-xs text-slate-400">
          Optional. Leave it blank if you'll decide once it arrives, then assign
          the box from the component page.
        </p>
      )}
    </div>
  );
}
