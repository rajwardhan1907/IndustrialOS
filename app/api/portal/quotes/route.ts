// app/api/portal/quotes/route.ts
// GET  → customer's quotes
// PATCH { id, status: 'accepted'|'rejected' } → update quote status
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

async function resolveAccount(token: string) {
  const session = await prisma.customerSession.findUnique({
    where: { token }, include: { account: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.account
}

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveAccount(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
    const quotes = await prisma.quote.findMany({
      where: { workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(quotes, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveAccount(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })

    const body = await req.json()
    if (!body.id || !['accepted', 'rejected'].includes(body.status)) {
      return NextResponse.json({ error: 'id and status (accepted|rejected) are required' }, { status: 400, headers: CORS })
    }
    // Ensure the quote belongs to this customer
    const quote = await prisma.quote.findFirst({
      where: { id: body.id, workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
    })
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404, headers: CORS })

    const updated = await prisma.quote.update({
      where: { id: body.id },
      data:  { status: body.status },
    })
    return NextResponse.json(updated, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
