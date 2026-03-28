import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

// POST — Register a new company + first admin user in one atomic transaction
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { companyName, industry, name, email, password } = body

    // ── Validate required fields ──────────────────────────────────────────
    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // ── Check if email already exists ─────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // ── Hash password ─────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10)

    // ── Create Workspace + User in one transaction ────────────────────────
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const workspace = await tx.workspace.create({
        data: {
          name:     companyName.trim(),
          industry: industry?.trim() || 'Other',
        },
      })

      const user = await tx.user.create({
        data: {
          email:       email.trim().toLowerCase(),
          password:    hashedPassword,
          name:        name.trim(),
          role:        'admin',
          workspaceId: workspace.id,
        },
      })

      return { workspace, user }
    })

    // ── FIX Bug 8: Send welcome email via Resend ──────────────────────────
    // Fire and forget — don't block registration if email fails
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const from   = process.env.EMAIL_FROM || 'onboarding@resend.dev'

        await resend.emails.send({
          from,
          to:      [result.user.email],
          subject: `Welcome to IndustrialOS — your workspace is ready`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3d6fb5,#6b4ca0);padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">⚡ IndustrialOS</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">Enterprise B2B Platform</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <h2 style="font-size:20px;font-weight:800;color:#2d2a24;margin:0 0 12px;">
        Welcome, ${result.user.name}! 👋
      </h2>
      <p style="font-size:14px;color:#7a7060;line-height:1.6;margin:0 0 20px;">
        Your workspace <strong style="color:#2d2a24;">${result.workspace.name}</strong> has been created.
        You're signed up as the <strong style="color:#3d6fb5;">Admin</strong> — you have full access to all settings and modules.
      </p>

      <div style="background:#f5f3ef;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Your account details</div>
        <div style="font-size:13px;color:#2d2a24;margin-bottom:4px;">📧 Email: <strong>${result.user.email}</strong></div>
        <div style="font-size:13px;color:#2d2a24;margin-bottom:4px;">🏢 Workspace: <strong>${result.workspace.name}</strong></div>
        <div style="font-size:13px;color:#2d2a24;">🔑 Role: <strong>Admin</strong></div>
      </div>

      <p style="font-size:13px;color:#7a7060;line-height:1.6;margin:0 0 20px;">
        Head back to the app to finish setting up your workspace. The onboarding wizard will guide you through picking your modules.
      </p>

      <p style="font-size:12px;color:#a89e8e;margin:0;">
        You're on a 14-day free trial. No credit card needed to get started.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #e8e3da;text-align:center;">
      <div style="font-size:11px;color:#a89e8e;">IndustrialOS — Enterprise B2B Platform</div>
    </div>
  </div>
</body>
</html>
          `,
        })
      } catch (emailErr) {
        // Log but don't fail the registration
        console.error('Welcome email failed (non-fatal):', emailErr)
      }
    }

    // ── Return workspace id so the client can store it ────────────────────
    return NextResponse.json({
      success:     true,
      workspaceId: result.workspace.id,
      userId:      result.user.id,
      email:       result.user.email,
      name:        result.user.name,
      role:        result.user.role,
    })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
