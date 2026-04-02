import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}


// GET orders — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const orders = await prisma.order.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders, { headers: CORS })
  } catch (err: any) {
    console.error('Orders GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new order
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const order = await prisma.order.create({
      data: {
        customer:    body.customer    ?? 'Unknown',
        sku:         body.sku         ?? '',
        items:       body.items       ?? 1,
        value:       body.value       ?? 0,
        stage:       body.stage       ?? 'Placed',
        priority:    body.priority    ?? 'MED',
        source:      body.source      ?? 'manual',
        notes:       body.notes       ?? '',
        workspaceId: body.workspaceId,
      },
    })
    return NextResponse.json(order, { headers: CORS })
  } catch (err: any) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE an order (advance stage, change priority, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    const order = await prisma.order.update({
      where: { id: body.id },
      data: {
        ...(body.stage    !== undefined && { stage:    body.stage    }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.notes    !== undefined && { notes:    body.notes    }),
      },
    })
    return NextResponse.json(order, { headers: CORS })
  } catch (err: any) {
    console.error('Orders PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE an order
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.order.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Orders DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
