import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SRA Inventory",
  description: "Club inventory management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-slate-50 min-h-screen`}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
