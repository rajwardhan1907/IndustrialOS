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

// Helper — subtract inventory for a confirmed order (Automation 1)
async function subtractInventory(tx: any, sku: string, qty: number, workspaceId: string) {
  if (!sku) return
  const invItem = await tx.inventoryItem.findFirst({ where: { sku, workspaceId } })
  if (invItem) {
    await tx.inventoryItem.update({
      where: { id: invItem.id },
      data:  { stockLevel: Math.max(0, invItem.stockLevel - qty) },
    })
  }
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
// Automation 1: if stage is "Confirmed" on creation, subtract inventory
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const isConfirmed = body.stage === 'Confirmed'

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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
      // Automation 1 — subtract inventory when confirmed at creation
      if (isConfirmed) {
        await subtractInventory(tx, created.sku, created.items, created.workspaceId)
      }
      return created
    })

    return NextResponse.json(order, { headers: CORS })
  } catch (err: any) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE an order (advance stage, change priority, etc.)
// Automation 1: stage → "Confirmed" → subtract inventory
// Automation 6: stage → "Delivered" → auto-create invoice
// Automation 7: stage → "Shipped"   → auto-create shipment
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: body.id },
        data: {
          ...(body.stage    !== undefined && { stage:    body.stage    }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.notes    !== undefined && { notes:    body.notes    }),
        },
      })

      // Automation 1 — subtract inventory when stage moves to Confirmed
      if (body.stage === 'Confirmed') {
        await subtractInventory(tx, updated.sku, updated.items, updated.workspaceId)
      }

      // Automation 7 — auto-create shipment when stage moves to Shipped
      if (body.stage === 'Shipped') {
        const existing = await tx.shipment.findFirst({
          where: { orderId: updated.id },
        })
        if (!existing) {
          await tx.shipment.create({
            data: {
              shipmentNumber: 'SHP-' + updated.id.slice(-6).toUpperCase(),
              orderId:        updated.id,
              customer:       updated.customer,
              status:         'in_transit',
              carrier:        'TBD',
              trackingNumber: '',
              origin:         '',
              destination:    '',
              estimatedDate:  '',
              deliveredDate:  '',
              notes:          '',
              workspaceId:    updated.workspaceId,
            },
          })
        }
      }

      // Automation 6 — auto-create invoice when stage moves to Delivered
      if (body.stage === 'Delivered') {
        const existingInv = await tx.invoice.findFirst({
          where: {
            customer:    updated.customer,
            workspaceId: updated.workspaceId,
            invoiceNumber: { contains: updated.id.slice(-6).toUpperCase() },
          },
        })
        if (!existingInv) {
          const today   = new Date()
          const due     = new Date(today)
          due.setDate(due.getDate() + 30)
          const unitPrice = updated.items > 0 ? updated.value / updated.items : updated.value
          await tx.invoice.create({
            data: {
              invoiceNumber: 'INV-' + updated.id.slice(-6).toUpperCase(),
              customer:      updated.customer,
              total:         updated.value,
              subtotal:      updated.value,
              tax:           0,
              amountPaid:    0,
              status:        'unpaid',
              paymentTerms:  'Net 30',
              issueDate:     today.toISOString().split('T')[0],
              dueDate:       due.toISOString().split('T')[0],
              currency:      'USD',
              notes:         '',
              items: [{ description: updated.sku, qty: updated.items, unitPrice }],
              workspaceId:   updated.workspaceId,
            },
          })
        }
      }

      return updated
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
