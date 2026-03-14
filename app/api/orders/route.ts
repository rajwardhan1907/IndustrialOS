import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all orders
export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(orders)
}

// CREATE a new order
export async function POST(req: Request) {
  const body = await req.json()
  const order = await prisma.order.create({
    data: {
      title: body.title,
      status: body.status ?? 'pending',
      priority: body.priority ?? 'medium',
      workspaceId: body.workspaceId,
    }
  })
  return NextResponse.json(order)
}
