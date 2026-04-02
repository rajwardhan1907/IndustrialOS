import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get('ticketId')
    if (!ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(comments)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    if (!body.body)     return NextResponse.json({ error: 'body is required' }, { status: 400 })
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId:   body.ticketId,
        authorId:   body.authorId   ?? '',
        authorName: body.authorName ?? 'Anonymous',
        body:       body.body,
      },
    })
    return NextResponse.json(comment)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
