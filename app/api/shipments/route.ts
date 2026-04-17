import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/automation'

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
    const shipments = await prisma.shipment.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(shipments, { headers: CORS })
  } catch (err: any) {
    console.error('Shipments GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const shipment = await prisma.shipment.create({
      data: {
        shipmentNumber: body.shipmentNumber ?? '',
        orderId:        body.orderId        || null,
        customer:       body.customer       ?? '',
        carrier:        body.carrier        ?? 'Other',
        trackingNumber: body.trackingNumber ?? '',
        status:         body.status         ?? 'pending',
        origin:         body.origin         ?? '',
        destination:    body.destination    ?? '',
        weight:         body.weight         ?? '',
        dimensions:     body.dimensions     ?? '',
        estimatedDate:  body.estimatedDate  ?? '',
        deliveredDate:  body.deliveredDate  ?? '',
        events:         body.events         ?? [],
        notes:          body.notes          ?? '',
        workspaceId:    body.workspaceId,
      },
    })
    return NextResponse.json(shipment, { headers: CORS })
  } catch (err: any) {
    console.error('Shipments POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// PATCH — when status transitions to "delivered", auto-mark linked Order as Delivered
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const prev = await tx.shipment.findUnique({ where: { id: body.id }, select: { status: true, orderId: true } })
      if (!prev) throw new Error('Shipment not found')

      const updated = await tx.shipment.update({
        where: { id: body.id },
        data: {
          ...(body.shipmentNumber !== undefined && { shipmentNumber: body.shipmentNumber }),
          ...(body.orderId        !== undefined && { orderId:        body.orderId || null }),
          ...(body.customer       !== undefined && { customer:       body.customer       }),
          ...(body.carrier        !== undefined && { carrier:        body.carrier        }),
          ...(body.trackingNumber !== undefined && { trackingNumber: body.trackingNumber }),
          ...(body.status         !== undefined && { status:         body.status         }),
          ...(body.origin         !== undefined && { origin:         body.origin         }),
          ...(body.destination    !== undefined && { destination:    body.destination    }),
          ...(body.weight         !== undefined && { weight:         body.weight         }),
          ...(body.dimensions     !== undefined && { dimensions:     body.dimensions     }),
          ...(body.estimatedDate  !== undefined && { estimatedDate:  body.estimatedDate  }),
          ...(body.deliveredDate  !== undefined && { deliveredDate:  body.deliveredDate  }),
          ...(body.events         !== undefined && { events:         body.events         }),
          ...(body.notes          !== undefined && { notes:          body.notes          }),
        },
      })

      // Bidirectional sync: shipment delivered → order Delivered (triggers invoice etc via order PATCH logic)
      if (body.status === 'delivered' && prev.status !== 'delivered' && updated.orderId) {
        const order = await tx.order.findUnique({ where: { id: updated.orderId } })
        if (order && order.stage !== 'Delivered') {
          await tx.order.update({
            where: { id: order.id },
            data: { stage: 'Delivered' },
          })

          // Mirror the Delivered side-effects (invoice + balance) since we're not
          // going through the orders PATCH endpoint.
          const existingInv = await tx.invoice.findFirst({
            where: { orderId: order.id, workspaceId: order.workspaceId },
          })
          if (!existingInv) {
            const today = new Date()
            const due   = new Date(today)
            due.setDate(due.getDate() + 30)
            const unitPrice = order.items > 0 ? order.value / order.items : order.value
            const workspace = await tx.workspace.findUnique({ where: { id: order.workspaceId }, select: { currency: true } })
            await tx.invoice.create({
              data: {
                invoiceNumber: 'INV-' + order.id.slice(-6).toUpperCase(),
                customer:      order.customer,
                total:         order.value,
                subtotal:      order.value,
                tax:           0,
                status:        'unpaid',
                paymentTerms:  'Net 30',
                issueDate:     today.toISOString().split('T')[0],
                dueDate:       due.toISOString().split('T')[0],
                currency:      workspace?.currency ?? 'USD',
                items:         [{ description: order.sku, qty: order.items, unitPrice }],
                orderId:       order.id,
                workspaceId:   order.workspaceId,
              },
            })
            const custDelivered = await tx.customer.findFirst({
              where: { workspaceId: order.workspaceId, name: { mode: 'insensitive', equals: order.customer } },
            })
            if (custDelivered) {
              await tx.customer.update({
                where: { id: custDelivered.id },
                data:  { balanceDue: custDelivered.balanceDue + order.value },
              })
            }
          }

          await createNotification(tx, {
            workspaceId: order.workspaceId,
            type: 'order',
            severity: 'info',
            title: `Order Delivered — ${order.customer}`,
            body: `${order.sku} · invoice auto-created`,
            tab: 'invoicing',
            linkedType: 'order',
            linkedId: order.id,
            groupKey: `order-delivered-${order.id}`,
          })
        }
      }

      return updated
    })

    return NextResponse.json(shipment, { headers: CORS })
  } catch (err: any) {
    console.error('Shipments PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    await prisma.shipment.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Shipments DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
