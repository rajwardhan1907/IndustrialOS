// app/api/pricing-rules/route.ts
// Phase 12 — Pricing Rules Engine
// GET    /api/pricing-rules?workspaceId=xxx  → list all rules for workspace
// POST   /api/pricing-rules                  → create a new rule
// PATCH  /api/pricing-rules                  → update a rule (toggle, rename, etc.)
// DELETE /api/pricing-rules?id=xxx           → delete a rule

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const rules = await prisma.pricingRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(rules)
  } catch (err: any) {
    console.error('PricingRules GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!['volume', 'customer'].includes(body.type)) {
      return NextResponse.json({ error: 'type must be volume or customer' }, { status: 400 })
    }
    const rule = await prisma.pricingRule.create({
      data: {
        name:         body.name.trim(),
        type:         body.type,
        minQty:       body.type === 'volume'   ? (body.minQty ?? 0)       : 0,
        customerName: body.type === 'customer' ? (body.customerName ?? '') : '',
        discountPct:  body.discountPct ?? 0,
        active:       body.active ?? true,
        workspaceId:  body.workspaceId,
      },
    })
    return NextResponse.json(rule)
  } catch (err: any) {
    console.error('PricingRules POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const rule = await prisma.pricingRule.update({
      where: { id: body.id },
      data: {
        ...(body.name         !== undefined && { name:         body.name         }),
        ...(body.discountPct  !== undefined && { discountPct:  body.discountPct  }),
        ...(body.minQty       !== undefined && { minQty:       body.minQty       }),
        ...(body.customerName !== undefined && { customerName: body.customerName }),
        ...(body.active       !== undefined && { active:       body.active       }),
      },
    })
    return NextResponse.json(rule)
  } catch (err: any) {
    console.error('PricingRules PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await prisma.pricingRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PricingRules DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
