import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const now = new Date()

    // Build last 7 months array
    const months = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1)
      return {
        label: d.toLocaleString('en-US', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      }
    })

    // Fetch all orders once
    const allOrders = await prisma.order.findMany({
      where: { workspaceId },
      select: { customer: true, value: true, createdAt: true, stage: true },
    })

    // Monthly revenue + orders
    const monthly = months.map(m => {
      const inMonth = allOrders.filter(o => {
        const d = new Date(o.createdAt)
        return d >= m.start && d <= m.end
      })
      const revenue  = inMonth.reduce((s, o) => s + (o.value || 0), 0)
      const orders   = inMonth.length
      const invoiced = Math.round(revenue * 0.95) // approx invoiced
      return { month: m.label, revenue, orders, invoiced }
    })

    // Top customers
    const customerMap: Record<string, { revenue: number; orders: number }> = {}
    for (const o of allOrders) {
      if (!customerMap[o.customer]) customerMap[o.customer] = { revenue: 0, orders: 0 }
      customerMap[o.customer].revenue += o.value || 0
      customerMap[o.customer].orders  += 1
    }
    const totalRevenue = allOrders.reduce((s, o) => s + (o.value || 0), 0)
    const topCustomers = Object.entries(customerMap)
      .map(([name, d]) => ({
        name,
        revenue: d.revenue,
        orders:  d.orders,
        share:   totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Order status distribution
    const stageCounts: Record<string, number> = {}
    for (const o of allOrders) {
      stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1
    }
    const stageColorMap: Record<string, string> = {
      Delivered: '#2e7d5e',
      Shipped:   '#3d6fb5',
      Confirmed: '#6b4ca0',
      Placed:    '#b86a00',
      Picked:    '#c0392b',
    }
    const orderStatusDist = Object.entries(stageCounts).map(([name, value]) => ({
      name,
      value,
      color: stageColorMap[name] || '#999',
    }))

    // Fetch top SKUs from inventory + orders
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      select: { sku: true, name: true, unitCost: true, stockLevel: true },
      orderBy: { unitCost: 'desc' },
      take: 5,
    })

    // Calculate SKU revenue from orders (match by sku field)
    const skuOrders = await prisma.order.findMany({
      where: { workspaceId },
      select: { sku: true, value: true, items: true },
    })
    const skuMap: Record<string, { revenue: number; units: number }> = {}
    for (const o of skuOrders) {
      if (!o.sku) continue
      if (!skuMap[o.sku]) skuMap[o.sku] = { revenue: 0, units: 0 }
      skuMap[o.sku].revenue += o.value || 0
      skuMap[o.sku].units   += o.items || 1
    }

    const topSKUs = inventoryItems.map(item => ({
      sku:     item.sku,
      desc:    item.name,
      revenue: skuMap[item.sku]?.revenue || 0,
      units:   skuMap[item.sku]?.units   || 0,
    })).sort((a, b) => b.revenue - a.revenue)

    // KPI deltas
    const cur  = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]

    return NextResponse.json({
      monthly,
      topCustomers,
      topSKUs,
      orderStatusDist,
      kpi: { cur, prev },
    })
  } catch (err: any) {
    console.error('Analytics GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
