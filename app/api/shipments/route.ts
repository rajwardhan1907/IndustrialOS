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


// GET shipments — workspaceId is required (prevents cross-tenant data leaks)
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

// CREATE a new shipment
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    const shipment = await prisma.shipment.create({
      data: {
        shipmentNumber: body.shipmentNumber ?? '',
        orderId:        body.orderId        ?? '',
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

// UPDATE a shipment (advance status, add tracking events, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    }
    const shipment = await prisma.shipment.update({
      where: { id: body.id },
      data: {
        ...(body.shipmentNumber !== undefined && { shipmentNumber: body.shipmentNumber }),
        ...(body.orderId        !== undefined && { orderId:        body.orderId        }),
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
    return NextResponse.json(shipment, { headers: CORS })
  } catch (err: any) {
    console.error('Shipments PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

// DELETE a shipment
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
