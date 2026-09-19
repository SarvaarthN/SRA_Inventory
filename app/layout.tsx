import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NavbarWrapper from "@/components/NavbarWrapper";
import QuickAdd from "@/components/QuickAdd";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SRA Inventory",
  description: "Club inventory management system",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className={`${geist.className} min-h-screen`} style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)" }}>
        <NavbarWrapper session={session} />
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6">{children}</main>
        {/* Natural-language entry. Hidden from read-only SY members, and the
            /api/chat route enforces the same rule server-side. */}
        {canWrite(session) && <QuickAdd />}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
