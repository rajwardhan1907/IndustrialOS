import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all workspaces
export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(workspaces)
}

// CREATE a new workspace
export async function POST(req: Request) {
  const body = await req.json()
  const workspace = await prisma.workspace.create({
    data: {
      name: body.name,
      industry: body.industry,
    }
  })
  return NextResponse.json(workspace)
}
