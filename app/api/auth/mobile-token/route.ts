// app/api/auth/mobile-token/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Browser preflight request
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

    const payload = `${user.id}|${user.workspaceId}|${user.role}|${Date.now()}`;
    const token   = Buffer.from(payload).toString("base64");

    return NextResponse.json(
      { token, userId: user.id, workspaceId: user.workspaceId, role: user.role, name: user.name },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("Mobile token error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
