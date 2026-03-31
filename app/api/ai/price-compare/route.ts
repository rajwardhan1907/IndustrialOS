// Phase 13 (roadmap): Supplier Price Comparison
// When creating a PO, shows what the same SKU has cost across all supplier POs.
// Pure DB query — no AI needed. Human picks the supplier and confirms.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const sku         = searchParams.get("sku");
    if (!workspaceId || !sku) {
      return NextResponse.json({ error: "workspaceId and sku are required" }, { status: 400 });
    }

    // Fetch all POs for this workspace that contain the given SKU
    const allPOs = await prisma.purchaseOrder.findMany({
      where: { workspaceId },
      select: { supplierName: true, items: true, createdAt: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    interface POItem { sku?: string; desc?: string; qty?: number; unitPrice?: number; }
    interface PriceEntry { supplier: string; unitPrice: number; qty: number; date: string; status: string; }

    const skuLower = sku.toLowerCase();
    const results: PriceEntry[] = [];

    allPOs.forEach(po => {
      const items: POItem[] = Array.isArray(po.items) ? po.items as POItem[] : [];
      items.forEach(item => {
        if (item.sku && item.sku.toLowerCase().includes(skuLower) && item.unitPrice) {
          results.push({
            supplier:  po.supplierName,
            unitPrice: item.unitPrice,
            qty:       item.qty ?? 1,
            date:      new Date(po.createdAt).toISOString().split("T")[0],
            status:    po.status,
          });
        }
      });
    });

    // Group by supplier — show cheapest and most recent price per supplier
    const bySupplier: Record<string, PriceEntry[]> = {};
    results.forEach(r => {
      if (!bySupplier[r.supplier]) bySupplier[r.supplier] = [];
      bySupplier[r.supplier].push(r);
    });

    const summary = Object.entries(bySupplier).map(([supplier, entries]) => {
      const sorted     = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest     = sorted[0];
      const avgPrice   = entries.reduce((s, e) => s + e.unitPrice, 0) / entries.length;
      const lowestPrice = Math.min(...entries.map(e => e.unitPrice));
      return { supplier, latestPrice: latest.unitPrice, avgPrice: parseFloat(avgPrice.toFixed(2)), lowestPrice, lastOrderDate: latest.date, orderCount: entries.length };
    }).sort((a, b) => a.latestPrice - b.latestPrice);

    return NextResponse.json({ sku, comparisons: summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
