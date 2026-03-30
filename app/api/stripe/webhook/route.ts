// app/api/stripe/webhook/route.ts
// Phase 14 — Stripe Webhook handler.
// Listens for checkout.session.completed and auto-updates invoice status.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Disable body parsing — Stripe needs the raw body to verify the signature
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId) {
        // Fetch the current invoice
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

        if (invoice) {
          // Amount paid in this session (convert from cents to dollars)
          const paidNow = (session.amount_total || 0) / 100;
          const newAmountPaid = (invoice.amountPaid || 0) + paidNow;

          // Determine new status
          let newStatus = "partial";
          if (newAmountPaid >= invoice.total) {
            newStatus = "paid";
          }

          // Update the invoice
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              amountPaid: newAmountPaid,
              status: newStatus,
              notes: `${invoice.notes || ""}\n[Stripe] Payment of $${paidNow.toFixed(2)} received on ${new Date().toISOString().split("T")[0]}. Ref: ${session.payment_intent}`.trim(),
            },
          });

          console.log(`✅ Invoice ${invoice.invoiceNumber} updated — status: ${newStatus}, paid: $${newAmountPaid}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: err.message ?? "Webhook error" }, { status: 500 });
  }
}
