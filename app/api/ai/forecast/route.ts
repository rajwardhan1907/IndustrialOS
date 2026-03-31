// Phase 22 (roadmap): Demand Forecasting
// Analyses historical order velocity over 30/60/90-day windows and projects
// demand for the next 30 days per SKU. Human reviews before any reorder action.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { workspaceId } = await req.json();
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

    // Fetch inventory for context
    const inventory = await prisma.inventoryItem.findMany({
      where: { workspaceId },
      select: { sku: true, name: true, stockLevel: true, reorderPoint: true, reorderQty: true, unitCost: true },
    });

    // Order velocity across 30 / 60 / 90-day windows
    const now = Date.now();
    const since30  = new Date(now - 30  * 86400000);
    const since60  = new Date(now - 60  * 86400000);
    const since90  = new Date(now - 90  * 86400000);

    const [orders30, orders60, orders90] = await Promise.all([
      prisma.order.findMany({ where: { workspaceId, createdAt: { gte: since30 } }, select: { sku: true, items: true } }),
      prisma.order.findMany({ where: { workspaceId, createdAt: { gte: since60 } }, select: { sku: true, items: true } }),
      prisma.order.findMany({ where: { workspaceId, createdAt: { gte: since90 } }, select: { sku: true, items: true } }),
    ]);

    const sumVelocity = (orders: { sku: string; items: number | null }[]) => {
      const map: Record<string, number> = {};
      orders.forEach(o => {
        const k = o.sku.trim();
        map[k] = (map[k] ?? 0) + (o.items ?? 1);
      });
      return map;
    };

    const v30 = sumVelocity(orders30);
    const v60 = sumVelocity(orders60);
    const v90 = sumVelocity(orders90);

    // Only forecast SKUs that have had any sales in the last 90 days
    const activeSKUs = new Set([...Object.keys(v30), ...Object.keys(v60), ...Object.keys(v90)]);

    if (activeSKUs.size === 0) {
      return NextResponse.json({ forecasts: [], message: "No recent sales data found. Place some orders first." });
    }

    const inventoryMap: Record<string, typeof inventory[number]> = {};
    inventory.forEach(i => { inventoryMap[i.sku] = i; });

    const skuData = Array.from(activeSKUs).map(sku => ({
      sku,
      name:         inventoryMap[sku]?.name ?? sku,
      stockLevel:   inventoryMap[sku]?.stockLevel ?? 0,
      reorderPoint: inventoryMap[sku]?.reorderPoint ?? 0,
      units30d:     v30[sku] ?? 0,
      units60d:     v60[sku] ?? 0,
      units90d:     v90[sku] ?? 0,
    }));

    const systemPrompt = `You are a demand forecasting analyst for an industrial B2B company.
Given historical sales velocity across multiple windows, forecast demand for the next 30 days per SKU.
Respond ONLY with valid JSON:
{ "forecasts": [ { "sku": string, "name": string, "forecast30d": number, "trend": "rising"|"stable"|"declining", "stockoutRisk": "high"|"medium"|"low", "insight": string } ] }
trend: rising if 30d velocity > 60d/2; declining if < 60d/2; else stable.
stockoutRisk: high if currentStock < forecast30d; medium if currentStock < forecast30d*1.5; low otherwise.`;

    const userPrompt = `Historical sales data per SKU:
${JSON.stringify(skuData, null, 2)}

Forecast demand for the next 30 days for each SKU based on trend analysis.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 1500,
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
