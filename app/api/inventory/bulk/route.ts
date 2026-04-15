import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export interface BulkRow {
  sku:          string;
  name:         string;
  category?:    string;
  stockLevel?:  number;
  reorderPoint?:number;
  reorderQty?:  number;
  unitCost?:    number;
  warehouse?:   string;
  zone?:        string;
  binLocation?: string;
  supplier?:    string;
}

// POST /api/inventory/bulk
// Body: { workspaceId: string, rows: BulkRow[], mode: "upsert" | "replace" }
// Returns: { inserted, updated, errors, errorDetails }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, rows, mode = "upsert" } = body as {
      workspaceId: string;
      rows:        BulkRow[];
      mode?:       "upsert" | "replace";
    };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows array is required" }, { status: 400, headers: CORS });
    }

    let inserted = 0;
    let updated  = 0;
    const errorDetails: { row: number; sku: string; msg: string }[] = [];

    // If mode is "replace" delete all existing items first
    if (mode === "replace") {
      await prisma.inventoryItem.deleteMany({ where: { workspaceId } });
    }

    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.sku || !row.name) {
        errorDetails.push({ row: i + 1, sku: row.sku ?? "", msg: "Missing sku or name" });
        continue;
      }

      try {
        const data = {
          name:         row.name,
          category:     row.category     ?? "General",
          stockLevel:   Number(row.stockLevel)   || 0,
          reorderPoint: Number(row.reorderPoint) || 0,
          reorderQty:   Number(row.reorderQty)   || 0,
          unitCost:     Number(row.unitCost)      || 0,
          warehouse:    row.warehouse    ?? "",
          zone:         (row.zone as string)      ?? "A",
          binLocation:  row.binLocation  ?? "",
          supplier:     row.supplier     ?? "",
          lastSynced:   now,
          workspaceId,
        };

        if (mode === "replace") {
          // In replace mode everything was deleted, just create
          await prisma.inventoryItem.create({ data: { sku: row.sku, ...data } });
          inserted++;
        } else {
          // Upsert: update existing SKU if it exists, create if not
          const existing = await prisma.inventoryItem.findFirst({
            where: { sku: row.sku, workspaceId },
          });

          if (existing) {
            await prisma.inventoryItem.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            await prisma.inventoryItem.create({ data: { sku: row.sku, ...data } });
            inserted++;
          }
        }
      } catch (rowErr: any) {
        errorDetails.push({ row: i + 1, sku: row.sku, msg: rowErr.message ?? "DB error" });
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      errors:       errorDetails.length,
      errorDetails: errorDetails.slice(0, 50), // cap to 50
    }, { headers: CORS });
  } catch (err: any) {
    console.error("Bulk inventory POST error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}
