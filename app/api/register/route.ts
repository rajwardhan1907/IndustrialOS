import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST — Register a new company + first admin user in one atomic transaction
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { companyName, industry, name, email, password } = body

    // ── Validate required fields ──────────────────────────────────────────
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // ── Check if email already exists ─────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // ── Hash password ─────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10)

    // ── Create Workspace + User in one transaction ────────────────────────
    // If either fails, both are rolled back — no orphaned records
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name:     companyName.trim(),
          industry: industry?.trim() || 'Other',
        },
      })

      const user = await tx.user.create({
        data: {
          email:       email.trim().toLowerCase(),
          password:    hashedPassword,
          name:        name.trim(),
          role:        'admin', // first user of a workspace is always admin
          workspaceId: workspace.id,
        },
      })

      return { workspace, user }
    })

    // ── Return workspace id so the client can store it ────────────────────
    return NextResponse.json({
      success:     true,
      workspaceId: result.workspace.id,
      userId:      result.user.id,
      email:       result.user.email,
      name:        result.user.name,
      role:        result.user.role,
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
