import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // ── Handle CORS preflight for all API routes ───────────────────────────
    if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
      return new NextResponse(null, { status: 204, headers: CORS });
    }

    const token = req.nextauth.token;
    const role  = (token?.role as string) ?? "viewer";

    // ── Block operator / viewer from mutating users via API ─────────────────
    if (
      pathname.startsWith("/api/users") &&
      req.method !== "GET" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden — admin role required" },
        { status: 403, headers: CORS }
      );
    }

    // ── Block non-admins from deleting workspaces ───────────────────────────
    if (
      pathname.startsWith("/api/workspaces") &&
      req.method === "DELETE" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden — admin role required" },
        { status: 403, headers: CORS }
      );
    }

    // ── Add CORS headers to every API response ─────────────────────────────
    const response = NextResponse.next();
    if (pathname.startsWith("/api/")) {
      Object.entries(CORS).forEach(([k, v]) => response.headers.set(k, v));
    }
    return response;
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    pages:  { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        // Always allow OPTIONS preflights through
        if (req.method === "OPTIONS") return true;
        // Allow mobile Bearer token requests to all API routes
        if (pathname.startsWith("/api/")) {
          const auth = req.headers.get("authorization") ?? "";
          if (auth.startsWith("Bearer ")) return true;
        }
        // Fall back to NextAuth session for web app
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|register|portal|api/auth|api/register|api/portal|_next/static|_next/image|favicon.ico).*)",
  ],
};
