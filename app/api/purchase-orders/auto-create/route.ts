import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const { workspaceId, inventoryItemId } = await req.json()
    if (!workspaceId || !inventoryItemId) {
      return NextResponse.json({ error: 'workspaceId and inventoryItemId are required' }, { status: 400, headers: CORS })
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404, headers: CORS })
    }
    if (!item.supplier || item.supplier === '—') {
      return NextResponse.json({ error: 'No supplier configured for this item' }, { status: 422, headers: CORS })
    }

    const qty      = item.reorderQty ?? 1
    const subtotal = qty * Number(item.unitCost)
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { poApprovalThreshold: true },
    })
    const threshold    = workspace?.poApprovalThreshold ?? 0
    const needsApproval = threshold > 0 && subtotal >= threshold

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId:     item.supplier,
        supplierName:   item.supplier,
        items:          [{ sku: item.sku, name: item.name, qty, unitPrice: Number(item.unitCost), total: subtotal }],
        subtotal,
        tax:            0,
        total:          subtotal,
        status:         'draft',
        paymentTerms:   'Net 30',
        expectedDate:   '',
        notes:          `Auto-created reorder for ${item.sku} — ${item.name}`,
        approvalStatus: needsApproval ? 'pending' : 'not_required',
        approvedBy:     '',
        approvedAt:     '',
        workspaceId,
      },
    })
    return NextResponse.json(po, { headers: CORS })
  } catch (err: any) {
    console.error('auto-create PO error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
