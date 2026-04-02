import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}


// GET purchase orders
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const pos = await prisma.purchaseOrder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(pos, { headers: CORS })
  } catch (err: any) {
    console.error('PurchaseOrders GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new purchase order
// Phase 16: on creation, check workspace approval threshold.
// If PO total exceeds threshold (and threshold > 0), set approvalStatus = "pending".
// Otherwise set approvalStatus = "not_required".
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    // Fetch workspace to check the approval threshold
    const workspace = await prisma.workspace.findUnique({
      where:  { id: body.workspaceId },
      select: { poApprovalThreshold: true },
    })
    const threshold   = workspace?.poApprovalThreshold ?? 0
    const poTotal     = body.total ?? 0
    const needsApproval = threshold > 0 && poTotal >= threshold

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber:       body.poNumber     ?? '',
        supplierId:     body.supplierId   ?? '',
        supplierName:   body.supplierName ?? '',
        items:          body.items        ?? [],
        subtotal:       body.subtotal     ?? 0,
        tax:            body.tax          ?? 0,
        total:          poTotal,
        status:         body.status       ?? 'draft',
        paymentTerms:   body.paymentTerms ?? 'Net 30',
        expectedDate:   body.expectedDate ?? '',
        notes:          body.notes        ?? '',
        // Phase 16: set approval status based on threshold
        approvalStatus: needsApproval ? 'pending' : 'not_required',
        approvedBy:     '',
        approvedAt:     '',
        workspaceId:    body.workspaceId,
      },
    })
    return NextResponse.json(po, { headers: CORS })
  } catch (err: any) {
    console.error('PurchaseOrders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE a purchase order
// Phase 16: approvalStatus, approvedBy, approvedAt can be patched here.
// Automation 3: approvalStatus → "approved" OR status → "received" → add stock to inventory
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const po = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: body.id },
        data: {
          ...(body.status         !== undefined && { status:         body.status         }),
          ...(body.poNumber       !== undefined && { poNumber:       body.poNumber       }),
          ...(body.supplierId     !== undefined && { supplierId:     body.supplierId     }),
          ...(body.supplierName   !== undefined && { supplierName:   body.supplierName   }),
          ...(body.items          !== undefined && { items:          body.items          }),
          ...(body.subtotal       !== undefined && { subtotal:       body.subtotal       }),
          ...(body.tax            !== undefined && { tax:            body.tax            }),
          ...(body.total          !== undefined && { total:          body.total          }),
          ...(body.paymentTerms   !== undefined && { paymentTerms:   body.paymentTerms   }),
          ...(body.expectedDate   !== undefined && { expectedDate:   body.expectedDate   }),
          ...(body.notes          !== undefined && { notes:          body.notes          }),
          // Phase 16 approval fields
          ...(body.approvalStatus !== undefined && { approvalStatus: body.approvalStatus }),
          ...(body.approvedBy     !== undefined && { approvedBy:     body.approvedBy     }),
          ...(body.approvedAt     !== undefined && { approvedAt:     body.approvedAt     }),
        },
      })

      // Automation 3 — add stock when PO is approved or received
      const shouldAddStock =
        body.approvalStatus === 'approved' || body.status === 'received'

      if (shouldAddStock) {
        const itemsArr = Array.isArray(updated.items) ? updated.items as any[] : []
        for (const lineItem of itemsArr) {
          const sku = lineItem?.sku
          const qty = Number(lineItem?.qty ?? 0)
          if (!sku || qty <= 0) continue
          const invItem = await tx.inventoryItem.findFirst({
            where: { sku, workspaceId: updated.workspaceId },
          })
          if (invItem) {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data:  { stockLevel: invItem.stockLevel + qty },
            })
          }
        }
      }

      return updated
    })

    return NextResponse.json(po, { headers: CORS })
  } catch (err: any) {
    console.error('PurchaseOrders PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE a purchase order
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.purchaseOrder.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('PurchaseOrders DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
