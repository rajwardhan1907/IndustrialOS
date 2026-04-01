// app/api/edi/partners/route.ts — EDI trading partner CRUD (Phase 23)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/edi/partners?workspaceId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const partners = await prisma.ediPartner.findMany({
      where:   { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(partners);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/edi/partners — create a new trading partner
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, name, standard = "X12", isaQualifier, isaId, partnerQual, partnerId,
            unbSenderId, unbReceiverId, txSets, notes } = body;

    if (!workspaceId || !name) return NextResponse.json({ error: "workspaceId and name required" }, { status: 400 });

    const partner = await prisma.ediPartner.create({
      data: {
        name, standard, workspaceId,
        isaQualifier:   isaQualifier   ?? "01",
        isaId:          isaId          ?? "",
        partnerQual:    partnerQual    ?? "01",
        partnerId:      partnerId      ?? "",
        unbSenderId:    unbSenderId    ?? "",
        unbReceiverId:  unbReceiverId  ?? "",
        txSets:         txSets         ?? "850,855,856,810",
        notes:          notes          ?? "",
      },
    });
    return NextResponse.json(partner, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/edi/partners — update a partner
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const allowed = ["name","standard","isaQualifier","isaId","partnerQual","partnerId",
                     "unbSenderId","unbReceiverId","txSets","active","notes"];
    const update: any = {};
    allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });

    const partner = await prisma.ediPartner.update({ where: { id }, data: update });
    return NextResponse.json(partner);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/edi/partners?id=xxx
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.ediTransaction.deleteMany({ where: { partnerId: id } });
    await prisma.ediPartner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
