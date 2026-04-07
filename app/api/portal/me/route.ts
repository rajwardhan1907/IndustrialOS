// app/api/portal/me/route.ts
// PUBLIC — validates portal session token, returns current customer info
// GET (Authorization: Bearer <token>) → { id, email, name, workspaceId }

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
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401, headers: CORS })
    }

    const session = await prisma.customerSession.findUnique({
      where:   { token },
      include: { account: { select: { id: true, email: true, name: true, workspaceId: true } } },
    })

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) await prisma.customerSession.delete({ where: { token } }).catch(() => {})
      return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: CORS })
    }

    return NextResponse.json(session.account, { headers: CORS })
  } catch (err: any) {
    console.error('Portal /me error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}
