// app/api/portal/orders/route.ts
// POST  → customer submits a quote REQUEST (creates a Quote, not an Order)
//         Supplier then prices it, sends it; customer accepts → Automation 2 creates the order.
// GET   → customer's confirmed orders (stage != Placed/quote-pending)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// Resolve via Bearer token (new token-session portal)
async function resolveByToken(token: string) {
  const session = await prisma.customerSession.findUnique({
    where: { token }, include: { account: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.account
}

// Resolve via customer ID + workspaceId (simple email/code portal)
async function resolveByBody(customerId: string, workspaceId: string) {
  if (!customerId || !workspaceId) return null
  return prisma.customer.findFirst({ where: { id: customerId, workspaceId } })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    let customerName: string
    let workspaceId: string

    if (token) {
      const acct = await resolveByToken(token)
      if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
      customerName = acct.name
      workspaceId  = acct.workspaceId
    } else {
      // Simple portal: body must carry workspaceId + customerId for server-side verification
      const acct = await resolveByBody(body.customerId ?? '', body.workspaceId ?? '')
      if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
      customerName = acct.name
      workspaceId  = acct.workspaceId
    }

    const sku   = (body.sku   ?? '').trim() || 'TBD'
    const qty   = parseInt(body.qty)   || 1
    const notes = (body.notes ?? '').trim()

    const year       = new Date().getFullYear()
    const rand       = String(Math.floor(Math.random() * 9000) + 1000)
    const quoteNumber = `QT-${year}-${rand}`
    const validUntil  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    // Create a QUOTE (not an order) — supplier will price and send it
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customer:     customerName,
        items: [{
          id:        'item-0',
          sku,
          desc:      notes || `Portal request — ${qty} × ${sku}`,
          qty,
          unitPrice: 0,      // supplier will fill this in
          discount:  0,
          total:     0,
        }],
        subtotal:     0,
        discountAmt:  0,
        tax:          0,
        total:        0,
        validUntil,
        paymentTerms: 'Net 30',
        notes:        notes || `Portal request from ${customerName}`,
        status:       'draft',   // supplier must set price → send → customer approves
        prompt:       `Portal request: ${qty} × ${sku}`,
        workspaceId,
      },
    })

    return NextResponse.json(quote, { status: 201, headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveByToken(token)
    if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
    const orders = await prisma.order.findMany({
      where: { workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
