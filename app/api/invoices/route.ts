import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET invoices — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const invoices = await prisma.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices)
  } catch (err: any) {
    console.error('Invoices GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new invoice
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
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
        workspaceId:   body.workspaceId,
      },
    })
    return NextResponse.json(invoice)
  } catch (err: any) {
    console.error('Invoices POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE an invoice (record payment, change status, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const invoice = await prisma.invoice.update({
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
    return NextResponse.json(invoice)
  } catch (err: any) {
    console.error('Invoices PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE an invoice
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.invoice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Invoices DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
