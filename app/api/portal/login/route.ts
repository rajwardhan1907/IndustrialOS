// app/api/portal/login/route.ts
// Customer Portal login — NO password, just email + access code (portalCode).
// Looks up the customer in the DB, returns their orders, invoices, and quotes.
// This route is intentionally public (no session needed) — the portal is customer-facing.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json()

    if (!email?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: 'Email and access code are required.' },
        { status: 400 }
      )
    }

    // Find customer by contact email and portal code (both case-insensitive)
    const customer = await prisma.customer.findFirst({
      where: {
        email:      { equals: email.trim(),       mode: 'insensitive' },
        portalCode: { equals: code.trim().toUpperCase() },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Email or access code is incorrect. Please check with your supplier.' },
        { status: 401 }
      )
    }

    // Fetch their orders from the Order table
    const orders = await prisma.order.findMany({
      where: {
        workspaceId: customer.workspaceId,
        customer:    { equals: customer.name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Fetch their invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        workspaceId: customer.workspaceId,
        customer:    { equals: customer.name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Fetch their quotes
    const quotes = await prisma.quote.findMany({
      where: {
        workspaceId: customer.workspaceId,
        customer:    { equals: customer.name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      customer: {
        id:          customer.id,
        name:        customer.name,
        contactName: customer.contactName,
        email:       customer.email,
        portalCode:  customer.portalCode,
        workspaceId: customer.workspaceId,
        creditLimit: customer.creditLimit,
        balanceDue:  customer.balanceDue,
        status:      customer.status,
        notes:       customer.notes,
      },
      orders,
      invoices,
      quotes,
    })
  } catch (err: any) {
    console.error('Portal login error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
