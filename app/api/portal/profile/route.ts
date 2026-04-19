// app/api/portal/profile/route.ts
// Allows a portal-authenticated customer to view and update their own contact details.
// GET  (Bearer token) → current profile { contactName, email, phone, address }
// PATCH (Bearer token) → update contactName, email, phone, country; creates supplier notification

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function resolveSession(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const session = await prisma.customerSession.findUnique({
    where:   { token },
    include: { account: { select: { id: true, email: true, name: true, workspaceId: true } } },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.account
}

export async function GET(req: Request) {
  try {
    const account = await resolveSession(req)
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

    const customer = await prisma.customer.findFirst({
      where: { email: account.email, workspaceId: account.workspaceId },
      select: { id: true, contactName: true, email: true, phone: true, country: true },
    })
    if (!customer) return NextResponse.json({ error: 'Customer record not found' }, { status: 404, headers: CORS })

    return NextResponse.json({
      id:          customer.id,
      contactName: customer.contactName,
      email:       customer.email,
      phone:       customer.phone,
      address:     customer.country,   // country field repurposed as address
    }, { headers: CORS })
  } catch (err: any) {
    console.error('Portal profile GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request) {
  try {
    const account = await resolveSession(req)
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

    const body = await req.json()
    const { contactName, email, phone, address } = body

    const customer = await prisma.customer.findFirst({
      where: { email: account.email, workspaceId: account.workspaceId },
      select: { id: true, name: true, contactName: true },
    })
    if (!customer) return NextResponse.json({ error: 'Customer record not found' }, { status: 404, headers: CORS })

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(contactName !== undefined && { contactName: String(contactName).trim() }),
        ...(email       !== undefined && { email:       String(email).trim()       }),
        ...(phone       !== undefined && { phone:       String(phone).trim()       }),
        ...(address     !== undefined && { country:     String(address).trim()     }),
      },
    })

    // Also update the CustomerAccount name so the portal header stays in sync
    if (contactName !== undefined) {
      await prisma.customerAccount.update({
        where: { id: account.id },
        data:  { name: String(contactName).trim() },
      }).catch(() => {})
    }

    // Notify the supplier about the profile change
    const displayName = contactName ?? customer.contactName
    await prisma.notification.create({
      data: {
        workspaceId: account.workspaceId,
        type:        'customer',
        severity:    'info',
        title:       `${displayName} updated their profile`,
        body:        `Customer contact for ${customer.name} updated their details via the portal.`,
        tab:         'customers',
      },
    }).catch(() => {})

    return NextResponse.json({
      id:          updated.id,
      contactName: updated.contactName,
      email:       updated.email,
      phone:       updated.phone,
      address:     updated.country,
    }, { headers: CORS })
  } catch (err: any) {
    console.error('Portal profile PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}
