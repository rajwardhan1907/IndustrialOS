// app/api/portal/orders/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function resolveAccount(token: string) {
  const session = await prisma.customerSession.findUnique({
    where: { token }, include: { account: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.account
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveAccount(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })

    const body = await req.json()
    const sku   = (body.sku   ?? '').trim() || 'TBD'
    const qty   = parseInt(body.qty)   || 1
    const notes = (body.notes ?? '').trim()

    const id = `ORD-${Math.floor(10000 + Math.random() * 90000)}`

    const order = await prisma.order.create({
      data: {
        id,
        customer:    acct.name,
        sku,
        items:       qty,
        value:       0,
        stage:       'Placed',
        priority:    'MED',
        source:      'portal',
        notes:       notes || `Portal request from ${acct.name}`,
        workspaceId: acct.workspaceId,
        createdAt:   new Date(),
      },
    })
    return NextResponse.json(order, { status: 201, headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveAccount(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
    const orders = await prisma.order.findMany({
      where: { workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
