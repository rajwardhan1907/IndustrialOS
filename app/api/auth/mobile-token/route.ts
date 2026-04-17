// app/api/auth/mobile-token/route.ts
// Mobile login: returns a base64-encoded token with embedded expiry.
// Token format: base64(userId|workspaceId|role|issuedAt|expiresAt)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function makeToken(userId: string, workspaceId: string, role: string): { token: string; expiresAt: number } {
  const now = Date.now();
  const exp = now + TOKEN_TTL_MS;
  const payload = `${userId}|${workspaceId}|${role}|${now}|${exp}`;
  return { token: Buffer.from(payload).toString("base64"), expiresAt: exp };
}

export function decodeToken(token: string): { userId: string; workspaceId: string; role: string; issuedAt: number; expiresAt: number } | null {
  try {
    const raw = Buffer.from(token, "base64").toString("utf8");
    const parts = raw.split("|");
    if (parts.length < 5) return null;
    const [userId, workspaceId, role, issuedAtStr, expiresAtStr] = parts;
    const issuedAt = Number(issuedAtStr);
    const expiresAt = Number(expiresAtStr);
    if (!userId || !workspaceId || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    return { userId, workspaceId, role, issuedAt, expiresAt };
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400, headers: CORS });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: CORS });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: CORS });
    }

    const { token, expiresAt } = makeToken(user.id, user.workspaceId, user.role);

    return NextResponse.json(
      {
        token,
        expiresAt,
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("Mobile token error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
