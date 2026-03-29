// app/api/returns/route.ts
// Phase 18 — Returns & RMA API
// GET  /api/returns?workspaceId=xxx   → list all returns
// POST /api/returns                   → create a new return request
// PATCH /api/returns                  → update status, notes, refund fields

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const returns = await prisma.return.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(returns)
  } catch (err: any) {
    console.error('Returns GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    if (!body.customer?.trim()) {
      return NextResponse.json({ error: 'customer is required' }, { status: 400 })
    }
    if (!body.sku?.trim()) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
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
    return NextResponse.json(ret)
  } catch (err: any) {
    console.error('Returns POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const ret = await prisma.return.update({
      where: { id: body.id },
      data: {
        ...(body.status       !== undefined && { status:       body.status       }),
        ...(body.notes        !== undefined && { notes:        body.notes        }),
        ...(body.refundAmount !== undefined && { refundAmount: body.refundAmount }),
        ...(body.refundMethod !== undefined && { refundMethod: body.refundMethod }),
        ...(body.description  !== undefined && { description:  body.description  }),
      },
    })
    return NextResponse.json(ret)
  } catch (err: any) {
    console.error('Returns PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.return.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Returns DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
