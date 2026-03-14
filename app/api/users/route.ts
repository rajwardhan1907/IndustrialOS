import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET all users
export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      workspaceId: true,
      createdAt: true,
      // password is NOT returned for safety
    }
  })
  return NextResponse.json(users)
}

// CREATE a new user
export async function POST(req: Request) {
  const body = await req.json()
  const hashedPassword = await bcrypt.hash(body.password, 10)
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: hashedPassword,
      name: body.name,
      role: body.role ?? 'operator',
      workspaceId: body.workspaceId,
    }
  })
  return NextResponse.json({ id: user.id, email: user.email, name: user.name })
}
