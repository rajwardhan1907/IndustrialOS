// PaymentRecord — ledger of payment transactions against invoices.
// GET   ?workspaceId=&invoiceId=
// POST  { invoiceId, amount, type, method, reference, notes }

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validatePositive } from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    const invoiceId   = searchParams.get('invoiceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const where: any = { workspaceId }
    if (invoiceId) where.invoiceId = invoiceId
    const records = await prisma.paymentRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(records, { headers: CORS })
  } catch (err: any) {
    console.error('PaymentRecords GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId || !body.invoiceId) {
      return NextResponse.json({ error: 'workspaceId and invoiceId are required' }, { status: 400, headers: CORS })
    }
    const vErr = validatePositive(body.amount, 'amount')
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const rec = await prisma.paymentRecord.create({
      data: {
        invoiceId:   body.invoiceId,
        workspaceId: body.workspaceId,
        amount:      Number(body.amount),
        type:        body.type      ?? 'payment',
        method:      body.method    ?? '',
        reference:   body.reference ?? '',
        notes:       body.notes     ?? '',
      },
    })
    return NextResponse.json(rec, { headers: CORS })
  } catch (err: any) {
    console.error('PaymentRecords POST error:', err)
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
    await prisma.paymentRecord.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('PaymentRecords DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
