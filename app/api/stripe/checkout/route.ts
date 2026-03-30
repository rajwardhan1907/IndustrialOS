// app/api/stripe/checkout/route.ts
// Phase 14 — Creates a Stripe Checkout Session for a given invoice.
// Called from the Customer Portal "Pay Now" button.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    // Fetch the invoice from DB
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }

    // Calculate amount remaining (in cents for Stripe)
    const amountDue = Math.round((invoice.total - (invoice.amountPaid || 0)) * 100);

    if (amountDue <= 0) {
      return NextResponse.json({ error: "No amount due" }, { status: 400 });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: `Payment for invoice ${invoice.invoiceNumber} — ${invoice.customer}`,
            },
            unit_amount: amountDue,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        workspaceId: invoice.workspaceId,
      },
      success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal?payment=success&invoice=${invoice.invoiceNumber}`,
      cancel_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal?payment=cancelled&invoice=${invoice.invoiceNumber}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err.message ?? "Could not create checkout session" },
      { status: 500 }
    );
  }
}
