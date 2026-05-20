"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package2, Mail, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Welcome back, ${data.user.name}!`);
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50/50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-100 animate-pulse">
            <Package2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SRA Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">Society of Robotics and Automation</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold text-xs tracking-wider uppercase">Gmail Address</Label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="enter-your-gmail@sra.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="pl-10 h-11"
                  autoFocus
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 shadow-sm active:scale-[0.98]"
            >
              {loading ? "Verifying..." : "Access Catalog"}
            </button>
          </form>

          <div className="flex gap-2.5 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
            <ShieldAlert className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-950 font-medium leading-relaxed">
              <strong>Admin Note:</strong> To grant a member access, simply add their Gmail and Role to your <strong>Users</strong> Google Sheet. Passwordless access is instant!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
