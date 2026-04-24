// lib/inventory.ts
// Phase 4: Now saves to real DB via /api/inventory
// localStorage kept as fast cache — falls back silently if DB is unavailable.

export type StockStatus  = "ok" | "low" | "critical" | "out_of_stock";
export type WarehouseZone = "A" | "B" | "C" | "D";

export interface InventoryItem {
  id:           string;
  sku:          string;
  name:         string;
  category:     string;
  stockLevel:   number;
  reorderPoint: number;
  reorderQty:   number;
  unitCost:     number;
  warehouse:    string;
  zone:         WarehouseZone;
  binLocation:  string;
  lastSynced:   string;
  supplier:     string;
  supplierId?:  string | null;
  lastPoDate?:  string;
  autoPoCount?: number;
}

export interface ConflictLog {
  id:     number;
  sku:    string;
  field:  string;
  before: string;
  after:  string;
  src:    string;
  time:   string;
  status: "alert" | "resolved";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getStockStatus(item: InventoryItem): StockStatus {
  if (item.stockLevel === 0)                       return "out_of_stock";
  if (item.stockLevel <= item.reorderPoint * 0.5) return "critical";
  if (item.stockLevel <= item.reorderPoint)        return "low";
  return "ok";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok:           "In Stock",
  low:          "Low Stock",
  critical:     "Critical",
  out_of_stock: "Out of Stock",
};

export const STATUS_COLOR: Record<StockStatus, { color: string; bg: string; border: string }> = {
  ok:           { color: "#2e7d5e", bg: "#edf6f1", border: "#b8dece" },
  low:          { color: "#b86a00", bg: "#fef5e7", border: "#f5d9a0" },
  critical:     { color: "#c0392b", bg: "#fdf0ee", border: "#f0b8b2" },
  out_of_stock: { color: "#c0392b", bg: "#fdf0ee", border: "#f0b8b2" },
};

// ── Get workspaceId ───────────────────────────────────────────────────────────
function getWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

// ── localStorage (cache) ──────────────────────────────────────────────────────
const INV_KEY = "industrialos_inventory";
const CON_KEY = "industrialos_inv_conflicts";

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveInventory(items: InventoryItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INV_KEY, JSON.stringify(items));
}

export function loadConflicts(): ConflictLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CON_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveConflicts(conflicts: ConflictLog[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CON_KEY, JSON.stringify(conflicts));
}

// ── API: fetch inventory from DB ──────────────────────────────────────────────
export async function fetchInventoryFromDb(): Promise<InventoryItem[]> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return loadInventory();

    const res = await fetch(`/api/inventory?workspaceId=${workspaceId}`);
    if (!res.ok) return loadInventory();

    const data: InventoryItem[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return loadInventory();

    saveInventory(data); // refresh cache
    return data;
  } catch {
    return loadInventory();
  }
}

// ── API: create a new inventory item in DB ────────────────────────────────────
export async function createInventoryItemInDb(item: InventoryItem): Promise<void> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    await fetch("/api/inventory", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, workspaceId }),
    });
  } catch (err) {
    console.error("Failed to save inventory item to DB:", err);
  }
}

// ── API: update an inventory item in DB ───────────────────────────────────────
export async function updateInventoryItemInDb(id: string, fields: Partial<InventoryItem>): Promise<void> {
  try {
    await fetch("/api/inventory", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  } catch (err) {
    console.error("Failed to update inventory item in DB:", err);
  }
}

// ── API: delete an inventory item from DB ─────────────────────────────────────
export async function deleteInventoryItemFromDb(id: string): Promise<void> {
  try {
    await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("Failed to delete inventory item from DB:", err);
  }
}
