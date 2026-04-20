import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification, validateNonNegative, recalcDSO } from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const vErr =
      validateNonNegative(body.subtotal, 'subtotal') ??
      validateNonNegative(body.tax, 'tax') ??
      validateNonNegative(body.total, 'total') ??
      validateNonNegative(body.amountPaid, 'amountPaid')
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const workspace = await prisma.workspace.findUnique({
      where: { id: body.workspaceId },
      select: { currency: true },
    })

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber ?? '',
        customer:      body.customer      ?? 'Unknown',
        items:         body.items         ?? [],
        subtotal:      Number(body.subtotal   ?? 0),
        tax:           Number(body.tax        ?? 0),
        total:         Number(body.total      ?? 0),
        amountPaid:    Number(body.amountPaid ?? 0),
        paymentTerms:  body.paymentTerms  ?? 'Net 30',
        paymentMethod: body.paymentMethod ?? '',
        paymentDate:   body.paymentDate   ?? '',
        issueDate:     body.issueDate     ?? new Date().toISOString().split('T')[0],
        dueDate:       body.dueDate       ?? '',
        status:        body.status        ?? 'unpaid',
        notes:         body.notes         ?? '',
        currency:      body.currency      ?? workspace?.currency ?? 'USD',
        orderId:       body.orderId       || null,
        workspaceId:   body.workspaceId,
      },
    })
    return NextResponse.json(invoice, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// PATCH — record payment / mark paid.
// - Overpayment detection: if amountPaid > total, warn & log overpayment PaymentRecord.
// - On paid: balanceDue -= total, write PaymentRecord, release credit hold if clear, recalc DSO.
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    const vErr =
      (body.amountPaid !== undefined ? validateNonNegative(body.amountPaid, 'amountPaid') : null) ??
      (body.total      !== undefined ? validateNonNegative(body.total, 'total') : null)
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const result = await prisma.$transaction(async (tx) => {
      const prev = await tx.invoice.findUnique({ where: { id: body.id } })
      if (!prev) throw new Error('Invoice not found')

      const updated = await tx.invoice.update({
        where: { id: body.id },
        data: {
          ...(body.status        !== undefined && { status:        body.status        }),
          ...(body.amountPaid    !== undefined && { amountPaid:    Number(body.amountPaid) }),
          ...(body.notes         !== undefined && { notes:         body.notes         }),
          ...(body.items         !== undefined && { items:         body.items         }),
          ...(body.subtotal      !== undefined && { subtotal:      Number(body.subtotal) }),
          ...(body.tax           !== undefined && { tax:           Number(body.tax) }),
          ...(body.total         !== undefined && { total:         Number(body.total) }),
          ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
          ...(body.paymentDate   !== undefined && { paymentDate:   body.paymentDate }),
        },
      })

      const overpayWarning = updated.amountPaid > updated.total && updated.total > 0

      // Record a PaymentRecord for the delta if amountPaid changed
      if (body.amountPaid !== undefined && Number(body.amountPaid) !== prev.amountPaid) {
        const delta = Number(body.amountPaid) - prev.amountPaid
        if (delta !== 0) {
          await tx.paymentRecord.create({
            data: {
              invoiceId: updated.id,
              workspaceId: updated.workspaceId,
              amount: Math.abs(delta),
              type: delta > 0
                ? (overpayWarning ? 'overpayment' : (updated.amountPaid < updated.total ? 'partial' : 'payment'))
                : 'refund',
              method: body.paymentMethod ?? updated.paymentMethod ?? '',
              reference: body.paymentReference ?? '',
            },
          })
        }
      }

      // On paid: reduce balance, release hold, recalc DSO
      if (body.status === 'paid' && prev.status !== 'paid') {
        const customer = await tx.customer.findFirst({
          where: {
            workspaceId: updated.workspaceId,
            name: { mode: 'insensitive', equals: updated.customer },
          },
        })
        if (customer) {
          const newBalance = Math.max(0, customer.balanceDue - updated.total)
          const releaseHold =
            customer.onCreditHold &&
            customer.creditHoldReason.startsWith('Credit limit exceeded') &&
            (customer.creditLimit <= 0 || newBalance < customer.creditLimit)
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              balanceDue: newBalance,
              ...(releaseHold && { onCreditHold: false, creditHoldReason: '' }),
            },
          })
        }
        await recalcDSO(tx, updated.workspaceId, updated.customer)
      }

      // Overpayment notification + credit note suggestion
      if (overpayWarning) {
        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'invoice',
          severity: 'warn',
          title: `Invoice Overpayment — ${updated.customer}`,
          body: `${updated.invoiceNumber} · paid $${updated.amountPaid} vs total $${updated.total}. Consider issuing a credit note for $${(updated.amountPaid - updated.total).toFixed(2)}.`,
          tab: 'invoicing',
          linkedType: 'invoice',
          linkedId: updated.id,
          groupKey: `invoice-overpay-${updated.id}`,
        })
      }

      return { invoice: updated, overpayWarning }
    })

    return NextResponse.json(result.invoice, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices PATCH error:', err)
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
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.deleteMany({ where: { invoiceId: id } })
      await tx.invoice.delete({ where: { id } })
    })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Invoices DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
