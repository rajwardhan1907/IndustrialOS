import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all quotes (filter by workspaceId)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const quotes = await prisma.quote.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(quotes)
  } catch (err: any) {
    console.error('Quotes GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new quote
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
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
    return NextResponse.json(quote)
  } catch (err: any) {
    console.error('Quotes POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE a quote (change status, edit fields)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const quote = await prisma.quote.update({
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
    return NextResponse.json(quote)
  } catch (err: any) {
    console.error('Quotes PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE a quote
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.quote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Quotes DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
