// app/api/generate-quote/route.ts
// Server-side API route — keeps ANTHROPIC_API_KEY safe on the server.
// Called by components/Quotes.tsx when the user clicks "Generate Quote".

import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a professional B2B sales quote generator for an industrial e-commerce platform called IndustrialOS.

The user will describe a quote in plain English. Your job is to extract all details and return a JSON object — nothing else. No markdown, no explanation, just raw JSON.

Return exactly this structure:
{
  "customer": "string — company or person name",
  "items": [
    {
      "id": "item-0",
      "sku": "string — SKU code, or 'SKU-TBD' if not specified",
      "desc": "string — product description",
      "qty": number,
      "unitPrice": number,
      "discount": number (0-100, percentage),
      "total": number (qty * unitPrice * (1 - discount/100))
    }
  ],
  "subtotal": number,
  "discountAmt": number,
  "tax": number (8% of subtotal - discountAmt),
  "total": number,
  "validUntil": "YYYY-MM-DD string — 30 days from today unless specified",
  "paymentTerms": "Net 30" | "Net 15" | "Net 60" | "Prepaid" | "Cash on Delivery",
  "notes": "string — a professional 2-3 sentence note to the customer"
}

Rules:
- If a unit price is given, use it. If not, use a reasonable industrial B2B price based on the product type and quantity.
- Apply volume discounts automatically: 3% for 100+ units, 5% for 200+ units, 10% for 500+ units.
- If payment terms are mentioned (Net 60, prepaid, etc.), use them. Default to Net 30.
- If a delivery/validity date is mentioned, use it. Otherwise set validUntil to 30 days from today (${new Date().toISOString().split("T")[0]}).
- The notes field should be a warm, professional message thanking the customer and summarising the key terms.
- Return ONLY the JSON object. No markdown code fences, no preamble, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",  // fast + cheap for structured extraction
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: prompt.trim() }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json(
        { error: "Claude API returned an error. Check your API key and try again." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences just in case
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse failed:", clean);
      return NextResponse.json(
        { error: "Claude returned an unexpected format. Please try rephrasing your prompt." },
        { status: 422 }
      );
    }

    return NextResponse.json({ quote: parsed });
  } catch (err) {
    console.error("generate-quote error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
