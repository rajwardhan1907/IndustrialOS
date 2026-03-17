import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all orders (optionally filter by workspaceId)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const orders = await prisma.order.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders)
  } catch (err: any) {
    console.error('Orders GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new order
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
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
    return NextResponse.json(order)
  } catch (err: any) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE an order (advance stage, change priority, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const order = await prisma.order.update({
      where: { id: body.id },
      data: {
        ...(body.stage    !== undefined && { stage:    body.stage    }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.notes    !== undefined && { notes:    body.notes    }),
      },
    })
    return NextResponse.json(order)
  } catch (err: any) {
    console.error('Orders PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE an order
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.order.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Orders DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
