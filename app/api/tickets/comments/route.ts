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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get('ticketId')
    if (!ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400, headers: CORS })
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(comments, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400, headers: CORS })
    if (!body.body)     return NextResponse.json({ error: 'body is required' }, { status: 400, headers: CORS })
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId:   body.ticketId,
        authorId:   body.authorId   ?? '',
        authorName: body.authorName ?? 'Anonymous',
        body:       body.body,
      },
    })
    return NextResponse.json(comment, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}
