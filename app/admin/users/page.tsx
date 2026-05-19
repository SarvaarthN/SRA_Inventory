"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Trash2, Plus, Eye, EyeOff, ShieldCheck } from "lucide-react";

type UserRow = {
  internalId: string;
  name: string;
  userId: string;
  year: string;
  isAdmin: string;
  createdAt: string;
};

const YEAR_COLORS: Record<string, string> = {
  SY: "bg-slate-100 text-slate-600 border-slate-200",
  TY: "bg-blue-100 text-blue-700 border-blue-200",
  LY: "bg-green-100 text-green-700 border-green-200",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [year, setYear] = useState("TY");
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId.trim() || !password || !year) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), userId: userId.trim(), password, year, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`User ${data.userId} created`);
      setName(""); setUserId(""); setPassword(""); setYear("TY"); setIsAdmin(false);
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, uName: string) => {
    if (!confirm(`Delete user "${uName}" (${id})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.userId !== id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">User Management</h1>
          <p className="text-slate-500 text-sm">{users.length} registered users</p>
        </div>
      </div>

      {/* User table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No users yet</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">ID</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">User ID</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Year</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{u.internalId}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-700">{u.name}</span>
                          {u.isAdmin === "true" && (
                            <span title="Admin"><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /></span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{u.userId}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${YEAR_COLORS[u.year] ?? YEAR_COLORS.SY}`}>
                          {u.year}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(u.userId, u.name)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.userId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-700">{u.name}</span>
                      {u.isAdmin === "true" && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{u.userId} · {u.internalId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${YEAR_COLORS[u.year] ?? YEAR_COLORS.SY}`}>
                      {u.year}
                    </span>
                    <button onClick={() => handleDelete(u.userId, u.name)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create user form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add New User
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Rahul Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>User ID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. rahul (login username)"
                value={userId}
                onChange={(e) => setUserId(e.target.value.toLowerCase().replace(/\s/g, ""))}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Year <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                {(["SY", "TY", "LY"] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      year === y
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Grant admin access (can manage users)</span>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
}
