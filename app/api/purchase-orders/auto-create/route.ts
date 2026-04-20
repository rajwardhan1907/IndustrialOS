// Auto-create a PO from an inventory item (manual reorder trigger).
// POST { workspaceId, inventoryItemId }
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLowStockAutoPo, createNotification } from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId || !body.inventoryItemId) {
      return NextResponse.json(
        { error: 'workspaceId and inventoryItemId are required' },
        { status: 400, headers: CORS },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: body.inventoryItemId, workspaceId: body.workspaceId },
      })
      if (!item) throw new Error('Inventory item not found')
      if (!item.supplierId) {
        throw new Error('NO_SUPPLIER')
      }
      const po = await createLowStockAutoPo(tx, item)
      if (!po) throw new Error('Failed to create PO')

      await createNotification(tx, {
        workspaceId: item.workspaceId,
        type: 'purchaseOrder',
        severity: 'info',
        title: `PO Created — ${item.sku}`,
        body: `Auto-reorder for ${item.name}. Check Purchase Orders.`,
        tab: 'purchaseOrders',
        linkedType: 'purchaseOrder',
        linkedId: po.id,
        groupKey: `auto-po-manual-${item.id}`,
      })

      return po
    })

    return NextResponse.json(result, { headers: CORS })
  } catch (err: any) {
    if (err.message === 'NO_SUPPLIER') {
      return NextResponse.json(
        { error: 'Assign a supplier to this item first' },
        { status: 400, headers: CORS },
      )
    }
    console.error('PO auto-create error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
