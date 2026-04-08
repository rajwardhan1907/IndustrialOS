// app/api/portal/auth/route.ts
// PUBLIC — no auth required
// POST { action: 'signup',      workspaceId, name, email, password }  → { token, account }
// POST { action: 'signin',      workspaceId, email, password }        → { token, account }
// POST { action: 'access_code', workspaceId, email, code }            → { token, account }
//   ↑ for existing customers who were given a portalCode by the admin
// DELETE (with token header)                                          → sign out

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

// Helper: create a session token for an account and return the JSON response.
// Defined at module level (not inside a block) to satisfy strict-mode rules.
const issueSession = async (account: { id: string; email: string; name: string }) => {
  const session = await prisma.customerSession.create({
    data: { accountId: account.id, token: crypto.randomUUID(), expiresAt: expiresAt() },
  })
  return NextResponse.json({
    token:   session.token,
    account: { id: account.id, email: account.email, name: account.name },
  }, { headers: CORS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, workspaceId, email, password, name, code } = body

    if (!workspaceId || !email) {
      return NextResponse.json({ error: 'workspaceId and email are required' }, { status: 400, headers: CORS })
    }

    // Make sure workspace exists
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })
    if (!ws) {
      return NextResponse.json({ error: 'Invalid portal link' }, { status: 404, headers: CORS })
    }

    // ── Sign Up ──────────────────────────────────────────────────────────────
    if (action === 'signup') {
      if (!name?.trim())   return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: CORS })
      if (!password)       return NextResponse.json({ error: 'Password is required' }, { status: 400, headers: CORS })
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
      return issueSession(account)
    }

    // ── Sign In with password ─────────────────────────────────────────────────
    if (action === 'signin') {
      if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400, headers: CORS })
      const account = await prisma.customerAccount.findUnique({
        where: { email_workspaceId: { email: email.toLowerCase().trim(), workspaceId } },
      })
      if (!account) {
        return NextResponse.json({ error: 'No account found with that email. Try signing in with an access code, or create an account.' }, { status: 401, headers: CORS })
      }
      const valid = await bcrypt.compare(password, account.password)
      if (!valid) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS })
      return issueSession(account)
    }

    // ── Sign In with access code (existing customers given a portalCode) ──────
    // Looks up the legacy Customer record by email + portalCode.
    // Creates a CustomerAccount for them on first use so future logins use password.
    if (action === 'access_code') {
      if (!code?.trim()) return NextResponse.json({ error: 'Access code is required' }, { status: 400, headers: CORS })
      const customer = await prisma.customer.findFirst({
        where: {
          workspaceId,
          email:      { equals: email.trim(),              mode: 'insensitive' },
          portalCode: { equals: code.trim().toUpperCase(), mode: 'insensitive' },
        },
      })
      if (!customer) {
        return NextResponse.json({ error: 'Email or access code is incorrect.' }, { status: 401, headers: CORS })
      }
      // Upsert a CustomerAccount so they can use the new portal
      let account = await prisma.customerAccount.findUnique({
        where: { email_workspaceId: { email: customer.email.toLowerCase(), workspaceId } },
      })
      if (!account) {
        account = await prisma.customerAccount.create({
          data: { email: customer.email.toLowerCase(), name: customer.name, password: '', workspaceId },
        })
      }
      return issueSession(account)
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
