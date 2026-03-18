import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET users by workspaceId
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }
    const users = await prisma.user.findMany({
      where: { workspaceId },
      select: { id: true, email: true, name: true, role: true, workspaceId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(users)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// CREATE (invite) a new user into a workspace
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    if (!body.email)       return NextResponse.json({ error: 'email is required' }, { status: 400 })
    if (!body.name)        return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } })
    if (existing) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })

    // Default password = "changeme123" — user should reset on first login
    const hashedPassword = await bcrypt.hash(body.password || 'changeme123', 10)
    const user = await prisma.user.create({
      data: {
        email:       body.email.trim().toLowerCase(),
        password:    hashedPassword,
        name:        body.name.trim(),
        role:        body.role ?? 'operator',
        workspaceId: body.workspaceId,
      },
    })
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// UPDATE a user's role
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id)   return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.role) return NextResponse.json({ error: 'role is required' }, { status: 400 })

    const user = await prisma.user.update({
      where: { id: body.id },
      data:  { role: body.role },
      select: { id: true, email: true, name: true, role: true },
    })
    return NextResponse.json(user)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}

// DELETE a user from the workspace
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
