// lib/orders.ts
// Shared order store — used by BOTH the main app (OrderKanban) and the Customer Portal.
// Both read and write to the same localStorage key so requests from the portal
// automatically appear in the Orders tab.
// When we add the database in Phase 4, we just swap the localStorage calls for API calls.

export type OrderStage    = "Placed" | "Confirmed" | "Picked" | "Shipped" | "Delivered";
export type OrderPriority = "HIGH" | "MED" | "LOW";
export type OrderSource   = "portal" | "manual" | "quote";

export interface Order {
  id:         string;
  customer:   string;
  sku:        string;        // product / SKU description
  items:      number;        // quantity
  value:      number;        // total value in dollars
  stage:      OrderStage;
  priority:   OrderPriority;
  source:     OrderSource;   // where the order came from
  notes:      string;
  createdAt:  string;        // ISO date string
  time:       string;        // human-readable e.g. "2h ago" — updated on load
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const makeOrderId = () =>
  `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Seed demo data (used only if store is empty) ──────────────────────────────
function seedOrders(): Order[] {
  const ago = (h: number) =>
    new Date(Date.now() - h * 3600000).toISOString();
  return [
    { id:"ORD-10234", customer:"Acme Corp",     sku:"SKU-4821", items:6, value:24300, stage:"Shipped",   priority:"HIGH", source:"portal", notes:"",                   createdAt:ago(2),  time:"2h ago"  },
    { id:"ORD-10233", customer:"TechWave Ltd",  sku:"SKU-7753", items:2, value:8750,  stage:"Confirmed", priority:"MED",  source:"portal", notes:"",                   createdAt:ago(4),  time:"4h ago"  },
    { id:"ORD-10232", customer:"NovaBuild Inc", sku:"SKU-3318", items:4, value:15200, stage:"Picked",    priority:"LOW",  source:"manual", notes:"",                   createdAt:ago(6),  time:"6h ago"  },
    { id:"ORD-10231", customer:"TechWave Ltd",  sku:"SKU-9034", items:3, value:12600, stage:"Placed",    priority:"MED",  source:"quote",  notes:"Generated from quote",createdAt:ago(8),  time:"8h ago"  },
    { id:"ORD-10230", customer:"Acme Corp",     sku:"SKU-2210", items:8, value:44800, stage:"Delivered", priority:"LOW",  source:"portal", notes:"",                   createdAt:ago(26), time:"1d ago"  },
    { id:"ORD-10229", customer:"GlobexSupply",  sku:"SKU-5512", items:1, value:3200,  stage:"Placed",    priority:"HIGH", source:"manual", notes:"Rush order",         createdAt:ago(30), time:"1d ago"  },
  ];
}

// ── localStorage ──────────────────────────────────────────────────────────────
const KEY = "industrialos_orders";

export function loadOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const demo = seedOrders();
      localStorage.setItem(KEY, JSON.stringify(demo));
      return demo;
    }
    // Refresh "time" field on every load
    const orders: Order[] = JSON.parse(raw);
    return orders.map(o => ({ ...o, time: timeAgo(o.createdAt) }));
  } catch {
    return [];
  }
}

export function saveOrders(orders: Order[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(orders));
}

export function addOrder(order: Order): void {
  const current = loadOrders();
  saveOrders([order, ...current]);
}
