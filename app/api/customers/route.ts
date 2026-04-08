import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── Helper: make a portalCode unique within a workspace ────────────────────────
// If the proposed code is empty, return it as-is (no index entry for empty codes).
// If it collides, append a random 3-digit suffix until unique.
async function uniquePortalCode(code: string, workspaceId: string, excludeId?: string): Promise<string> {
  if (!code) return code;
  let candidate = code.toUpperCase();
  for (let attempts = 0; attempts < 10; attempts++) {
    const existing = await prisma.customer.findFirst({
      where: {
        workspaceId,
        portalCode: { equals: candidate, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = code.toUpperCase() + Math.floor(100 + Math.random() * 900);
  }
  return candidate;
}

// GET customers — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const customers = await prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(customers, { headers: CORS })
  } catch (err: any) {
    console.error('Customers GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new customer
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const portalCode = await uniquePortalCode(body.portalCode ?? '', body.workspaceId);
    const customer = await prisma.customer.create({
      data: {
        name:        body.name        ?? 'Unknown',
        contactName: body.contactName ?? '',
        email:       body.email       ?? '',
        phone:       body.phone       ?? '',
        country:     body.country     ?? '',
        industry:    body.industry    ?? '',
        creditLimit: body.creditLimit ?? 0,
        balanceDue:  body.balanceDue  ?? 0,
        status:      body.status      ?? 'active',
        portalCode,
        notes:       body.notes       ?? '',
        orders:      body.orders      ?? [],
        workspaceId: body.workspaceId,
      },
    })
    return NextResponse.json(customer, { headers: CORS })
  } catch (err: any) {
    console.error('Customers POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE a customer
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    // If a portalCode is being set, ensure it's unique within this workspace
    let portalCode: string | undefined;
    if (body.portalCode !== undefined) {
      const existing = await prisma.customer.findUnique({ where: { id: body.id }, select: { workspaceId: true } });
      if (existing) {
        portalCode = await uniquePortalCode(body.portalCode, existing.workspaceId, body.id);
      }
    }

    const customer = await prisma.customer.update({
      where: { id: body.id },
      data: {
        ...(body.name        !== undefined && { name:        body.name        }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.email       !== undefined && { email:       body.email       }),
        ...(body.phone       !== undefined && { phone:       body.phone       }),
        ...(body.country     !== undefined && { country:     body.country     }),
        ...(body.industry    !== undefined && { industry:    body.industry    }),
        ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
        ...(body.balanceDue  !== undefined && { balanceDue:  body.balanceDue  }),
        ...(body.status      !== undefined && { status:      body.status      }),
        ...(portalCode       !== undefined && { portalCode }),
        ...(body.notes           !== undefined && { notes:           body.notes           }),
        ...(body.orders          !== undefined && { orders:          body.orders          }),
        ...(body.whatsappPaused  !== undefined && { whatsappPaused:  body.whatsappPaused  }),
        ...(body.totalSpend      !== undefined && { totalSpend:      body.totalSpend      }),
      },
    })
    return NextResponse.json(customer, { headers: CORS })
  } catch (err: any) {
    console.error('Customers PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE a customer
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Customers DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
