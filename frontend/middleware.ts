import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get("prelegal_session")?.value);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionExists = hasSession(request);

  if (pathname.startsWith("/app") && !sessionExists) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && sessionExists) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
