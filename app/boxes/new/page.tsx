"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Box, Plus } from "lucide-react";
import Link from "next/link";

export default function NewBoxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [createdBy, setCreatedBy] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || !location.trim() || !createdBy.trim()) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), location: location.trim(), createdBy: createdBy.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const box = await res.json();
      toast.success(`Box ${box.id} created`);
      router.push("/boxes");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/boxes" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Box</h1>
          <p className="text-slate-500 text-sm">Create a new storage box</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-center w-12 h-12 bg-purple-50 rounded-xl mx-auto">
          <Box className="w-6 h-6 text-purple-600" />
        </div>

        <div className="space-y-1.5">
          <Label>Box Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="e.g. Electronics Box A, Sensor Storage"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Location <span className="text-red-500">*</span></Label>
          <Input
            placeholder="e.g. Shelf 3, Room 201 / Lab Cabinet B"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Your Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Who is creating this box?"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? "Creating..." : "Create Box"}
        </button>
      </div>
    </div>
  );
}
