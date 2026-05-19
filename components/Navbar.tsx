"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Package2, Box, History, LayoutDashboard,
  Download, Tag, ArrowLeftRight, Users, LogOut, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionPayload } from "@/lib/session";
import { toast } from "sonner";

const allNav = [
  { href: "/",           label: "Dashboard",  short: "Home",    icon: LayoutDashboard },
  { href: "/stock",      label: "Check In/Out", short: "Check I/O", icon: ArrowLeftRight },
  { href: "/components", label: "Components", short: "Parts",   icon: Package2 },
  { href: "/boxes",      label: "Boxes",      short: "Boxes",   icon: Box },
  { href: "/categories", label: "Categories", short: null,      icon: Tag },
  { href: "/transactions", label: "History",  short: "History", icon: History },
];

const mobileNav = allNav.filter((n) => n.short !== null);

const YEAR_BADGE: Record<string, string> = {
  SY: "bg-slate-100 text-slate-600",
  TY: "bg-blue-100 text-blue-700",
  LY: "bg-green-100 text-green-700",
};

export default function Navbar({ session }: { session: SessionPayload | null }) {
  const path = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* ── Desktop top bar ── */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-50 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-5">
              <Link href="/" className="flex items-center gap-2 font-semibold text-slate-800 shrink-0">
                <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                  <Package2 className="w-4 h-4 text-white" />
                </div>
                <span>SRA Inventory</span>
              </Link>
              <nav className="flex items-center gap-0.5">
                {allNav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      path === href
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
                {session?.isAdmin && (
                  <Link
                    href="/admin/users"
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      path.startsWith("/admin")
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    )}
                  >
                    <Users className="w-4 h-4" />
                    Users
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open("/api/export", "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              {session && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-700">{session.name}</span>
                      {session.isAdmin && <span title="Admin"><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /></span>}
                    </div>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", YEAR_BADGE[session.year] ?? YEAR_BADGE.SY)}>
                      {session.year}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ── */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50 sm:hidden">
        <div className="flex items-center justify-between px-4 h-13 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-800">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
              <Package2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">SRA Inventory</span>
          </Link>
          <div className="flex items-center gap-2">
            {session && (
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", YEAR_BADGE[session.year] ?? YEAR_BADGE.SY)}>
                  {session.year}
                </span>
                <span className="text-xs font-medium text-slate-600 max-w-[80px] truncate">{session.name.split(" ")[0]}</span>
                <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={() => window.open("/api/export", "_blank")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="flex">
          {mobileNav.map(({ href, short, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-700"
                )}
              >
                <Icon className={cn("w-5 h-5", active && "scale-110 transition-transform")} />
                <span className="text-[10px] font-medium leading-none">{short}</span>
                {active && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-indigo-500 rounded-t-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
