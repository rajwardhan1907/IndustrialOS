import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET suppliers — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const suppliers = await prisma.supplier.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(suppliers)
  } catch (err: any) {
    console.error('Suppliers GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new supplier
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const supplier = await prisma.supplier.create({
      data: {
        name:         body.name         ?? '',
        contactName:  body.contactName  ?? '',
        email:        body.email        ?? '',
        phone:        body.phone        ?? '',
        country:      body.country      ?? '',
        category:     body.category     ?? 'other',
        status:       body.status       ?? 'active',
        paymentTerms: body.paymentTerms ?? 'Net 30',
        leadTimeDays: body.leadTimeDays ?? 14,
        rating:       body.rating       ?? 3,
        notes:        body.notes        ?? '',
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(supplier)
  } catch (err: any) {
    console.error('Suppliers POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE a supplier
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const supplier = await prisma.supplier.update({
      where: { id: body.id },
      data: {
        ...(body.name         !== undefined && { name:         body.name         }),
        ...(body.contactName  !== undefined && { contactName:  body.contactName  }),
        ...(body.email        !== undefined && { email:        body.email        }),
        ...(body.phone        !== undefined && { phone:        body.phone        }),
        ...(body.country      !== undefined && { country:      body.country      }),
        ...(body.category     !== undefined && { category:     body.category     }),
        ...(body.status       !== undefined && { status:       body.status       }),
        ...(body.paymentTerms !== undefined && { paymentTerms: body.paymentTerms }),
        ...(body.leadTimeDays !== undefined && { leadTimeDays: body.leadTimeDays }),
        ...(body.rating       !== undefined && { rating:       body.rating       }),
        ...(body.notes        !== undefined && { notes:        body.notes        }),
      },
    })
    return NextResponse.json(supplier)
  } catch (err: any) {
    console.error('Suppliers PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE a supplier
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Suppliers DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
