// app/api/portal/payments/route.ts
// POST { invoiceId, amount } → marks invoice as paid (stub for Stripe integration)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveAccount(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })

    const body = await req.json()
    if (!body.invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400, headers: CORS })

    // Verify invoice belongs to this customer
    const inv = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
    })
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: CORS })

    const payAmount  = body.amount ?? (inv.total - inv.amountPaid)
    const newPaid    = Math.min(inv.amountPaid + payAmount, inv.total)
    const newStatus  = newPaid >= inv.total ? 'paid' : 'partial'

    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data:  { amountPaid: newPaid, status: newStatus },
    })
    return NextResponse.json({ success: true, invoice: updated }, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
