// app/api/portal/invoices/route.ts
// GET → customer's invoices
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const invoices = await prisma.invoice.findMany({
      where: { workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
