// app/api/edi/transactions/route.ts — EDI transaction log (Phase 23)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/edi/transactions?workspaceId=xxx&limit=50&direction=inbound|outbound
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const direction   = searchParams.get("direction") ?? undefined;
    const limit       = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const where: any = { workspaceId };
    if (direction) where.direction = direction;

    const transactions = await prisma.ediTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take:    limit,
      include: { partner: { select: { name: true, standard: true } } },
    });

    return NextResponse.json(transactions);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/edi/transactions — update status (e.g. mark as acked)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

    const tx = await prisma.ediTransaction.update({ where: { id }, data: { status } });
    return NextResponse.json(tx);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/edi/transactions?id=xxx
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.ediTransaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
