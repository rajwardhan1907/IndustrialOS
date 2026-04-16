// app/api/portal/quotes/route.ts
// GET  → customer's quotes
// PATCH { id, status: 'accepted'|'rejected' } → update quote status
//        Automation 2: status → 'accepted' → auto-create Order + subtract inventory
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

// Bearer-token auth (new-style portal with CustomerSession)
async function resolveByToken(token: string) {
  const session = await prisma.customerSession.findUnique({
    where: { token }, include: { account: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.account
}

// Body auth (simple portal — customerId + workspaceId)
async function resolveByIds(customerId: string, workspaceId: string) {
  if (!customerId || !workspaceId) return null
  return prisma.customer.findFirst({ where: { id: customerId, workspaceId } })
}

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    const acct = await resolveByToken(token)
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
    const body  = await req.json()
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    // Resolve customer — Bearer token (new portal) OR customerId+workspaceId (simple portal)
    let acct: { name: string; workspaceId: string } | null = null
    if (token) {
      acct = await resolveByToken(token)
      if (!acct) return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
    } else {
      acct = await resolveByIds(body.customerId ?? '', body.workspaceId ?? '')
      if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    }

    if (!body.id || !['accepted', 'declined'].includes(body.status)) {
      return NextResponse.json({ error: 'id and status (accepted|declined) are required' }, { status: 400, headers: CORS })
    }
    // Ensure the quote belongs to this customer
    const quote = await prisma.quote.findFirst({
      where: { id: body.id, workspaceId: acct.workspaceId, customer: { mode: 'insensitive', equals: acct.name } },
    })
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404, headers: CORS })

    // Only allow accepting quotes that have been priced (total > 0)
    if (body.status === 'accepted' && (quote.total ?? 0) === 0) {
      return NextResponse.json({ error: 'This quote has not been priced yet. Please wait for your supplier.' }, { status: 400, headers: CORS })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id: body.id },
        data:  { status: body.status },
      })

      // Automation 2 — auto-create order when customer accepts quote
      if (body.status === 'accepted') {
        const itemsArr = Array.isArray(updated.items) ? updated.items as any[] : []
        const primarySku = itemsArr[0]?.sku ?? updated.quoteNumber ?? ''
        const totalQty   = itemsArr.reduce((sum: number, it: any) => sum + (Number(it?.qty) || 1), 0)

        await tx.order.create({
          data: {
            customer:    updated.customer,
            sku:         primarySku,
            items:       totalQty,
            value:       updated.total,
            stage:       'Placed',
            priority:    'MED',
            source:      'quote',
            notes:       `Auto-created from quote ${updated.quoteNumber} (portal)`,
            workspaceId: updated.workspaceId,
          },
        })

        // Subtract inventory for all line items
        for (const lineItem of itemsArr) {
          const sku = lineItem?.sku
          const qty = Number(lineItem?.qty ?? 0)
          if (!sku || qty <= 0) continue
          const invItem = await tx.inventoryItem.findFirst({
            where: { sku, workspaceId: updated.workspaceId },
          })
          if (invItem) {
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data:  { stockLevel: Math.max(0, invItem.stockLevel - qty) },
            })
          }
        }
      }

      return updated
    })

    return NextResponse.json(result, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}
