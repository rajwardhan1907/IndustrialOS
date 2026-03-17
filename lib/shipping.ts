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

// ── Seed demo data ────────────────────────────────────────────────────────────
function seedShipments(): Shipment[] {
  const ago    = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString().split("T")[0];
  const past   = (d: number) => new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

  return [
    {
      id:"shp1", shipmentNumber:"SHP-2026-1042", orderId:"ORD-10234", customer:"Acme Corp",
      carrier:"FedEx", trackingNumber:"748931284756", status:"in_transit",
      origin:"Chicago, IL", destination:"New York, NY",
      weight:"18.5 kg", dimensions:"60x40x30 cm",
      estimatedDate:future(2), deliveredDate:"",
      events:[
        { timestamp:ago(24), location:"Chicago, IL",       message:"Package picked up by FedEx"    },
        { timestamp:ago(18), location:"Indianapolis, IN",  message:"Departed FedEx facility"       },
        { timestamp:ago(6),  location:"Pittsburgh, PA",    message:"In transit to destination"     },
      ],
      notes:"", createdAt:ago(26),
    },
    {
      id:"shp2", shipmentNumber:"SHP-2026-0891", orderId:"ORD-10233", customer:"TechWave Ltd",
      carrier:"UPS", trackingNumber:"1ZRWA0680326327", status:"out_for_delivery",
      origin:"Los Angeles, CA", destination:"San Francisco, CA",
      weight:"5.2 kg", dimensions:"30x20x15 cm",
      estimatedDate:future(0), deliveredDate:"",
      events:[
        { timestamp:ago(48), location:"Los Angeles, CA",   message:"Shipment picked up"            },
        { timestamp:ago(36), location:"Fresno, CA",        message:"In transit"                    },
        { timestamp:ago(4),  location:"San Francisco, CA", message:"Out for delivery"              },
      ],
      notes:"Signature required.", createdAt:ago(50),
    },
    {
      id:"shp3", shipmentNumber:"SHP-2026-0744", orderId:"ORD-10230", customer:"Acme Corp",
      carrier:"DHL", trackingNumber:"JDK29384756123", status:"delivered",
      origin:"Dallas, TX", destination:"Miami, FL",
      weight:"32.0 kg", dimensions:"80x60x50 cm",
      estimatedDate:past(2), deliveredDate:past(2),
      events:[
        { timestamp:ago(120), location:"Dallas, TX",      message:"Shipment picked up by DHL"            },
        { timestamp:ago(96),  location:"Houston, TX",     message:"Departed DHL facility"                },
        { timestamp:ago(72),  location:"New Orleans, LA", message:"In transit"                           },
        { timestamp:ago(48),  location:"Miami, FL",       message:"Arrived at delivery facility"         },
        { timestamp:ago(24),  location:"Miami, FL",       message:"Delivered — signed by J. HARTLEY"     },
      ],
      notes:"", createdAt:ago(122),
    },
    {
      id:"shp4", shipmentNumber:"SHP-2026-1103", orderId:"ORD-10231", customer:"TechWave Ltd",
      carrier:"USPS", trackingNumber:"9400111899223456789", status:"pending",
      origin:"Seattle, WA", destination:"Boston, MA",
      weight:"8.1 kg", dimensions:"45x35x25 cm",
      estimatedDate:future(5), deliveredDate:"",
      events:[
        { timestamp:ago(2), location:"Seattle, WA", message:"Label created — awaiting pickup" },
      ],
      notes:"Fragile — handle with care.", createdAt:ago(2),
    },
    {
      id:"shp5", shipmentNumber:"SHP-2026-0985", orderId:"ORD-10229", customer:"GlobexSupply",
      carrier:"FedEx", trackingNumber:"748900129384756", status:"exception",
      origin:"Phoenix, AZ", destination:"Denver, CO",
      weight:"15.0 kg", dimensions:"55x45x35 cm",
      estimatedDate:past(1), deliveredDate:"",
      events:[
        { timestamp:ago(72), location:"Phoenix, AZ",      message:"Package picked up"                     },
        { timestamp:ago(48), location:"Albuquerque, NM",  message:"In transit"                            },
        { timestamp:ago(24), location:"Denver, CO",       message:"Delivery attempted — recipient absent" },
        { timestamp:ago(6),  location:"Denver, CO",       message:"Package held at FedEx facility"        },
      ],
      notes:"", createdAt:ago(74),
    },
  ];
}

// ── localStorage (cache) ──────────────────────────────────────────────────────
const KEY = "industrialos_shipments";

export function loadShipments(): Shipment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const demo = seedShipments();
      localStorage.setItem(KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
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
