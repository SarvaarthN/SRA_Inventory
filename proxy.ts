import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/setup"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Let API routes handle their own auth
  if (path.startsWith("/api/")) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptToken(token);

  // No session → redirect to login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  // Has session → don't stay on login/setup
  if (session && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Admin-only route guard
  if (session && path.startsWith("/admin") && !session.isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
