"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package2, Box, History, LayoutDashboard, Download, Tag, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stock", label: "Check In/Out", icon: ArrowLeftRight },
  { href: "/components", label: "Components", icon: Package2 },
  { href: "/boxes", label: "Boxes", icon: Box },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/transactions", label: "History", icon: History },
];

export default function Navbar() {
  const path = usePathname();

  const handleExport = () => {
    window.open("/api/export", "_blank");
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-800">
              <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                <Package2 className="w-4 h-4 text-white" />
              </div>
              <span>SRA Inventory</span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map(({ href, label, icon: Icon }) => (
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
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
    </header>
  );
}
