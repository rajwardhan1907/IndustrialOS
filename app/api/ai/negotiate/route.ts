// Phase 13 (roadmap): Negotiation Assistant
// Given a generated quote, Claude suggests a counter-offer with reasoning.
// Human always reviews and clicks Send manually — AI never acts autonomously.
import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  try {
    const { quote, prompt: userContext } = await req.json();
    if (!quote) return NextResponse.json({ error: "quote is required" }, { status: 400, headers: CORS });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500, headers: CORS });

    const systemPrompt = `You are a B2B sales negotiation assistant for an industrial supplier.
Given a quote, suggest a counter-offer strategy that protects margin while keeping the customer.
Be specific about which line items to adjust and by how much. Keep your response concise (under 200 words).
Always end with a ready-to-use revised pricing summary the supplier can copy directly.`;

    const userPrompt = `Here is the current quote:
Customer: ${quote.customer}
Total: $${quote.total?.toLocaleString()}
Items: ${JSON.stringify(quote.items?.map((i: any) => ({ desc: i.desc, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount })))}
Payment Terms: ${quote.paymentTerms}
${userContext ? `\nAdditional context: ${userContext}` : ""}

Suggest a counter-offer. What discount or concession could we offer to close this deal while protecting our margin?`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "x-api-key":            apiKey,
        "anthropic-version":    "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5",
        max_tokens: 512,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? "AI error" }, { status: 500, headers: CORS });

    const suggestion = data.content?.[0]?.text ?? "";
    return NextResponse.json({ suggestion }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}
