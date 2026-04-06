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


// GET invoices — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const invoices = await prisma.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new invoice
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber ?? '',
        customer:      body.customer      ?? 'Unknown',
        items:         body.items         ?? [],
        subtotal:      body.subtotal      ?? 0,
        tax:           body.tax           ?? 0,
        total:         body.total         ?? 0,
        amountPaid:    body.amountPaid    ?? 0,
        paymentTerms:  body.paymentTerms  ?? 'Net 30',
        issueDate:     body.issueDate     ?? new Date().toISOString().split('T')[0],
        dueDate:       body.dueDate       ?? '',
        status:        body.status        ?? 'unpaid',
        notes:         body.notes         ?? '',
        currency:      body.currency      ?? 'USD',  // Phase 15
        workspaceId:   body.workspaceId,
      },
    })
    return NextResponse.json(invoice, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE an invoice (record payment, change status, etc.)
// Automation 5: status → "paid" → reduce customer balanceDue
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: body.id },
        data: {
          ...(body.status     !== undefined && { status:     body.status     }),
          ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid }),
          ...(body.notes      !== undefined && { notes:      body.notes      }),
          ...(body.items      !== undefined && { items:      body.items      }),
          ...(body.subtotal   !== undefined && { subtotal:   body.subtotal   }),
          ...(body.tax        !== undefined && { tax:        body.tax        }),
          ...(body.total      !== undefined && { total:      body.total      }),
        },
      })

      // Automation 5 — reduce customer balanceDue when invoice is paid
      if (body.status === 'paid') {
        const customer = await tx.customer.findFirst({
          where: {
            workspaceId: updated.workspaceId,
            name: { mode: 'insensitive', equals: updated.customer },
          },
        })
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data:  { balanceDue: Math.max(0, customer.balanceDue - updated.total) },
          })
        }
      }

      return updated
    })

    return NextResponse.json(invoice, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE an invoice
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.invoice.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
