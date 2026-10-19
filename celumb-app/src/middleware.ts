import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { peekSessionCookie, SESSION_COOKIE } from "@/lib/auth-edge";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login + Next internals
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    const session = peekSessionCookie(request.headers.get("cookie"));
    if (pathname.startsWith("/login") && session) {
      const dest = session.role === "ventas" ? "/inventario" : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  const session =
    peekSessionCookie(request.headers.get("cookie")) ||
    (request.cookies.get(SESSION_COOKIE)?.value
      ? peekSessionCookie(`${SESSION_COOKIE}=${request.cookies.get(SESSION_COOKIE)!.value}`)
      : null);

  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (session.role === "ventas" && !ventasPathAllowed(pathname)) {
    return NextResponse.redirect(new URL("/inventario", request.url), 303);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-celumb-role", session.role);
  requestHeaders.set("x-celumb-user", session.username);
  requestHeaders.set("x-celumb-path", pathname);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/** Ventas may open stock and download phone photos. Nothing else. */
function ventasPathAllowed(pathname: string): boolean {
  if (pathname === "/inventario") return true;
  if (pathname.startsWith("/inventario/editar")) return false;
  if (pathname.startsWith("/inventario/")) return true;
  if (pathname.startsWith("/api/phone-photos/upload")) return false;
  if (pathname.startsWith("/api/phone-photos")) return true;
  return false;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
