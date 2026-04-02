// app/api/notifications/route.ts
// Queries the DB for real alerts — overdue invoices, low stock, new portal orders,
// and expiring/expired contracts (Phase 12 roadmap).
// No new DB table needed. Read state is tracked in localStorage on the client.

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

    const today    = new Date()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // ── 1. Overdue invoices ──────────────────────────────────────────────────
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        workspaceId,
        status:  { not: 'paid' },
        dueDate: { lt: today.toISOString().split('T')[0] },
      },
      select: { id: true, invoiceNumber: true, customer: true, total: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    })

    // ── 2. Low stock items ───────────────────────────────────────────────────
    const allInventory = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      select: { id: true, sku: true, name: true, stockLevel: true, reorderPoint: true },
    })
    const lowStock = allInventory.filter(i => i.stockLevel <= i.reorderPoint)

    // ── 3. Expiring / expired contracts (Phase 12 roadmap) ───────────────────
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

    // ── 4. New portal orders (last 24 hours) ─────────────────────────────────
    const portalOrders = await prisma.order.findMany({
      where: {
        workspaceId,
        source:    'portal',
        createdAt: { gte: yesterday },
      },
      select: { id: true, customer: true, sku: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // ── Shape into a flat notification list ──────────────────────────────────
    const notifications: any[] = []

    overdueInvoices.forEach(inv => {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / 86400000
      )
      notifications.push({
        id:       `inv-${inv.id}`,
        type:     'invoice',
        severity: daysOverdue > 7 ? 'error' : 'warn',
        title:    `Overdue Invoice — ${inv.customer}`,
        body:     `${inv.invoiceNumber} · $${inv.total.toLocaleString()} · ${daysOverdue}d overdue`,
        tab:      'invoicing',
        createdAt: inv.dueDate,
      })
    })

    lowStock.forEach(item => {
      const isCritical = item.stockLevel === 0 || item.stockLevel <= item.reorderPoint * 0.5
      notifications.push({
        id:       `inv-stock-${item.id}`,
        type:     'inventory',
        severity: isCritical ? 'error' : 'warn',
        title:    item.stockLevel === 0 ? `Out of Stock — ${item.sku}` : `Low Stock — ${item.sku}`,
        body:     `${item.name} · ${item.stockLevel} units left (reorder at ${item.reorderPoint})`,
        tab:      'inventory',
        createdAt: new Date().toISOString(),
      })
    })

    expiringContracts.forEach(c => {
      const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - today.getTime()) / 86400000)
      const expired  = daysLeft < 0
      notifications.push({
        id:       `contract-${c.id}`,
        type:     'contract',
        severity: expired ? 'error' : 'warn',
        title:    expired
          ? `Contract Expired — ${c.customer}`
          : `Contract Expiring — ${c.customer}`,
        body:     expired
          ? `${c.contractNumber} · ${c.title} · expired ${Math.abs(daysLeft)}d ago`
          : `${c.contractNumber} · ${c.title} · expires in ${daysLeft}d`,
        tab:      'contracts',
        createdAt: c.expiryDate,
      })
    })

    portalOrders.forEach(order => {
      notifications.push({
        id:       `order-${order.id}`,
        type:     'order',
        severity: 'info',
        title:    `New Portal Order — ${order.customer}`,
        body:     `${order.sku} · Submitted via customer portal`,
        tab:      'orders',
        createdAt: order.createdAt,
      })
    })

    return NextResponse.json({ notifications }, { headers: CORS })
  } catch (err: any) {
    console.error('Notifications GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// PATCH — mark a notification as read (graceful no-op; read state is derived from source data)
export async function PATCH(req: Request) {
  try {
    // Notification read state is derived at query time from source records.
    // We accept the call so the mobile app doesn't get a 405, and return success.
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
