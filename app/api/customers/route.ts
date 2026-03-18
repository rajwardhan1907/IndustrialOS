import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET customers — workspaceId is required (prevents cross-tenant data leaks)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const customers = await prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(customers)
  } catch (err: any) {
    console.error('Customers GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE a new customer
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const customer = await prisma.customer.create({
      data: {
        name:        body.name        ?? 'Unknown',
        contactName: body.contactName ?? '',
        email:       body.email       ?? '',
        phone:       body.phone       ?? '',
        country:     body.country     ?? '',
        industry:    body.industry    ?? '',
        creditLimit: body.creditLimit ?? 0,
        balanceDue:  body.balanceDue  ?? 0,
        status:      body.status      ?? 'active',
        portalCode:  body.portalCode  ?? '',
        notes:       body.notes       ?? '',
        orders:      body.orders      ?? [],
        workspaceId: body.workspaceId,
      },
    })
    return NextResponse.json(customer)
  } catch (err: any) {
    console.error('Customers POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE a customer
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const customer = await prisma.customer.update({
      where: { id: body.id },
      data: {
        ...(body.name        !== undefined && { name:        body.name        }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.email       !== undefined && { email:       body.email       }),
        ...(body.phone       !== undefined && { phone:       body.phone       }),
        ...(body.country     !== undefined && { country:     body.country     }),
        ...(body.industry    !== undefined && { industry:    body.industry    }),
        ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
        ...(body.balanceDue  !== undefined && { balanceDue:  body.balanceDue  }),
        ...(body.status      !== undefined && { status:      body.status      }),
        ...(body.portalCode  !== undefined && { portalCode:  body.portalCode  }),
        ...(body.notes       !== undefined && { notes:       body.notes       }),
        ...(body.orders      !== undefined && { orders:      body.orders      }),
      },
    })
    return NextResponse.json(customer)
  } catch (err: any) {
    console.error('Customers PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE a customer
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Customers DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
