// app/api/portal/auth/route.ts
// PUBLIC — no auth required
// POST { action: 'signup', workspaceId, name, email, password }  → { token, account }
// POST { action: 'signin', workspaceId, email, password }        → { token, account }
// DELETE (with token header)                                      → sign out

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// 30-day session
function expiresAt() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, workspaceId, email, password, name } = body

    if (!workspaceId || !email || !password) {
      return NextResponse.json({ error: 'workspaceId, email, and password are required' }, { status: 400, headers: CORS })
    }

    // Make sure workspace exists
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })
    if (!ws) {
      return NextResponse.json({ error: 'Invalid portal link' }, { status: 404, headers: CORS })
    }

    // ── Sign Up ──────────────────────────────────────────────────────────────
    if (action === 'signup') {
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: CORS })
      }
      const existing = await prisma.customerAccount.findUnique({
        where: { email_workspaceId: { email: email.toLowerCase().trim(), workspaceId } },
      })
      if (existing) {
        return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409, headers: CORS })
      }
      const hash    = await bcrypt.hash(password, 10)
      const account = await prisma.customerAccount.create({
        data: { email: email.toLowerCase().trim(), name: name.trim(), password: hash, workspaceId },
      })
      const session = await prisma.customerSession.create({
        data: { accountId: account.id, token: crypto.randomUUID(), expiresAt: expiresAt() },
      })
      return NextResponse.json({
        token:   session.token,
        account: { id: account.id, email: account.email, name: account.name },
      }, { headers: CORS })
    }

    // ── Sign In ──────────────────────────────────────────────────────────────
    if (action === 'signin') {
      const account = await prisma.customerAccount.findUnique({
        where: { email_workspaceId: { email: email.toLowerCase().trim(), workspaceId } },
      })
      if (!account) {
        return NextResponse.json({ error: 'No account found with that email.' }, { status: 401, headers: CORS })
      }
      const valid = await bcrypt.compare(password, account.password)
      if (!valid) {
        return NextResponse.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS })
      }
      const session = await prisma.customerSession.create({
        data: { accountId: account.id, token: crypto.randomUUID(), expiresAt: expiresAt() },
      })
      return NextResponse.json({
        token:   session.token,
        account: { id: account.id, email: account.email, name: account.name },
      }, { headers: CORS })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: CORS })
  } catch (err: any) {
    console.error('Portal auth error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}

// Sign out — delete session
export async function DELETE(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      await prisma.customerSession.deleteMany({ where: { token } }).catch(() => {})
    }
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ success: true }, { headers: CORS })
  }
}
