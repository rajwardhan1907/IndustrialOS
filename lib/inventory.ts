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

// ── Seed demo data ────────────────────────────────────────────────────────────
function seedInventory(): InventoryItem[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  return [
    { id:"inv1",  sku:"SKU-4821", name:"Industrial Bolts M10 (Box/100)",   category:"Fasteners",   stockLevel:1240, reorderPoint:200, reorderQty:500, unitCost:4.50,   warehouse:"Warehouse A", zone:"A", binLocation:"A-02-1", lastSynced:ago(1),  supplier:"SteelCo Industries"  },
    { id:"inv2",  sku:"SKU-7753", name:"Bearing Assembly B-204",           category:"Bearings",    stockLevel:85,   reorderPoint:100, reorderQty:200, unitCost:45.00,  warehouse:"Warehouse A", zone:"B", binLocation:"B-07-3", lastSynced:ago(2),  supplier:"PrecisionParts GmbH" },
    { id:"inv3",  sku:"SKU-3318", name:"Steel Framing Unit 200x100",       category:"Structural",  stockLevel:42,   reorderPoint:50,  reorderQty:100, unitCost:38.00,  warehouse:"Warehouse B", zone:"A", binLocation:"A-15-2", lastSynced:ago(3),  supplier:"SteelCo Industries"  },
    { id:"inv4",  sku:"SKU-9034", name:"Motor Controller Unit MC-400",     category:"Electronics", stockLevel:0,    reorderPoint:20,  reorderQty:50,  unitCost:420.00, warehouse:"Warehouse A", zone:"C", binLocation:"C-03-1", lastSynced:ago(4),  supplier:"TechEquip Asia"      },
    { id:"inv5",  sku:"SKU-2210", name:"Conveyor Belt Assembly CB-60",     category:"Mechanical",  stockLevel:18,   reorderPoint:25,  reorderQty:30,  unitCost:560.00, warehouse:"Warehouse B", zone:"B", binLocation:"B-12-4", lastSynced:ago(1),  supplier:"PrecisionParts GmbH" },
    { id:"inv6",  sku:"SKU-5512", name:"Hydraulic Cylinder 80mm Bore",     category:"Hydraulics",  stockLevel:310,  reorderPoint:50,  reorderQty:100, unitCost:95.00,  warehouse:"Warehouse A", zone:"D", binLocation:"D-04-2", lastSynced:ago(2),  supplier:"SteelCo Industries"  },
    { id:"inv7",  sku:"SKU-1190", name:"Safety Gloves Class 4 (Pair)",     category:"Safety",      stockLevel:12,   reorderPoint:100, reorderQty:200, unitCost:8.50,   warehouse:"Warehouse C", zone:"A", binLocation:"A-01-1", lastSynced:ago(5),  supplier:"PackRight Solutions" },
    { id:"inv8",  sku:"SKU-8834", name:"Pneumatic Valve 3/2 Way",          category:"Pneumatics",  stockLevel:220,  reorderPoint:40,  reorderQty:80,  unitCost:32.00,  warehouse:"Warehouse A", zone:"B", binLocation:"B-09-1", lastSynced:ago(3),  supplier:"PrecisionParts GmbH" },
    { id:"inv9",  sku:"SKU-6621", name:"Anchor Bolts M16 (Box/50)",        category:"Fasteners",   stockLevel:5,    reorderPoint:80,  reorderQty:200, unitCost:12.00,  warehouse:"Warehouse B", zone:"A", binLocation:"A-03-2", lastSynced:ago(6),  supplier:"SteelCo Industries"  },
    { id:"inv10", sku:"SKU-3047", name:"Chain Drive Sprocket 40T",         category:"Mechanical",  stockLevel:67,   reorderPoint:30,  reorderQty:60,  unitCost:28.00,  warehouse:"Warehouse A", zone:"C", binLocation:"C-11-3", lastSynced:ago(2),  supplier:"PrecisionParts GmbH" },
  ];
}

function seedConflicts(): ConflictLog[] {
  return [
    { id:1, sku:"SKU-4821", field:"price",  before:"$4.20",  after:"$4.50",  src:"CRM sync",   time:"2m ago",  status:"alert"    },
    { id:2, sku:"SKU-7753", field:"stock",  before:"90",     after:"85",     src:"WH scan",    time:"5m ago",  status:"alert"    },
    { id:3, sku:"SKU-3318", field:"price",  before:"$36.00", after:"$38.00", src:"Supplier",   time:"12m ago", status:"resolved" },
    { id:4, sku:"SKU-2210", field:"stock",  before:"22",     after:"18",     src:"Order fill", time:"1h ago",  status:"resolved" },
  ];
}

// ── localStorage (cache) ──────────────────────────────────────────────────────
const INV_KEY = "industrialos_inventory";
const CON_KEY = "industrialos_inv_conflicts";

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INV_KEY);
    if (!raw) {
      const demo = seedInventory();
      localStorage.setItem(INV_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
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
    if (!raw) {
      const demo = seedConflicts();
      localStorage.setItem(CON_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
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
