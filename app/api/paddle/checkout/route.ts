// app/api/paddle/checkout/route.ts
// Creates a Paddle transaction for a given invoice.
// Called from the Customer Portal "Pay Now" button when paymentProvider === "paddle".

import { NextResponse } from "next/server";
import { getPaddleConfig } from "@/lib/paddle";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }

    // Amount in minor units as a string (Paddle requirement)
    const amountDue = Math.round((invoice.total - (invoice.amountPaid || 0)) * 100);

    if (amountDue <= 0) {
      return NextResponse.json({ error: "No amount due" }, { status: 400 });
    }

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const { baseUrl, apiKey } = getPaddleConfig();

    // Create a Paddle transaction via REST API
    const paddleRes = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            price: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: `Payment for invoice ${invoice.invoiceNumber} — ${invoice.customer}`,
              unit_price: {
                amount:        String(amountDue),
                currency_code: invoice.currency || "USD",
              },
              product: {
                name:         "IndustrialOS Invoice Payment",
                description:  `Invoice ${invoice.invoiceNumber}`,
                tax_category: "standard",
              },
            },
            quantity: 1,
          },
        ],
        checkout: {
          url: `${base}/portal?payment=success&invoice=${invoice.invoiceNumber}`,
        },
        custom_data: {
          invoiceId:     invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          workspaceId:   invoice.workspaceId,
        },
      }),
    });

    if (!paddleRes.ok) {
      const errBody = await paddleRes.json().catch(() => ({}));
      const msg = (errBody as any)?.error?.detail ?? "Could not create Paddle transaction";
      console.error("Paddle API error:", errBody);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const paddleData = await paddleRes.json();
    const checkoutUrl = paddleData?.data?.checkout?.url;

    if (!checkoutUrl) {
      return NextResponse.json({ error: "Paddle did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err: any) {
    console.error("Paddle checkout error:", err);
    return NextResponse.json(
      { error: err.message ?? "Could not create checkout session" },
      { status: 500 }
    );
  }
}
