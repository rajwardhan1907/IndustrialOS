// app/api/portal/returns/route.ts
// PUBLIC endpoint — no auth required for GET (workspace branding) + POST (submit)
// Token auth required for GET with Authorization header (list customer's returns)
//
// GET  /api/portal/returns?wid=xxx              → workspace name (for branding, no token)
// GET  (Authorization: Bearer <token>)          → list signed-in customer's returns
// POST /api/portal/returns                      → creates a return (token auth or anonymous)

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

function makeRMANumber(): string {
  const year = new Date().getFullYear()
  const num  = String(Math.floor(1000 + Math.random() * 9000))
  return `RMA-${year}-${num}`
}

// GET — if token present: list customer's returns; otherwise return workspace name for branding
export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    // Authenticated: return this customer's returns + workspace return info
    if (token) {
      const session = await prisma.customerSession.findUnique({
        where: { token }, include: { account: true },
      })
      if (!session || session.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
      }
      const acct = session.account
      const [returns, ws] = await Promise.all([
        prisma.return.findMany({
          where: {
            workspaceId: acct.workspaceId,
            OR: [
              { customerEmail: { mode: 'insensitive', equals: acct.email } },
              { customer:      { mode: 'insensitive', equals: acct.name  } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.workspace.findUnique({
          where:  { id: acct.workspaceId },
          select: { returnAddress: true, returnInstructions: true },
        }),
      ])
      return NextResponse.json({
        returns,
        returnAddress:      ws?.returnAddress      || '',
        returnInstructions: ws?.returnInstructions || '',
      }, { headers: CORS })
    }

    // Anonymous: return workspace name for portal branding
    const { searchParams } = new URL(req.url)
    const wid = searchParams.get('wid')
    if (!wid) {
      return NextResponse.json({ error: 'wid is required' }, { status: 400, headers: CORS })
    }
    const ws = await prisma.workspace.findUnique({
      where:  { id: wid },
      select: { id: true, name: true },
    })
    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404, headers: CORS })
    }
    return NextResponse.json({ id: ws.id, name: ws.name }, { headers: CORS })
  } catch (err: any) {
    console.error('Portal returns GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}

// POST — customer submits a return request
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.workspaceId?.trim()) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    if (!body.customer?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400, headers: CORS })
    }
    if (!body.customerEmail?.trim()) {
      return NextResponse.json({ error: 'Your email is required' }, { status: 400, headers: CORS })
    }
    if (!body.sku?.trim()) {
      return NextResponse.json({ error: 'SKU / Product code is required' }, { status: 400, headers: CORS })
    }

    // Make sure the workspace exists (prevents spam against random IDs)
    const ws = await prisma.workspace.findUnique({ where: { id: body.workspaceId } })
    if (!ws) {
      return NextResponse.json({ error: 'Invalid workspace' }, { status: 404, headers: CORS })
    }

    const ret = await prisma.return.create({
      data: {
        rmaNumber:     makeRMANumber(),
        orderId:       body.orderId       ?? '',
        customer:      body.customer.trim(),
        customerEmail: body.customerEmail.trim().toLowerCase(),
        sku:           body.sku.trim(),
        qty:           Number(body.qty)   || 1,
        reason:        body.reason        ?? 'other',
        description:   body.description   ?? '',
        status:        'requested',
        refundAmount:  0,
        refundMethod:  'original',
        notes:         '',
        workspaceId:   body.workspaceId,
      },
    })

    return NextResponse.json({ success: true, rmaNumber: ret.rmaNumber }, { headers: CORS })
  } catch (err: any) {
    console.error('Portal returns POST error:', err)
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500, headers: CORS })
  }
}
