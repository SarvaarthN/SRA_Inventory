"use client";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import { SessionPayload } from "@/lib/session";

const NO_NAV_PATHS = ["/login", "/setup"];

export default function NavbarWrapper({ session }: { session: SessionPayload | null }) {
  const path = usePathname();
  if (NO_NAV_PATHS.includes(path)) return null;
  return <Navbar session={session} />;
}
