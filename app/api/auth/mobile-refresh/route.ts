// app/api/auth/mobile-refresh/route.ts
// Issues a fresh token if the provided token is still valid (not expired).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeToken, decodeToken } from "@/lib/mobileToken";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const bodyToken = await req.json().then(b => b?.token).catch(() => null);
    const token = (auth.startsWith("Bearer ") ? auth.slice(7) : null) ?? bodyToken;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401, headers: CORS });
    }
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: CORS });
    }
    if (Date.now() >= decoded.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 401, headers: CORS });
    }
    // Verify user still exists
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401, headers: CORS });
    }
    const fresh = makeToken(user.id, user.workspaceId, user.role);
    return NextResponse.json(
      {
        token: fresh.token,
        expiresAt: fresh.expiresAt,
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("Mobile refresh error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
