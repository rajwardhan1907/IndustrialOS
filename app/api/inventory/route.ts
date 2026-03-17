import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all inventory items (filter by workspaceId)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const items = await prisma.inventoryItem.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items)
  } catch (err: any) {
    console.error('Inventory GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new inventory item
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
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
    return NextResponse.json(item)
  } catch (err: any) {
    console.error('Inventory POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE an inventory item (stock level, reorder point, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const item = await prisma.inventoryItem.update({
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
    return NextResponse.json(item)
  } catch (err: any) {
    console.error('Inventory PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE an inventory item
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.inventoryItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Inventory DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
