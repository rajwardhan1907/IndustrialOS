// lib/shipping.ts
// Phase 4: Now saves to real DB via /api/shipments
// localStorage kept as fast cache — falls back silently if DB unavailable.

export type ShipmentStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export type Carrier = "FedEx" | "UPS" | "DHL" | "USPS" | "Other";

export interface ShipmentEvent {
  timestamp: string;
  location:  string;
  message:   string;
}

export interface Shipment {
  id:             string;
  shipmentNumber: string;
  orderId:        string;
  customer:       string;
  carrier:        Carrier;
  trackingNumber: string;
  status:         ShipmentStatus;
  origin:         string;
  destination:    string;
  weight:         string;
  dimensions:     string;
  estimatedDate:  string;
  deliveredDate:  string;
  events:         ShipmentEvent[];
  notes:          string;
  createdAt:      string;
}

// ── Status config ─────────────────────────────────────────────────────────────
export const STATUS_STEPS: ShipmentStatus[] = [
  "pending", "picked_up", "in_transit", "out_for_delivery", "delivered",
];

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending:          "Pending Pickup",
  picked_up:        "Picked Up",
  in_transit:       "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  exception:        "Exception",
};

export const STATUS_EMOJI: Record<ShipmentStatus, string> = {
  pending:          "⏳",
  picked_up:        "📦",
  in_transit:       "🚛",
  out_for_delivery: "🏠",
  delivered:        "✅",
  exception:        "⚠️",
};

export const CARRIER_COLOR: Record<Carrier, string> = {
  FedEx: "#4D148C",
  UPS:   "#351C15",
  DHL:   "#FFCC00",
  USPS:  "#004B87",
  Other: "#555555",
};

export const CARRIER_BG: Record<Carrier, string> = {
  FedEx: "#f3eefb",
  UPS:   "#fef5e7",
  DHL:   "#fffde7",
  USPS:  "#eef3fb",
  Other: "#f0f0f0",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const makeShipmentId  = () => Math.random().toString(36).slice(2, 9);
export const makeShipmentNum = () =>
  `SHP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
export const makeTracking = (carrier: Carrier) => {
  const rnd = () => Math.random().toString(36).toUpperCase().slice(2, 8);
  const map: Record<Carrier, string> = {
    FedEx: `7489${rnd()}${rnd()}`,
    UPS:   `1Z${rnd()}${rnd()}`,
    DHL:   `JD${rnd()}${rnd()}`,
    USPS:  `9400${rnd()}${rnd()}`,
    Other: `TRK-${rnd()}`,
  };
  return map[carrier];
};

// ── Get workspaceId ───────────────────────────────────────────────────────────
function getWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

// ── localStorage (cache) ──────────────────────────────────────────────────────
const KEY = "industrialos_shipments";

export function loadShipments(): Shipment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveShipments(shipments: Shipment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(shipments));
}

// ── API: fetch shipments from DB ──────────────────────────────────────────────
export async function fetchShipmentsFromDb(): Promise<Shipment[]> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return loadShipments();

    const res = await fetch(`/api/shipments?workspaceId=${workspaceId}`);
    if (!res.ok) return loadShipments();

    const data: Shipment[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return loadShipments();

    saveShipments(data); // refresh cache
    return data;
  } catch {
    return loadShipments();
  }
}

// ── API: create a new shipment in DB ─────────────────────────────────────────
export async function createShipmentInDb(shipment: Shipment): Promise<void> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    await fetch("/api/shipments", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...shipment, workspaceId }),
    });
  } catch (err) {
    console.error("Failed to save shipment to DB:", err);
  }
}

// ── API: update a shipment in DB (advance status, add events) ─────────────────
export async function updateShipmentInDb(id: string, fields: Partial<Shipment>): Promise<void> {
  try {
    await fetch("/api/shipments", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  } catch (err) {
    console.error("Failed to update shipment in DB:", err);
  }
}
