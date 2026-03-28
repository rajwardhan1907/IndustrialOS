import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET purchase orders — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const pos = await prisma.purchaseOrder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(pos)
  } catch (err: any) {
    console.error('PurchaseOrders GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new purchase order
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber:      body.poNumber      ?? '',
        supplierId:    body.supplierId    ?? '',
        supplierName:  body.supplierName  ?? '',
        items:         body.items         ?? [],
        subtotal:      body.subtotal      ?? 0,
        tax:           body.tax           ?? 0,
        total:         body.total         ?? 0,
        status:        body.status        ?? 'draft',
        paymentTerms:  body.paymentTerms  ?? 'Net 30',
        expectedDate:  body.expectedDate  ?? '',
        notes:         body.notes         ?? '',
        // Fix Bug 2: save rejectionNote if provided
        rejectionNote: body.rejectionNote ?? '',
        workspaceId:   body.workspaceId,
      },
    })
    return NextResponse.json(po)
  } catch (err: any) {
    console.error('PurchaseOrders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE a purchase order (advance status, approve, reject, edit fields)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const po = await prisma.purchaseOrder.update({
      where: { id: body.id },
      data: {
        ...(body.status        !== undefined && { status:        body.status        }),
        ...(body.poNumber      !== undefined && { poNumber:      body.poNumber      }),
        ...(body.supplierId    !== undefined && { supplierId:    body.supplierId    }),
        ...(body.supplierName  !== undefined && { supplierName:  body.supplierName  }),
        ...(body.items         !== undefined && { items:         body.items         }),
        ...(body.subtotal      !== undefined && { subtotal:      body.subtotal      }),
        ...(body.tax           !== undefined && { tax:           body.tax           }),
        ...(body.total         !== undefined && { total:         body.total         }),
        ...(body.paymentTerms  !== undefined && { paymentTerms:  body.paymentTerms  }),
        ...(body.expectedDate  !== undefined && { expectedDate:  body.expectedDate  }),
        ...(body.notes         !== undefined && { notes:         body.notes         }),
        // Fix Bug 2: persist rejection note when admin rejects a PO
        ...(body.rejectionNote !== undefined && { rejectionNote: body.rejectionNote }),
      },
    })
    return NextResponse.json(po)
  } catch (err: any) {
    console.error('PurchaseOrders PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE a purchase order
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.purchaseOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PurchaseOrders DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
