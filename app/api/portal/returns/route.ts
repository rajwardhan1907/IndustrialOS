// app/api/portal/returns/route.ts
// PUBLIC endpoint — no auth required (excluded via middleware matcher)
// Customers use this to submit return requests from the portal page.
//
// GET  /api/portal/returns?wid=xxx  → returns workspace name for branding
// POST /api/portal/returns          → creates a return with status "requested"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function makeRMANumber(): string {
  const year = new Date().getFullYear()
  const num  = String(Math.floor(1000 + Math.random() * 9000))
  return `RMA-${year}-${num}`
}

// GET — fetch workspace name so the portal can show the company name
export async function GET(req: Request) {
  try {
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
