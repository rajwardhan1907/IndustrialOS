import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = (token?.role as string) ?? "viewer";

    // ── Block operator / viewer from mutating users via API ─────────────────
    // GET is fine — they can see who's in the workspace.
    // POST (invite), PATCH (change role), DELETE (remove) are admin-only.
    if (
      pathname.startsWith("/api/users") &&
      req.method !== "GET" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden — admin role required" },
        { status: 403 }
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
        { status: 403 }
      );
    }

    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    pages:  { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|register|portal|api/auth|api/register|api/portal|_next/static|_next/image|favicon.ico).*)",
  ],
};
