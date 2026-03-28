// app/api/portal/signup/route.ts
// Phase 9 — Customer Self-Signup
// Public route — no session needed.
// Validates the workspaceId, creates a Customer record, returns the portal code.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function generatePortalCode(companyName: string): string {
  const prefix = companyName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return prefix + suffix;
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { workspaceId, companyName, contactName, email, phone, industry } = body

    // ── Validate required fields ──────────────────────────────────────────
    if (!workspaceId)         return NextResponse.json({ error: 'workspaceId is required.' },    { status: 400 })
    if (!companyName?.trim()) return NextResponse.json({ error: 'Company name is required.' },   { status: 400 })
    if (!contactName?.trim()) return NextResponse.json({ error: 'Contact name is required.' },   { status: 400 })
    if (!email?.trim())       return NextResponse.json({ error: 'Email address is required.' },  { status: 400 })

    // ── Verify workspace exists ───────────────────────────────────────────
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Invalid signup link. Contact your supplier.' }, { status: 404 })
    }

    // ── Check email not already registered for this workspace ─────────────
    const existing = await prisma.customer.findFirst({
      where: {
        workspaceId,
        email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
      },
    })
    if (existing) {
      return NextResponse.json({
        error: 'An account with this email already exists. Use your existing portal code to log in.',
      }, { status: 409 })
    }

    // ── Generate a unique portal code ─────────────────────────────────────
    let portalCode = generatePortalCode(companyName)
    // Make sure the code is unique in this workspace
    let attempts = 0
    while (attempts < 10) {
      const clash = await prisma.customer.findFirst({
        where: { workspaceId, portalCode },
      })
      if (!clash) break
      portalCode = generatePortalCode(companyName)
      attempts++
    }

    // ── Create the customer ───────────────────────────────────────────────
    const customer = await prisma.customer.create({
      data: {
        name:        companyName.trim(),
        contactName: contactName.trim(),
        email:       email.trim().toLowerCase(),
        phone:       phone?.trim() || '',
        country:     '',
        industry:    industry?.trim() || '',
        creditLimit: 0,
        balanceDue:  0,
        status:      'active',
        portalCode,
        notes:       'Self-registered via customer portal.',
        orders:      [],
        workspaceId,
      },
    })

    return NextResponse.json({
      success:      true,
      portalCode,
      customerName: customer.name,
      contactName:  customer.contactName,
      supplierName: workspace.name,
    })
  } catch (err: any) {
    console.error('Portal signup error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
