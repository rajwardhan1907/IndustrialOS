import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all orders
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
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
        title: body.title,
        status: body.status ?? 'pending',
        priority: body.priority ?? 'medium',
        workspaceId: body.workspaceId,
      }
    })
    return NextResponse.json(order)
  } catch (err: any) {
    console.error('Order create error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
