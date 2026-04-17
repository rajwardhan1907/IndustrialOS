import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createNotification,
  createLowStockTicket,
  createLowStockAutoPo,
  validateNonNegative,
} from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const vErr =
      validateNonNegative(body.stockLevel, 'stockLevel') ??
      validateNonNegative(body.reorderPoint, 'reorderPoint') ??
      validateNonNegative(body.reorderQty, 'reorderQty') ??
      validateNonNegative(body.unitCost, 'unitCost')
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const item = await prisma.inventoryItem.create({
      data: {
        sku:          body.sku          ?? '',
        name:         body.name         ?? '',
        category:     body.category     ?? '',
        stockLevel:   Number(body.stockLevel   ?? 0),
        reorderPoint: Number(body.reorderPoint ?? 0),
        reorderQty:   Number(body.reorderQty   ?? 0),
        unitCost:     Number(body.unitCost     ?? 0),
        warehouse:    body.warehouse    ?? '',
        zone:         body.zone         ?? 'A',
        binLocation:  body.binLocation  ?? '',
        lastSynced:   body.lastSynced   ?? new Date().toISOString(),
        supplier:     body.supplier     ?? '',
        supplierId:   body.supplierId   || null,
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(item, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// PATCH — on low stock, create ticket + auto-PO (if supplier linked)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    const vErr =
      (body.stockLevel   !== undefined ? validateNonNegative(body.stockLevel, 'stockLevel') : null) ??
      (body.reorderPoint !== undefined ? validateNonNegative(body.reorderPoint, 'reorderPoint') : null) ??
      (body.reorderQty   !== undefined ? validateNonNegative(body.reorderQty, 'reorderQty') : null) ??
      (body.unitCost     !== undefined ? validateNonNegative(body.unitCost, 'unitCost') : null)
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: body.id },
        data: {
          ...(body.sku          !== undefined && { sku:          body.sku          }),
          ...(body.name         !== undefined && { name:         body.name         }),
          ...(body.category     !== undefined && { category:     body.category     }),
          ...(body.stockLevel   !== undefined && { stockLevel:   Number(body.stockLevel)   }),
          ...(body.reorderPoint !== undefined && { reorderPoint: Number(body.reorderPoint) }),
          ...(body.reorderQty   !== undefined && { reorderQty:   Number(body.reorderQty)   }),
          ...(body.unitCost     !== undefined && { unitCost:     Number(body.unitCost)     }),
          ...(body.warehouse    !== undefined && { warehouse:    body.warehouse    }),
          ...(body.zone         !== undefined && { zone:         body.zone         }),
          ...(body.binLocation  !== undefined && { binLocation:  body.binLocation  }),
          ...(body.lastSynced   !== undefined && { lastSynced:   body.lastSynced   }),
          ...(body.supplier     !== undefined && { supplier:     body.supplier     }),
          ...(body.supplierId   !== undefined && { supplierId:   body.supplierId || null }),
        },
      })

      // Low stock automation
      const isLow = updated.reorderPoint > 0 && updated.stockLevel <= updated.reorderPoint
      if (isLow) {
        await createLowStockTicket(tx, updated)
        await createLowStockAutoPo(tx, updated)

        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'inventory',
          severity: updated.stockLevel === 0 ? 'error' : 'warn',
          title: updated.stockLevel === 0 ? `Out of Stock — ${updated.sku}` : `Low Stock — ${updated.sku}`,
          body: `${updated.name} · ${updated.stockLevel} units left (reorder at ${updated.reorderPoint})`,
          tab: 'inventory',
          linkedType: 'inventory',
          linkedId: updated.id,
          groupKey: `low-stock-${updated.id}`,
        })
      }

      return updated
    })

    return NextResponse.json(item, { headers: CORS })
  } catch (err: any) {
    console.error('Inventory PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

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
