"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package2, Box, History, LayoutDashboard,
  Download, Tag, ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const allNav = [
  { href: "/", label: "Dashboard", short: "Home",    icon: LayoutDashboard },
  { href: "/stock",      label: "Check In/Out", short: "Check I/O", icon: ArrowLeftRight },
  { href: "/components", label: "Components",   short: "Parts",    icon: Package2 },
  { href: "/boxes",      label: "Boxes",        short: "Boxes",    icon: Box },
  { href: "/categories", label: "Categories",   short: null,       icon: Tag },
  { href: "/transactions", label: "History",    short: "History",  icon: History },
];

// Bottom mobile nav: skip Categories (less frequent)
const mobileNav = allNav.filter((n) => n.short !== null);

export default function Navbar() {
  const path = usePathname();

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
              </nav>
            </div>
            <button
              onClick={() => window.open("/api/export", "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar (logo only) ── */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50 sm:hidden">
        <div className="flex items-center justify-between px-4 h-13 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-800">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
              <Package2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">SRA Inventory</span>
          </Link>
          <button
            onClick={() => window.open("/api/export", "_blank")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
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
