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

// GET inventory — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const items = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new inventory item
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const item = await prisma.inventoryItem.create({
      data: {
        sku:          body.sku          ?? '',
        name:         body.name         ?? '',
        category:     body.category     ?? '',
        stockLevel:   body.stockLevel   ?? 0,
        reorderPoint: body.reorderPoint ?? 0,
        reorderQty:   body.reorderQty   ?? 0,
        unitCost:     body.unitCost     ?? 0,
        warehouse:    body.warehouse    ?? '',
        zone:         body.zone         ?? 'A',
        binLocation:  body.binLocation  ?? '',
        lastSynced:   body.lastSynced   ?? new Date().toISOString(),
        supplier:     body.supplier     ?? '',
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(item, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE an inventory item (stock level, reorder point, etc.)
// Automation 8: after update, if stockLevel <= reorderPoint → auto-raise low-stock ticket
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: body.id },
        data: {
          ...(body.sku          !== undefined && { sku:          body.sku          }),
          ...(body.name         !== undefined && { name:         body.name         }),
          ...(body.category     !== undefined && { category:     body.category     }),
          ...(body.stockLevel   !== undefined && { stockLevel:   body.stockLevel   }),
          ...(body.reorderPoint !== undefined && { reorderPoint: body.reorderPoint }),
          ...(body.reorderQty   !== undefined && { reorderQty:   body.reorderQty   }),
          ...(body.unitCost     !== undefined && { unitCost:     body.unitCost     }),
          ...(body.warehouse    !== undefined && { warehouse:    body.warehouse    }),
          ...(body.zone         !== undefined && { zone:         body.zone         }),
          ...(body.binLocation  !== undefined && { binLocation:  body.binLocation  }),
          ...(body.lastSynced   !== undefined && { lastSynced:   body.lastSynced   }),
          ...(body.supplier     !== undefined && { supplier:     body.supplier     }),
        },
      })

      // Automation 8 — raise low-stock ticket when stockLevel drops to/below reorderPoint
      const isLow = updated.reorderPoint > 0 && updated.stockLevel <= updated.reorderPoint
      if (isLow) {
        // Avoid duplicate open tickets for the same inventory item
        const openTicket = await tx.ticket.findFirst({
          where: {
            linkedId:    updated.id,
            workspaceId: updated.workspaceId,
            status:      { notIn: ['resolved', 'closed'] },
          },
        })
        if (!openTicket) {
          // Fix 10: use sequential number format matching makeTicketNumber in tickets route
          const count = await tx.ticket.count({ where: { workspaceId: updated.workspaceId } })
          await tx.ticket.create({
            data: {
              ticketNumber: `TKT-${String(count + 1).padStart(3, '0')}`,
              title:        `Low stock: ${updated.name} (${updated.sku})`,
              description:  `Stock level ${updated.stockLevel} has reached or dropped below reorder point of ${updated.reorderPoint}. Current stock: ${updated.stockLevel}. Reorder qty: ${updated.reorderQty}.`,
              type:         'alert',
              priority:     'high',
              status:       'open',
              assignedTo:   '',
              assignedName: '',
              raisedBy:     '',
              raisedName:   '',
              linkedType:   'inventory',
              linkedId:     updated.id,
              linkedLabel:  `${updated.name} — ${updated.sku}`,
              workspaceId:  updated.workspaceId,
            },
          })
        }
      }

      return updated
    })

    return NextResponse.json(item, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE an inventory item
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.inventoryItem.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
