import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("continuum_auth_token")?.value;
  const pathname = request.nextUrl.pathname;

  // Protect /dashboard and other authenticated app routes
  if (!token && pathname.startsWith("/dashboard")) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // Cookie presence alone does not prove a session is valid. Leave auth pages
  // reachable so a stale cookie cannot trap someone in a redirect loop.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - static image formats
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
