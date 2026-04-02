// app/api/returns/route.ts
// Phase 18 — Returns & RMA API
// GET  /api/returns?workspaceId=xxx   → list all returns
// POST /api/returns                   → create a new return request
// PATCH /api/returns                  → update status, notes, refund fields

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


function makeRMANumber(): string {
  const year = new Date().getFullYear()
  const num  = String(Math.floor(1000 + Math.random() * 9000))
  return `RMA-${year}-${num}`
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const returns = await prisma.return.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(returns, { headers: CORS })
  } catch (err: any) {
    console.error('Returns GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    if (!body.customer?.trim()) {
      return NextResponse.json({ error: 'customer is required' }, { status: 400, headers: CORS })
    }
    if (!body.sku?.trim()) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400, headers: CORS })
    }

    const ret = await prisma.return.create({
      data: {
        rmaNumber:    body.rmaNumber    ?? makeRMANumber(),
        orderId:      body.orderId      ?? '',
        customer:     body.customer.trim(),
        sku:          body.sku.trim(),
        qty:          body.qty          ?? 1,
        reason:       body.reason       ?? 'other',
        description:  body.description  ?? '',
        status:       'requested',
        refundAmount: body.refundAmount ?? 0,
        refundMethod: body.refundMethod ?? 'original',
        notes:        body.notes        ?? '',
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(ret, { headers: CORS })
  } catch (err: any) {
    console.error('Returns POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Automation 4: status → "received" → add stock back to inventory
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const ret = await prisma.$transaction(async (tx) => {
      // Fetch current return record first so we have sku + qty
      const current = await tx.return.findUnique({ where: { id: body.id } })

      const updated = await tx.return.update({
        where: { id: body.id },
        data: {
          ...(body.status       !== undefined && { status:       body.status       }),
          ...(body.notes        !== undefined && { notes:        body.notes        }),
          ...(body.refundAmount !== undefined && { refundAmount: body.refundAmount }),
          ...(body.refundMethod !== undefined && { refundMethod: body.refundMethod }),
          ...(body.description  !== undefined && { description:  body.description  }),
        },
      })

      // Automation 4 — add returned stock back to inventory
      if (body.status === 'received' && current?.sku) {
        const invItem = await tx.inventoryItem.findFirst({
          where: { sku: current.sku, workspaceId: updated.workspaceId },
        })
        if (invItem) {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data:  { stockLevel: invItem.stockLevel + (current.qty ?? 1) },
          })
        }
      }

      return updated
    })

    return NextResponse.json(ret, { headers: CORS })
  } catch (err: any) {
    console.error('Returns PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.return.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Returns DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
