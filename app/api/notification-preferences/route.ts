// NotificationPreference per user per workspace.
// GET   ?workspaceId=&userId=
// PUT   upsert { workspaceId, userId, alertOrdersAbove, sendEmail, sendSms, useDigest, digestTime }

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    const userId      = searchParams.get('userId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400, headers: CORS })
    }
    if (userId) {
      const pref = await prisma.notificationPreference.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
      return NextResponse.json(pref ?? null, { headers: CORS })
    }
    const prefs = await prisma.notificationPreference.findMany({ where: { workspaceId } })
    return NextResponse.json(prefs, { headers: CORS })
  } catch (err: any) {
    console.error('NotificationPreferences GET error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId || !body.userId) {
      return NextResponse.json({ error: 'workspaceId and userId are required' }, { status: 400, headers: CORS })
    }
    const data = {
      alertOrdersAbove: Number(body.alertOrdersAbove ?? 0),
      sendEmail:        Boolean(body.sendEmail ?? false),
      sendSms:          Boolean(body.sendSms ?? false),
      useDigest:        Boolean(body.useDigest ?? false),
      digestTime:       body.digestTime ?? '09:00',
    }
    const pref = await prisma.notificationPreference.upsert({
      where: { workspaceId_userId: { workspaceId: body.workspaceId, userId: body.userId } },
      update: data,
      create: { workspaceId: body.workspaceId, userId: body.userId, ...data },
    })
    return NextResponse.json(pref, { headers: CORS })
  } catch (err: any) {
    console.error('NotificationPreferences PUT error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) { return PUT(req) }
