// Phase 12 (roadmap): Contract & SLA Tracker API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}


// GET  ?workspaceId=xxx          — list all contracts
// GET  ?workspaceId=xxx&expiring=1 — only expiring/expired (for notification bell)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const expiring    = searchParams.get("expiring") === "1";
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400, headers: CORS });

    const contracts = await prisma.contract.findMany({
      where: { workspaceId },
      orderBy: { expiryDate: "asc" },
    });

    // Derive status server-side so it's always fresh
    const today = new Date();
    const enriched = contracts.map(c => {
      const expiry = new Date(c.expiryDate);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      let status = c.status;
      if (status !== "draft") {
        if (daysLeft < 0)        status = "expired";
        else if (daysLeft <= 30) status = "expiring";
        else                     status = "active";
      }
      return { ...c, status, daysLeft };
    });

    if (expiring) {
      return NextResponse.json(enriched.filter(c => c.status === "expiring" || c.status === "expired"), { headers: CORS });
    }
    return NextResponse.json(enriched, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}

// POST — create a new contract
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, title, customer, minOrderQty, agreedPricing,
            deliverySLA, value, startDate, expiryDate, notes } = body;
    if (!workspaceId || !title || !customer || !startDate || !expiryDate) {
      return NextResponse.json({ error: "workspaceId, title, customer, startDate, expiryDate are required" }, { status: 400, headers: CORS });
    }
    const contractNumber = `CT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        title,
        customer,
        minOrderQty:   Number(minOrderQty)   || 0,
        agreedPricing: agreedPricing          || "",
        deliverySLA:   Number(deliverySLA)    || 7,
        value:         Number(value)          || 0,
        startDate,
        expiryDate,
        status:        "active",
        notes:         notes                  || "",
        workspaceId,
      },
    });
    return NextResponse.json(contract, { status: 201, headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}

// PATCH — update fields
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400, headers: CORS });
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        ...(rest.title          !== undefined && { title:          rest.title          }),
        ...(rest.customer       !== undefined && { customer:       rest.customer       }),
        ...(rest.minOrderQty    !== undefined && { minOrderQty:    Number(rest.minOrderQty)  }),
        ...(rest.agreedPricing  !== undefined && { agreedPricing:  rest.agreedPricing  }),
        ...(rest.deliverySLA    !== undefined && { deliverySLA:    Number(rest.deliverySLA)  }),
        ...(rest.value          !== undefined && { value:          Number(rest.value)        }),
        ...(rest.startDate      !== undefined && { startDate:      rest.startDate      }),
        ...(rest.expiryDate     !== undefined && { expiryDate:     rest.expiryDate     }),
        ...(rest.status         !== undefined && { status:         rest.status         }),
        ...(rest.notes          !== undefined && { notes:          rest.notes          }),
      },
    });
    return NextResponse.json(updated, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}

// DELETE ?id=xxx
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400, headers: CORS });
    await prisma.contract.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}
