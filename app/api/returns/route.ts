// app/api/returns/route.ts
// Returns & RMA API.
// Status flow: requested → approved → received → refunded | rejected
// On approve: deduct refund from customer.balanceDue (or set credit note).
// On received: add qty back to inventory.
// On refunded: mark refundProcessed + refundDate.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification, validatePositive, validateNonNegative } from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function makeRMANumber(): string {
  const year = new Date().getFullYear()
  const num  = String(Math.floor(1000 + Math.random() * 9000))
  return `RMA-${year}-${num}`
}

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
    const vErr =
      validatePositive(body.qty, 'qty') ??
      validateNonNegative(body.refundAmount, 'refundAmount')
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const ret = await prisma.return.create({
      data: {
        rmaNumber:     body.rmaNumber    ?? makeRMANumber(),
        orderId:       body.orderId      || null,
        customer:      body.customer.trim(),
        customerEmail: body.customerEmail ?? '',
        sku:           body.sku.trim(),
        qty:           Number(body.qty ?? 1),
        reason:        body.reason       ?? 'other',
        description:   body.description  ?? '',
        status:        'requested',
        refundAmount:  Number(body.refundAmount ?? 0),
        refundMethod:  body.refundMethod ?? 'original',
        notes:         body.notes        ?? '',
        workspaceId:   body.workspaceId,
      },
    })
    return NextResponse.json(ret, { headers: CORS })
  } catch (err: any) {
    console.error('Returns POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const ret = await prisma.$transaction(async (tx) => {
      const current = await tx.return.findUnique({ where: { id: body.id } })
      if (!current) throw new Error('Return not found')

      const updated = await tx.return.update({
        where: { id: body.id },
        data: {
          ...(body.status       !== undefined && { status:       body.status       }),
          ...(body.notes        !== undefined && { notes:        body.notes        }),
          ...(body.refundAmount !== undefined && { refundAmount: Number(body.refundAmount) }),
          ...(body.refundMethod !== undefined && { refundMethod: body.refundMethod }),
          ...(body.description  !== undefined && { description:  body.description  }),
          ...(body.qty          !== undefined && { qty:          Number(body.qty)  }),
        },
      })

      // Transition: → approved → deduct from customer.balanceDue, restore inventory
      if (body.status === 'approved' && current.status !== 'approved') {
        // Restore inventory
        if (updated.sku) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { sku: updated.sku, workspaceId: updated.workspaceId },
          })
          if (invItem) {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data:  { stockLevel: invItem.stockLevel + (updated.qty ?? 1) },
            })
          }
        }
        // Deduct refund from customer balanceDue
        if (updated.refundAmount > 0) {
          const customer = await tx.customer.findFirst({
            where: { workspaceId: updated.workspaceId, name: { mode: 'insensitive', equals: updated.customer } },
          })
          if (customer) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                balanceDue: Math.max(0, customer.balanceDue - updated.refundAmount),
              },
            })
          }
        }

        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'return',
          severity: 'info',
          title: `Return Approved — ${updated.customer}`,
          body: `${updated.rmaNumber} · ${updated.sku} · $${updated.refundAmount.toLocaleString()}`,
          tab: 'returns',
          linkedType: 'return',
          linkedId: updated.id,
          groupKey: `return-approved-${updated.id}`,
        })
      }

      // Transition: → received → (legacy inventory restore if not already done on approve)
      if (body.status === 'received' && current.status !== 'received' && current.status !== 'approved') {
        if (updated.sku) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { sku: updated.sku, workspaceId: updated.workspaceId },
          })
          if (invItem) {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data:  { stockLevel: invItem.stockLevel + (updated.qty ?? 1) },
            })
          }
        }
      }

      // Transition: → refunded → mark refundProcessed + refundDate
      if (body.status === 'refunded' && current.status !== 'refunded') {
        await tx.return.update({
          where: { id: updated.id },
          data: {
            refundProcessed: true,
            refundDate: new Date().toISOString().split('T')[0],
          },
        })
      }

      return updated
    })

    return NextResponse.json(ret, { headers: CORS })
  } catch (err: any) {
    console.error('Returns PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

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
