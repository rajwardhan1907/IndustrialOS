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


// GET quotes — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const quotes = await prisma.quote.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(quotes, { headers: CORS })
  } catch (err: any) {
    console.error('Quotes GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// CREATE a new quote
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const quote = await prisma.quote.create({
      data: {
        quoteNumber:  body.quoteNumber  ?? '',
        customer:     body.customer     ?? 'Unknown',
        items:        body.items        ?? [],
        subtotal:     body.subtotal     ?? 0,
        discountAmt:  body.discountAmt  ?? 0,
        tax:          body.tax          ?? 0,
        total:        body.total        ?? 0,
        validUntil:   body.validUntil   ?? '',
        paymentTerms: body.paymentTerms ?? 'Net 30',
        notes:        body.notes        ?? '',
        status:       body.status       ?? 'draft',
        prompt:       body.prompt       ?? '',
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(quote, { headers: CORS })
  } catch (err: any) {
    console.error('Quotes POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// UPDATE a quote (change status, edit fields)
// Automation 2: status → "accepted" → auto-create order + subtract inventory
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const quote = await prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id: body.id },
        data: {
          ...(body.status       !== undefined && { status:       body.status       }),
          ...(body.customer     !== undefined && { customer:     body.customer     }),
          ...(body.items        !== undefined && { items:        body.items        }),
          ...(body.subtotal     !== undefined && { subtotal:     body.subtotal     }),
          ...(body.discountAmt  !== undefined && { discountAmt:  body.discountAmt  }),
          ...(body.tax          !== undefined && { tax:          body.tax          }),
          ...(body.total        !== undefined && { total:        body.total        }),
          ...(body.validUntil   !== undefined && { validUntil:   body.validUntil   }),
          ...(body.paymentTerms !== undefined && { paymentTerms: body.paymentTerms }),
          ...(body.notes        !== undefined && { notes:        body.notes        }),
        },
      })

      // Automation 2 — auto-create order when quote is accepted
      if (body.status === 'accepted') {
        const itemsArr = Array.isArray(updated.items) ? updated.items as any[] : []
        const primarySku = itemsArr[0]?.sku ?? updated.quoteNumber ?? ''
        const totalQty   = itemsArr.reduce((sum: number, it: any) => sum + (Number(it?.qty) || 1), 0)

        // Avoid duplicate order if quote was already accepted once
        const existingOrder = await tx.order.findFirst({ where: { quoteId: updated.id } })
        if (!existingOrder) {
          await tx.order.create({
            data: {
              customer:    updated.customer,
              sku:         primarySku,
              items:       totalQty,
              value:       updated.total,
              stage:       'Placed',
              priority:    'MED',
              source:      'quote',
              notes:       `Auto-created from quote ${updated.quoteNumber}`,
              quoteId:     updated.id,
              workspaceId: updated.workspaceId,
            },
          })
        }

        // Subtract inventory for ALL line items
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
              data:  { stockLevel: Math.max(0, invItem.stockLevel - qty) },
            })
          }
        }
      }

      return updated
    })

    return NextResponse.json(quote, { headers: CORS })
  } catch (err: any) {
    console.error('Quotes PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE a quote
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.quote.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Quotes DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
