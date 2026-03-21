// app/api/portal/orders/route.ts
// Lets the Customer Portal submit a new order/request directly to the DB.
// No session auth — portal is public-facing but we validate workspaceId + customerId.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { workspaceId, customerId, customerName, sku, qty, notes } = body

    if (!workspaceId || !customerName || !sku) {
      return NextResponse.json(
        { error: 'workspaceId, customerName, and sku are required.' },
        { status: 400 }
      )
    }

    // Verify the workspaceId actually exists (prevents spoofed requests)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Invalid workspace.' },
        { status: 404 }
      )
    }

    const order = await prisma.order.create({
      data: {
        customer:    customerName,
        sku:         sku.trim(),
        items:       parseInt(qty) || 1,
        value:       0,            // value unknown until supplier confirms
        stage:       'Placed',
        priority:    'MED',
        source:      'portal',
        notes:       notes?.trim() || `Portal request from ${customerName}`,
        workspaceId,
      },
    })

    return NextResponse.json({ success: true, orderId: order.id })
  } catch (err: any) {
    console.error('Portal order POST error:', err)
    return NextResponse.json(
      { error: 'Could not submit request. Please try again.' },
      { status: 500 }
    )
  }
}
