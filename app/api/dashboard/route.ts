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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneHourAgo   = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo    = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Run all queries in parallel
    const [
      allOrders,
      recentOrders,
      skuCount,
      recentInventory,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { workspaceId },
        select: { value: true, stage: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { workspaceId, createdAt: { gte: oneHourAgo } },
        select: { createdAt: true, value: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.inventoryItem.count({ where: { workspaceId } }),
      prisma.inventoryItem.count({
        where: {
          workspaceId,
          lastSynced: { gte: oneDayAgo.toISOString() },
        },
      }),
    ])

    // Orders per minute (last 60 seconds)
    const opm = allOrders.filter(
      o => new Date(o.createdAt) >= oneMinuteAgo
    ).length

    // Active orders (not delivered)
    const activeOrders = allOrders.filter(o => o.stage !== 'Delivered').length

    // Queue depth (Placed + Confirmed = not yet being worked)
    const queue = allOrders.filter(
      o => o.stage === 'Placed' || o.stage === 'Confirmed'
    ).length

    // Revenue this month
    const rev = allOrders
      .filter(o => new Date(o.createdAt) >= startOfMonth)
      .reduce((sum, o) => sum + (o.value || 0), 0)

    // Sync health — % of SKUs synced in last 24h
    const sync = skuCount > 0
      ? parseFloat(((recentInventory / skuCount) * 100).toFixed(1))
      : 0

    // Chart data — last 12 x 5-minute buckets
    const chart = Array.from({ length: 12 }, (_, i) => {
      const bucketEnd   = new Date(now.getTime() - i * 5 * 60 * 1000)
      const bucketStart = new Date(bucketEnd.getTime() - 5 * 60 * 1000)
      const label = bucketEnd.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
      const orders = recentOrders.filter(o => {
        const t = new Date(o.createdAt)
        return t >= bucketStart && t < bucketEnd
      }).length
      const latency = Math.floor(Math.random() * 40 + 60) // simulated — real APM needed for true latency
      const errors  = Math.floor(Math.random() * 2)
      return { t: label, orders, latency, errors }
    }).reverse()

    // Alerts
    const alerts: { id: number; sev: string; msg: string; time: string }[] = []
    if (queue > 10) {
      alerts.push({ id: 1, sev: 'warn', msg: `${queue} orders waiting in queue`, time: 'now' })
    }
    if (activeOrders === 0 && allOrders.length === 0) {
      alerts.push({ id: 2, sev: 'info', msg: 'No orders yet — add your first order in the Orders tab', time: 'now' })
    }

    return NextResponse.json({
      met: {
        opm,
        skus: skuCount,
        sync,
        activeOrders,
        rev: Math.round(rev),
        latency: 87,   // placeholder until real APM
        queue,
        conflicts: 0,  // conflicts live in localStorage
      },
      chart,
      alerts,
    }, { headers: CORS })
  } catch (err: any) {
    console.error('Dashboard GET error:', err)

    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
