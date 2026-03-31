// Phase 13 (roadmap): Smart Reorder Prediction
// Claude analyses stock levels + lead times + recent order velocity and suggests
// reorder quantities and timing. Human reviews and manually creates the PO.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { workspaceId } = await req.json();
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

    // Fetch current inventory
    const inventory = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      select: { sku: true, name: true, stockLevel: true, reorderPoint: true, reorderQty: true, unitCost: true, supplier: true },
    });

    // Fetch recent orders (last 90 days) for velocity calculation
    const since90 = new Date(Date.now() - 90 * 86400000);
    const recentOrders = await prisma.order.findMany({
      where: { workspaceId, createdAt: { gte: since90 } },
      select: { sku: true, items: true },
    });

    // Calculate velocity per SKU
    const velocityMap: Record<string, number> = {};
    recentOrders.forEach(o => {
      const key = o.sku.trim();
      velocityMap[key] = (velocityMap[key] ?? 0) + (o.items ?? 1);
    });

    const lowOrAtRisk = inventory.filter(i => i.stockLevel <= i.reorderPoint * 1.5);

    if (lowOrAtRisk.length === 0) {
      return NextResponse.json({ suggestions: [], message: "All items are adequately stocked. No reorders needed right now." });
    }

    const inventoryContext = lowOrAtRisk.map(i => ({
      sku:          i.sku,
      name:         i.name,
      stock:        i.stockLevel,
      reorderPoint: i.reorderPoint,
      reorderQty:   i.reorderQty,
      unitCost:     i.unitCost,
      supplier:     i.supplier,
      unitsLast90d: velocityMap[i.sku] ?? 0,
    }));

    const systemPrompt = `You are a procurement analyst for an industrial B2B company.
Analyse inventory data and suggest optimal reorder quantities and urgency.
Respond ONLY with valid JSON: { "suggestions": [ { "sku": string, "name": string, "suggestedQty": number, "urgency": "critical"|"high"|"medium", "reasoning": string } ] }`;

    const userPrompt = `Inventory items at or near reorder point:
${JSON.stringify(inventoryContext, null, 2)}

For each item, suggest a reorder quantity and urgency based on current stock, reorder point, and 90-day sales velocity.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const aiData = await res.json();
    if (!res.ok) return NextResponse.json({ error: aiData.error?.message ?? "AI error" }, { status: 500 });

    const text = aiData.content?.[0]?.text ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "AI returned unexpected format" }, { status: 500 });
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
