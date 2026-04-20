// app/api/auth/mobile-token/route.ts
// Mobile login: returns a base64-encoded token with embedded expiry.
// Token helpers live in lib/mobileToken.ts (App Router routes only allow
// GET/POST/etc. exports, no helper re-exports).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeToken } from "@/lib/mobileToken";
import bcrypt from "bcryptjs";

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
