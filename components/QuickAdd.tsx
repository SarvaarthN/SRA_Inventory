"use client";
import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ResultItem = {
  type: "box" | "component_new" | "stock" | "error";
  message: string;
  sub?: string;
  id?: string;
};

type Message =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "loading" }
  | { id: string; kind: "result"; results: ResultItem[] };

const resultBorder = (type: ResultItem["type"]) => {
  if (type === "error") return "border-l-red-300 bg-red-50/70";
  if (type === "box") return "border-l-blue-300 bg-blue-50/50";
  if (type === "stock") return "border-l-indigo-300 bg-indigo-50/50";
  return "border-l-green-300 bg-green-50/50";
};

const ResultIcon = ({ type }: { type: ResultItem["type"] }) => {
  if (type === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px" />;
  return <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-px" />;
};

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, kind: "user", text },
      { id: `l-${Date.now()}`, kind: "loading" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { results?: ResultItem[]; error?: string };
      const results: ResultItem[] = data.results ?? [{ type: "error", message: data.error ?? "Something went wrong" }];
      setMessages((prev) => [
        ...prev.filter((m) => m.kind !== "loading"),
        { id: `r-${Date.now()}`, kind: "result", results },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.kind !== "loading"),
        { id: `e-${Date.now()}`, kind: "result", results: [{ type: "error", message: "Network error", sub: "Check your connection" }] },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed z-[60] flex flex-col bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden"
          style={{
            bottom: "76px",
            right: "1rem",
            width: "min(calc(100vw - 2rem), 22rem)",
            maxHeight: "min(65vh, 520px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-slate-800">Quick Add</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 mt-1">Describe what you received</p>
                <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                  e.g. &ldquo;15 HC-SR04 sensors in the Workbench box, 5 servo motors in Tools&rdquo;
                </p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.kind === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-slate-100 rounded-xl px-3 py-2 max-w-[85%]">
                      <p className="text-sm text-slate-700 break-words">{msg.text}</p>
                    </div>
                  </div>
                );
              }
              if (msg.kind === "loading") {
                return (
                  <div key={msg.id} className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Processing&hellip;</span>
                  </div>
                );
              }
              if (msg.kind === "result") {
                return (
                  <div key={msg.id} className="space-y-1.5">
                    {msg.results.map((r, i) => (
                      <div
                        key={i}
                        className={cn("border-l-4 rounded-r-lg px-3 py-2", resultBorder(r.type))}
                      >
                        <div className="flex items-start gap-1.5">
                          <ResultIcon type={r.type} />
                          <span className="text-xs font-medium text-slate-700 leading-5">{r.message}</span>
                        </div>
                        {r.sub && (
                          <p className="text-[10px] text-slate-500 font-mono pl-5 mt-0.5">{r.sub}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-100 px-3 py-2.5 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="What did you receive?"
              disabled={busy}
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none bg-transparent disabled:opacity-50 py-1"
            />
            <button
              onClick={send}
              disabled={!input.trim() || busy}
              className="shrink-0 w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[60] flex items-center gap-2 bg-white border border-slate-200 shadow-lg px-4 py-2.5 rounded-full text-sm font-medium text-slate-700 hover:shadow-xl hover:border-indigo-200 hover:text-indigo-700 transition-all"
          style={{ bottom: "76px", right: "1rem" }}
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Quick Add
        </button>
      )}
    </>
  );
}
