import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all workspaces
export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(workspaces)
}

// CREATE a new workspace
export async function POST(req: Request) {
  const body = await req.json()
  const workspace = await prisma.workspace.create({
    data: {
      name:     body.name,
      industry: body.industry,
    },
  })
  return NextResponse.json(workspace)
}

// Phase 16 + 15: UPDATE workspace settings
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const workspace = await prisma.workspace.update({
      where: { id: body.id },
      data: {
        ...(body.name                !== undefined && { name:                body.name                }),
        ...(body.poApprovalThreshold !== undefined && { poApprovalThreshold: body.poApprovalThreshold }),
        ...(body.currency            !== undefined && { currency:            body.currency            }),  // Phase 15
        ...(body.whatsappEnabled     !== undefined && { whatsappEnabled:     body.whatsappEnabled     }),  // Phase 11
        ...(body.whatsappStages      !== undefined && { whatsappStages:      body.whatsappStages      }),  // Phase 11
        ...(body.returnAddress       !== undefined && { returnAddress:       body.returnAddress       }),  // Portal returns
        ...(body.returnInstructions  !== undefined && { returnInstructions:  body.returnInstructions  }),  // Portal returns
      },
    })
    return NextResponse.json(workspace)
  } catch (err: any) {
    console.error('Workspaces PATCH error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
