import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}


async function makeTicketNumber(workspaceId: string): Promise<string> {
  const count = await prisma.ticket.count({ where: { workspaceId } })
  return `TKT-${String(count + 1).padStart(3, '0')}`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    const id = searchParams.get('id')
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    if (id) {
      const ticket = await prisma.ticket.findFirst({
        where: { id, workspaceId },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      })
      if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS })
      return NextResponse.json(ticket, { headers: CORS })
    }
    const tickets = await prisma.ticket.findMany({
      where: { workspaceId },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tickets, { headers: CORS })
  } catch (err: any) {
    console.error('Tickets GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400, headers: CORS })
    const ticketNumber = await makeTicketNumber(body.workspaceId)
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title:        body.title        ?? '',
        description:  body.description  ?? '',
        type:         body.type         ?? 'issue',
        priority:     body.priority     ?? 'medium',
        status:       body.status       ?? 'open',
        assignedTo:   body.assignedTo   ?? '',
        assignedName: body.assignedName ?? '',
        raisedBy:     body.raisedBy     ?? '',
        raisedName:   body.raisedName   ?? '',
        linkedType:   body.linkedType   ?? '',
        linkedId:     body.linkedId     ?? '',
        linkedLabel:  body.linkedLabel  ?? '',
        workspaceId:  body.workspaceId,
      },
      include: { comments: true },
    })

    // Fix 11: write a persistent notification when a new ticket is created
    await prisma.notification.create({
      data: {
        workspaceId: body.workspaceId,
        type:        'ticket',
        severity:    body.priority === 'high' || body.priority === 'critical' ? 'warn' : 'info',
        title:       `New Ticket — ${ticket.title}`,
        body:        `${ticketNumber} · ${body.type ?? 'issue'} · Priority: ${body.priority ?? 'medium'}`,
        tab:         'tickets',
      },
    })

    return NextResponse.json(ticket, { headers: CORS })
  } catch (err: any) {
    console.error('Tickets POST error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    const ticket = await prisma.ticket.update({
      where: { id: body.id },
      data: {
        ...(body.status       !== undefined && { status:       body.status       }),
        ...(body.priority     !== undefined && { priority:     body.priority     }),
        ...(body.assignedTo   !== undefined && { assignedTo:   body.assignedTo   }),
        ...(body.assignedName !== undefined && { assignedName: body.assignedName }),
        ...(body.title        !== undefined && { title:        body.title        }),
        ...(body.description  !== undefined && { description:  body.description  }),
      },
      include: { comments: true },
    })
    return NextResponse.json(ticket, { headers: CORS })
  } catch (err: any) {
    console.error('Tickets PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS })
    await prisma.ticket.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err: any) {
    console.error('Tickets DELETE error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
