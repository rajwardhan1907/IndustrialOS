// app/api/portal/me/route.ts
// PUBLIC — validates portal session token.
// GET   → returns current customer account info
// PATCH → allows customer to update name / email / phone; creates a Notification
//         so the internal workspace sees the change.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/automation'

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function getAuthedAccount(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: 'No token' as const }
  const session = await prisma.customerSession.findUnique({
    where:   { token },
    include: { account: true },
  })
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.customerSession.delete({ where: { token } }).catch(() => {})
    return { error: 'Session expired' as const }
  }
  return { account: session.account }
}

export async function GET(req: Request) {
  try {
    const res = await getAuthedAccount(req)
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 401, headers: CORS })
    }
    const { id, email, name, workspaceId } = res.account
    return NextResponse.json({ id, email, name, workspaceId }, { headers: CORS })
  } catch (err: any) {
    console.error('Portal /me GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS })
  }
}

// PATCH — customer updates their own profile. Only name/email/phone allowed.
export async function PATCH(req: Request) {
  try {
    const res = await getAuthedAccount(req)
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 401, headers: CORS })
    }
    const account = res.account
    const body = await req.json().catch(() => ({}))

    const nextName  = typeof body.name  === 'string' ? body.name.trim()  : undefined
    const nextEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const nextPhone = typeof body.phone === 'string' ? body.phone.trim() : undefined

    if (nextName === undefined && nextEmail === undefined && nextPhone === undefined) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400, headers: CORS })
    }

    // Email uniqueness check (within workspace)
    if (nextEmail && nextEmail !== account.email) {
      const clash = await prisma.customerAccount.findFirst({
        where: { workspaceId: account.workspaceId, email: nextEmail, id: { not: account.id } },
      })
      if (clash) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400, headers: CORS })
      }
    }

    const changes: string[] = []

    const updated = await prisma.$transaction(async (tx) => {
      // Update CustomerAccount (portal user)
      const newAccount = await tx.customerAccount.update({
        where: { id: account.id },
        data: {
          ...(nextName !== undefined && nextName !== account.name   && { name:  nextName  }),
          ...(nextEmail !== undefined && nextEmail !== account.email && { email: nextEmail }),
        },
      })
      if (nextName  !== undefined && nextName  !== account.name)  changes.push(`name → "${nextName}"`)
      if (nextEmail !== undefined && nextEmail !== account.email) changes.push(`email → "${nextEmail}"`)

      // Also update the linked Customer record (matched by email within workspace).
      const linked = await tx.customer.findFirst({
        where: {
          workspaceId: account.workspaceId,
          OR: [
            { email: { equals: account.email, mode: 'insensitive' } },
            { name:  { equals: account.name,  mode: 'insensitive' } },
          ],
        },
      })
      if (linked) {
        const linkedUpdate: any = {}
        if (nextName  !== undefined && nextName  !== linked.contactName) {
          linkedUpdate.contactName = nextName
        }
        if (nextEmail !== undefined && nextEmail !== linked.email) {
          linkedUpdate.email = nextEmail
        }
        if (nextPhone !== undefined && nextPhone !== linked.phone) {
          linkedUpdate.phone = nextPhone
          changes.push(`phone → "${nextPhone}"`)
        }
        if (Object.keys(linkedUpdate).length > 0) {
          await tx.customer.update({ where: { id: linked.id }, data: linkedUpdate })
        }
      } else if (nextPhone !== undefined) {
        // Phone is only stored on Customer record; if no matching Customer, note the change
        // in the notification body.
        changes.push(`phone → "${nextPhone}"`)
      }

      // Surface the update to the internal workspace as a notification.
      if (changes.length > 0) {
        const label = newAccount.name || account.name || account.email
        await createNotification(tx, {
          workspaceId: account.workspaceId,
          type:     'customer',
          severity: 'info',
          title:    `Customer Profile Updated: ${label}`,
          body:     changes.join(', '),
          tab:      'customers',
          linkedType: 'customer',
          linkedId:   linked?.id ?? account.id,
          groupKey:   `customer-profile-${account.id}`,
        })
      }

      return newAccount
    })

    return NextResponse.json(
      { id: updated.id, name: updated.name, email: updated.email, workspaceId: updated.workspaceId },
      { headers: CORS },
    )
  } catch (err: any) {
    console.error('Portal /me PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500, headers: CORS })
  }
}
