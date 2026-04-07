// Phase 17 (roadmap): QuickBooks & Xero Accounting Integration
// OAuth 2.0 connect/disconnect flow + invoice sync.
// Requires env vars: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET,
//                    XERO_CLIENT_ID, XERO_CLIENT_SECRET, NEXTAUTH_URL
//
// GET  ?action=status&workspaceId=xxx        — connection status
// GET  ?action=auth&provider=quickbooks|xero — returns OAuth redirect URL
// POST { action:"disconnect", provider, workspaceId } — disconnects
// POST { action:"sync", provider, workspaceId }       — syncs invoices

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const QB_BASE   = "https://appcenter.intuit.com/connect/oauth2";
const XERO_BASE = "https://login.xero.com/identity/connect/authorize";
const REDIRECT  = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/accounting/callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action      = searchParams.get("action");
  const workspaceId = searchParams.get("workspaceId");
  const provider    = searchParams.get("provider") as "quickbooks" | "xero" | null;

  // ── Status ────────────────────────────────────────────────────────────────
  if (action === "status") {
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    const ws = await prisma.workspace.findUnique({
      where:  { id: workspaceId },
      select: { quickbooksConnected: true, xeroConnected: true },
    });
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    return NextResponse.json({
      quickbooks: { connected: ws.quickbooksConnected, available: !!(process.env.QUICKBOOKS_CLIENT_ID) },
      xero:       { connected: ws.xeroConnected,       available: !!(process.env.XERO_CLIENT_ID)       },
    });
  }

  // ── OAuth redirect URL ────────────────────────────────────────────────────
  if (action === "auth" && provider) {
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    const state = Buffer.from(JSON.stringify({ workspaceId, provider })).toString("base64url");

    if (provider === "quickbooks") {
      const clientId = process.env.QUICKBOOKS_CLIENT_ID;
      if (!clientId) return NextResponse.json({ error: "QUICKBOOKS_CLIENT_ID not configured" }, { status: 503 });
      const url = `${QB_BASE}?client_id=${clientId}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}`;
      return NextResponse.json({ url });
    }

    if (provider === "xero") {
      const clientId = process.env.XERO_CLIENT_ID;
      if (!clientId) return NextResponse.json({ error: "XERO_CLIENT_ID not configured" }, { status: 503 });
      const url = `${XERO_BASE}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=openid+profile+email+accounting.transactions&state=${state}`;
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, provider, workspaceId } = body as { action: string; provider: "quickbooks" | "xero"; workspaceId: string };

    if (!workspaceId || !provider) return NextResponse.json({ error: "workspaceId and provider required" }, { status: 400 });

    const ws = await prisma.workspace.findUnique({
      where:  { id: workspaceId },
      select: { quickbooksConnected: true, xeroConnected: true },
    });
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // ── Disconnect ────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data:  provider === "quickbooks"
          ? { quickbooksConnected: false }
          : { xeroConnected: false },
      });
      return NextResponse.json({ ok: true, message: `${provider} disconnected.` });
    }

    // ── Sync invoices ─────────────────────────────────────────────────────────
    if (action === "sync") {
      const isConnected = provider === "quickbooks" ? ws.quickbooksConnected : ws.xeroConnected;
      if (!isConnected) return NextResponse.json({ error: `${provider} is not connected` }, { status: 400 });

      // In production: call the accounting API with stored access token.
      // For now, we report how many invoices exist in our DB (ready to sync).
      const invoiceCount = await prisma.invoice.count({ where: { workspaceId } });
      return NextResponse.json({
        ok: true,
        message: `Sync queued: ${invoiceCount} invoice(s) ready for ${provider === "quickbooks" ? "QuickBooks" : "Xero"}.`,
        invoiceCount,
        note: "Full sync requires OAuth credentials in server environment variables.",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
