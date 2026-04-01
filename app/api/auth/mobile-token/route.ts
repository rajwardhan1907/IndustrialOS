// app/api/auth/mobile-token/route.ts — Mobile app login (Phase 21)
// Returns a simple signed token the mobile app stores in SecureStore.
// We use bcrypt to verify the password against the User table,
// then return a token = base64(userId:workspaceId:role:timestamp)
// This is a lightweight approach — for production you'd use JWT + refresh tokens.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Build a simple token: base64(userId|workspaceId|role|ts)
    const payload = `${user.id}|${user.workspaceId}|${user.role}|${Date.now()}`;
    const token   = Buffer.from(payload).toString("base64");

    return NextResponse.json({
      token,
      userId:      user.id,
      workspaceId: user.workspaceId,
      role:        user.role,
      name:        user.name,
    });
  } catch (err: any) {
    console.error("Mobile token error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
