"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DeleteBoxButton({ id, hasComponents }: { id: string; hasComponents: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (hasComponents) {
    return (
      <button
        disabled
        title="Remove all components from this box before deleting"
        className="flex items-center gap-1.5 text-sm text-slate-300 cursor-not-allowed"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Are you sure?</span>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`/api/boxes/${id}`, { method: "DELETE" });
              if (!res.ok) throw new Error((await res.json()).error);
              toast.success("Box deleted");
              router.push("/boxes");
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Failed to delete");
              setConfirming(false);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      Delete
    </button>
  );
}
