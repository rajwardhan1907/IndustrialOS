// app/api/portal/signup/route.ts
// Receives a customer self-signup request.
// Creates the customer in DB with status "pending" — admin must approve.
// Does NOT send an access code yet — that happens when admin approves.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { companyName, contactName, email, phone, industry, address, workspaceId } = body

    // ── Validate ──────────────────────────────────────────────────────────
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
    }
    if (!contactName?.trim()) {
      return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }
    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required.' }, { status: 400 })
    }
    if (!workspaceId) {
      return NextResponse.json({ error: 'Invalid signup link.' }, { status: 400 })
    }

    // ── Verify workspace exists ───────────────────────────────────────────
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Invalid signup link.' }, { status: 404 })
    }

    // ── Check for duplicate email in this workspace ───────────────────────
    const existing = await prisma.customer.findFirst({
      where: {
        workspaceId,
        email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A customer with this email already exists. Contact your supplier.' },
        { status: 409 }
      )
    }

    // ── Create customer as "pending" — no portal code yet ────────────────
    const customer = await prisma.customer.create({
      data: {
        name:        companyName.trim(),
        contactName: contactName.trim(),
        email:       email.trim().toLowerCase(),
        phone:       phone?.trim() || '',
        country:     address.trim(),   // reusing country field for address
        industry:    industry || 'Other',
        status:      'pending',        // admin must approve
        portalCode:  '',               // set by admin on approval
        creditLimit: 0,
        balanceDue:  0,
        notes:       'Self-signed up via customer portal.',
        orders:      [],
        workspaceId,
      },
    })

    return NextResponse.json({ success: true, customerId: customer.id })
  } catch (err: any) {
    console.error('Portal signup error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
