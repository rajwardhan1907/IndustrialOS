// app/api/whatsapp/route.ts
// Phase 11 — Sends a WhatsApp message via Twilio when an order advances stages.
// Called from OrderKanban after a stage change.

import { NextResponse } from "next/server";
import { getTwilio, getTwilioWhatsAppFrom, buildWhatsAppMessage } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, customerId, customerName, stage, sku, workspaceId } = body;

    if (!orderId || !customerName || !stage || !workspaceId) {
      return NextResponse.json({ error: "orderId, customerName, stage, workspaceId are required" }, { status: 400 });
    }

    // Get workspace settings to check: is WhatsApp enabled for this stage?
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, whatsappEnabled: true, whatsappStages: true },
    });

    if (!workspace?.whatsappEnabled) {
      return NextResponse.json({ skipped: true, reason: "WhatsApp disabled for this workspace" });
    }

    // Parse which stages are enabled (stored as comma-separated string)
    const enabledStages: string[] = workspace.whatsappStages
      ? workspace.whatsappStages.split(",").map((s: string) => s.trim())
      : ["Confirmed", "Shipped", "Delivered"];

    if (!enabledStages.includes(stage)) {
      return NextResponse.json({ skipped: true, reason: `Stage "${stage}" is not enabled for WhatsApp` });
    }

    // Look up the customer's phone number — first try by ID, then by name
    let phone: string | null = null;
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { phone: true, whatsappPaused: true },
      });
      if (customer?.whatsappPaused) {
        return NextResponse.json({ skipped: true, reason: "WhatsApp paused for this customer" });
      }
      phone = customer?.phone ?? null;
    }

    if (!phone) {
      // Try to find by name
      const customer = await prisma.customer.findFirst({
        where: { name: { equals: customerName, mode: "insensitive" }, workspaceId },
        select: { phone: true, whatsappPaused: true },
      });
      if (customer?.whatsappPaused) {
        return NextResponse.json({ skipped: true, reason: "WhatsApp paused for this customer" });
      }
      phone = customer?.phone ?? null;
    }

    if (!phone) {
      return NextResponse.json({ skipped: true, reason: "No phone number found for customer" });
    }

    // Format phone for WhatsApp (must start with whatsapp:+countrycode)
    const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone.replace(/\s/g, "")}`;

    const message = buildWhatsAppMessage(customerName, orderId, sku || "", stage, workspace.name);

    await getTwilio().messages.create({
      from: getTwilioWhatsAppFrom(),
      to,
      body: message,
    });

    return NextResponse.json({ sent: true, to, stage });
  } catch (err: any) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to send WhatsApp message" }, { status: 500 });
  }
}
