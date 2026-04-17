import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createNotification,
  checkCustomerCredit,
  validateContractMinOrderQty,
  validatePositive,
  validateNonNegative,
  recalcDSO,
} from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// Helper — subtract inventory for a confirmed order
async function subtractInventory(tx: any, sku: string, qty: number, workspaceId: string) {
  if (!sku || qty <= 0) return
  const invItem = await tx.inventoryItem.findFirst({ where: { sku, workspaceId } })
  if (invItem) {
    await tx.inventoryItem.update({
      where: { id: invItem.id },
      data:  { stockLevel: Math.max(0, invItem.stockLevel - qty) },
    })
  }
}

// Reverse inventory (add qty back) — used on order delete if order was confirmed
async function reverseInventory(tx: any, sku: string, qty: number, workspaceId: string) {
  if (!sku || qty <= 0) return
  const invItem = await tx.inventoryItem.findFirst({ where: { sku, workspaceId } })
  if (invItem) {
    await tx.inventoryItem.update({
      where: { id: invItem.id },
      data:  { stockLevel: invItem.stockLevel + qty },
    })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const orders = await prisma.order.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders, { headers: CORS })
  } catch (err: any) {
    console.error('Orders GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }

    // Numeric validation
    const vErr =
      validatePositive(body.items, 'items') ??
      validateNonNegative(body.value, 'value')
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const isConfirmed = body.stage === 'Confirmed'
    const customerName: string = body.customer ?? 'Unknown'
    const value = Number(body.value ?? 0)
    const qty   = Number(body.items ?? 1)

    try {
      const order = await prisma.$transaction(async (tx) => {
        // Credit check — block if on hold or would exceed limit
        const credit = await checkCustomerCredit(tx, body.workspaceId, customerName, value)
        if (!credit.ok) {
          throw new Error(`Credit check failed: ${credit.reason}`)
        }

        // Contract min order qty check
        const contract = await validateContractMinOrderQty(tx, body.workspaceId, customerName, qty)
        if (!contract.ok) {
          throw new Error(`Contract violation: ${contract.reason}`)
        }

        const created = await tx.order.create({
          data: {
            customer:    customerName,
            sku:         body.sku         ?? '',
            items:       qty,
            value:       value,
            stage:       body.stage       ?? 'Placed',
            priority:    body.priority    ?? 'MED',
            source:      body.source      ?? 'manual',
            notes:       body.notes       ?? '',
            quoteId:     body.quoteId     || null,
            workspaceId: body.workspaceId,
          },
        })

        if (isConfirmed) {
          await subtractInventory(tx, created.sku, created.items, created.workspaceId)
        }

        return created
      })

      return NextResponse.json(order, { headers: CORS })
    } catch (txErr: any) {
      // Surface business rule failures (credit, contract) as 400
      if (txErr.message?.startsWith('Credit check failed') || txErr.message?.startsWith('Contract violation')) {
        return NextResponse.json({ error: txErr.message }, { status: 400, headers: CORS })
      }
      throw txErr
    }
  } catch (err: any) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    const vErr =
      (body.items !== undefined ? validatePositive(body.items, 'items') : null) ??
      (body.value !== undefined ? validateNonNegative(body.value, 'value') : null)
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400, headers: CORS })

    const order = await prisma.$transaction(async (tx) => {
      const prev = await tx.order.findUnique({
        where: { id: body.id },
        select: { stage: true, customer: true, value: true, items: true, sku: true, workspaceId: true },
      })
      if (!prev) throw new Error('Order not found')

      const updated = await tx.order.update({
        where: { id: body.id },
        data: {
          ...(body.stage    !== undefined && { stage:    body.stage    }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.notes    !== undefined && { notes:    body.notes    }),
          ...(body.value    !== undefined && { value:    Number(body.value) }),
          ...(body.sku      !== undefined && { sku:      body.sku      }),
          ...(body.items    !== undefined && { items:    Number(body.items) }),
          ...(body.customer !== undefined && { customer: body.customer }),
          ...(body.quoteId  !== undefined && { quoteId:  body.quoteId || null }),
        },
      })

      // Stage → Confirmed
      if (body.stage === 'Confirmed' && prev.stage !== 'Confirmed') {
        await subtractInventory(tx, updated.sku, updated.items, updated.workspaceId)

        const custConfirmed = await tx.customer.findFirst({
          where: { workspaceId: updated.workspaceId, name: { mode: 'insensitive', equals: updated.customer } },
        })
        if (custConfirmed) {
          await tx.customer.update({
            where: { id: custConfirmed.id },
            data:  { totalSpend: custConfirmed.totalSpend + updated.value },
          })
        }

        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'order',
          severity: 'info',
          title: `Order Confirmed — ${updated.customer}`,
          body: `${updated.sku} · ${updated.items} units · $${updated.value.toLocaleString()}`,
          tab: 'orders',
          linkedType: 'order',
          linkedId: updated.id,
          groupKey: `order-confirmed-${updated.id}`,
        })
      }

      // Stage → Shipped: auto-create shipment with FK link
      if (body.stage === 'Shipped' && prev.stage !== 'Shipped') {
        const existing = await tx.shipment.findFirst({ where: { orderId: updated.id } })
        if (!existing) {
          await tx.shipment.create({
            data: {
              shipmentNumber: 'SHP-' + updated.id.slice(-6).toUpperCase(),
              orderId:        updated.id,
              customer:       updated.customer,
              status:         'in_transit',
              carrier:        'TBD',
              workspaceId:    updated.workspaceId,
            },
          })
        }
        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'order',
          severity: 'info',
          title: `Order Shipped — ${updated.customer}`,
          body: `${updated.sku} · shipment created`,
          tab: 'shipping',
          linkedType: 'order',
          linkedId: updated.id,
          groupKey: `order-shipped-${updated.id}`,
        })
      }

      // Stage → Delivered: auto-create invoice with orderId FK
      if (body.stage === 'Delivered' && prev.stage !== 'Delivered') {
        const existingInv = await tx.invoice.findFirst({
          where: { orderId: updated.id, workspaceId: updated.workspaceId },
        })
        if (!existingInv) {
          const today   = new Date()
          const due     = new Date(today)
          due.setDate(due.getDate() + 30)
          const unitPrice = updated.items > 0 ? updated.value / updated.items : updated.value
          const workspace = await tx.workspace.findUnique({ where: { id: updated.workspaceId }, select: { currency: true } })
          await tx.invoice.create({
            data: {
              invoiceNumber: 'INV-' + updated.id.slice(-6).toUpperCase(),
              customer:      updated.customer,
              total:         updated.value,
              subtotal:      updated.value,
              tax:           0,
              amountPaid:    0,
              status:        'unpaid',
              paymentTerms:  'Net 30',
              issueDate:     today.toISOString().split('T')[0],
              dueDate:       due.toISOString().split('T')[0],
              currency:      workspace?.currency ?? 'USD',
              notes:         '',
              items:         [{ description: updated.sku, qty: updated.items, unitPrice }],
              orderId:       updated.id,
              workspaceId:   updated.workspaceId,
            },
          })

          const custDelivered = await tx.customer.findFirst({
            where: { workspaceId: updated.workspaceId, name: { mode: 'insensitive', equals: updated.customer } },
          })
          if (custDelivered) {
            await tx.customer.update({
              where: { id: custDelivered.id },
              data:  { balanceDue: custDelivered.balanceDue + updated.value },
            })
          }
          await recalcDSO(tx, updated.workspaceId, updated.customer)
        }
        // Keep shipment in sync
        await tx.shipment.updateMany({
          where: { orderId: updated.id, status: { not: 'delivered' } },
          data: { status: 'delivered', deliveredDate: new Date().toISOString().split('T')[0] },
        })

        await createNotification(tx, {
          workspaceId: updated.workspaceId,
          type: 'order',
          severity: 'info',
          title: `Order Delivered — ${updated.customer}`,
          body: `${updated.sku} · invoice auto-created`,
          tab: 'invoicing',
          linkedType: 'order',
          linkedId: updated.id,
          groupKey: `order-delivered-${updated.id}`,
        })
      }

      return updated
    })

    return NextResponse.json(order, { headers: CORS })
  } catch (err: any) {
    console.error('Orders PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE — cascade delete shipments/invoices/returns, reverse inventory, adjust balance
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } })
      if (!order) throw new Error('Order not found')

      // 1. Reverse inventory if the order consumed stock (Confirmed+)
      const stockConsumingStages = ['Confirmed', 'Shipped', 'Delivered']
      if (stockConsumingStages.includes(order.stage)) {
        await reverseInventory(tx, order.sku, order.items, order.workspaceId)
      }

      // 2. Adjust customer balance for any unpaid invoices on this order
      const invoices = await tx.invoice.findMany({ where: { orderId: id } })
      const outstanding = invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0)
      const totalSpendReversal = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0)

      const customer = await tx.customer.findFirst({
        where: { workspaceId: order.workspaceId, name: { mode: 'insensitive', equals: order.customer } },
      })
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            balanceDue: Math.max(0, customer.balanceDue - outstanding),
            totalSpend: Math.max(0, customer.totalSpend - totalSpendReversal - (order.stage === 'Confirmed' ? order.value : 0)),
          },
        })
      }

      // 3. Cascade delete shipments, invoices (and their payment records), returns
      await tx.paymentRecord.deleteMany({
        where: { invoiceId: { in: invoices.map(i => i.id) } },
      })
      await tx.invoice.deleteMany({ where: { orderId: id } })
      await tx.shipment.deleteMany({ where: { orderId: id } })
      await tx.return.deleteMany({ where: { orderId: id } })

      // 4. Finally delete the order
      await tx.order.delete({ where: { id } })
    })

    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Orders DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
