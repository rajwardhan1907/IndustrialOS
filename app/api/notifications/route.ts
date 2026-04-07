// app/api/notifications/route.ts
// Phase 25: Persistent DB-backed notifications + derived alerts.
// GET  ?workspaceId=  — returns DB notifications merged with derived alerts
// POST { workspaceId, type, severity, title, body, tab } — create a notification
// PATCH { id } — mark a notification as read

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const today     = new Date()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // ── 1. DB-stored notifications (from routes like orders, tickets) ─────────
    const dbRows = await prisma.notification.findMany({
      where:   { workspaceId },
      orderBy: { createdAt: 'desc' },
      take:    100,
    })
    const dbNotifications = dbRows.map(n => ({
      id:        n.id,
      type:      n.type,
      severity:  n.severity,
      title:     n.title,
      body:      n.body,
      tab:       n.tab,
      read:      n.read,
      createdAt: n.createdAt,
      source:    'db' as const,
    }))

    // ── 2. Overdue invoices (derived) ────────────────────────────────────────
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        workspaceId,
        status:  { not: 'paid' },
        dueDate: { lt: today.toISOString().split('T')[0] },
      },
      select: { id: true, invoiceNumber: true, customer: true, total: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    })

    // ── 3. Low stock items (derived) — exclude items where reorderPoint = 0 ──
    const allInventory = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      select: { id: true, sku: true, name: true, stockLevel: true, reorderPoint: true },
    })
    // Fix 4: items with reorderPoint = 0 are not monitored — they have no threshold
    const lowStock = allInventory.filter(i => i.reorderPoint > 0 && i.stockLevel <= i.reorderPoint)

    // ── 4. Expiring / expired contracts (derived) ────────────────────────────
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const expiringContracts = await prisma.contract.findMany({
      where: {
        workspaceId,
        status:     { not: 'draft' },
        expiryDate: { lte: in30Days },
      },
      select: { id: true, contractNumber: true, title: true, customer: true, expiryDate: true },
      orderBy: { expiryDate: 'asc' },
    })

    // ── 5. New portal orders (last 24 hours, derived) ─────────────────────────
    const portalOrders = await prisma.order.findMany({
      where: {
        workspaceId,
        source:    'portal',
        createdAt: { gte: yesterday },
      },
      select: { id: true, customer: true, sku: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // ── Shape derived alerts ──────────────────────────────────────────────────
    const derived: any[] = []

    overdueInvoices.forEach(inv => {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / 86400000
      )
      derived.push({
        id:        `inv-${inv.id}`,
        type:      'invoice',
        severity:  daysOverdue > 7 ? 'error' : 'warn',
        title:     `Overdue Invoice — ${inv.customer}`,
        body:      `${inv.invoiceNumber} · $${inv.total.toLocaleString()} · ${daysOverdue}d overdue`,
        tab:       'invoicing',
        read:      false,
        createdAt: inv.dueDate,
        source:    'derived' as const,
      })
    })

    lowStock.forEach(item => {
      const isCritical = item.stockLevel === 0 || item.stockLevel <= item.reorderPoint * 0.5
      derived.push({
        id:        `inv-stock-${item.id}`,
        type:      'inventory',
        severity:  isCritical ? 'error' : 'warn',
        title:     item.stockLevel === 0 ? `Out of Stock — ${item.sku}` : `Low Stock — ${item.sku}`,
        body:      `${item.name} · ${item.stockLevel} units left (reorder at ${item.reorderPoint})`,
        tab:       'inventory',
        read:      false,
        createdAt: new Date().toISOString(),
        source:    'derived' as const,
      })
    })

    expiringContracts.forEach(c => {
      const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - today.getTime()) / 86400000)
      const expired  = daysLeft < 0
      derived.push({
        id:        `contract-${c.id}`,
        type:      'contract',
        severity:  expired ? 'error' : 'warn',
        title:     expired ? `Contract Expired — ${c.customer}` : `Contract Expiring — ${c.customer}`,
        body:      expired
          ? `${c.contractNumber} · ${c.title} · expired ${Math.abs(daysLeft)}d ago`
          : `${c.contractNumber} · ${c.title} · expires in ${daysLeft}d`,
        tab:       'contracts',
        read:      false,
        createdAt: c.expiryDate,
        source:    'derived' as const,
      })
    })

    portalOrders.forEach(order => {
      derived.push({
        id:        `order-${order.id}`,
        type:      'order',
        severity:  'info',
        title:     `New Portal Order — ${order.customer}`,
        body:      `${order.sku} · Submitted via customer portal`,
        tab:       'orders',
        read:      false,
        createdAt: order.createdAt,
        source:    'derived' as const,
      })
    })

    // Merge: DB notifications first (most recent activity), then derived alerts
    const notifications = [...dbNotifications, ...derived]

    return NextResponse.json({ notifications }, { headers: CORS })
  } catch (err: any) {
    console.error('Notifications GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// POST — create a persistent notification (called by other routes)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId || !body.title) {
      return NextResponse.json({ error: 'workspaceId and title are required' }, { status: 400, headers: CORS })
    }
    const notif = await prisma.notification.create({
      data: {
        workspaceId: body.workspaceId,
        type:        body.type     ?? 'info',
        severity:    body.severity ?? 'info',
        title:       body.title,
        body:        body.body     ?? '',
        tab:         body.tab      ?? '',
      },
    })
    return NextResponse.json(notif, { headers: CORS })
  } catch (err: any) {
    console.error('Notifications POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// PATCH — mark a DB notification as read
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      // Graceful: mobile app may call PATCH without id; return success
      return NextResponse.json({ success: true }, { headers: CORS })
    }
    await prisma.notification.update({
      where: { id: body.id },
      data:  { read: true },
    })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    // If the id is a derived notification (not in DB), ignore gracefully
    return NextResponse.json({ success: true }, { headers: CORS })
  }
}
