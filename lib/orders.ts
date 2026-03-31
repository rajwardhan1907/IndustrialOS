// lib/orders.ts
// Shared order store — used by BOTH the main app (OrderKanban) and the Customer Portal.
// Phase 4: Now saves to the real database via /api/orders
// localStorage is kept as a cache so the UI stays fast and works offline.

export type OrderStage    = "Placed" | "Confirmed" | "Picked" | "Shipped" | "Delivered";
export type OrderPriority = "HIGH" | "MED" | "LOW";
export type OrderSource   = "portal" | "manual" | "quote";

export interface Order {
  id:        string;
  customer:  string;
  sku:       string;
  items:     number;
  value:     number;
  stage:     OrderStage;
  priority:  OrderPriority;
  source:    OrderSource;
  notes:     string;
  createdAt: string;
  time:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const makeOrderId = () =>
  `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

export function timeAgo(isoDate: string): string {
  const diff  = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Get workspaceId from localStorage ────────────────────────────────────────
function getWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

// ── localStorage (used as fast cache) ────────────────────────────────────────
const KEY = "industrialos_orders";

export function loadOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
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

// ── API: fetch orders from DB and refresh localStorage cache ──────────────────
export async function fetchOrdersFromDb(): Promise<Order[]> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return loadOrders(); // no workspace yet, use localStorage

    const res = await fetch(`/api/orders?workspaceId=${workspaceId}`);
    if (!res.ok) return loadOrders();

    const data: Order[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return loadOrders();

    // Refresh time field and cache in localStorage
    const refreshed = data.map(o => ({ ...o, time: timeAgo(o.createdAt) }));
    saveOrders(refreshed);
    return refreshed;
  } catch {
    return loadOrders(); // fall back to localStorage on error
  }
}

// ── API: create a new order in DB ─────────────────────────────────────────────
export async function createOrderInDb(order: Order): Promise<void> {
  try {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) return; // no workspace, skip DB write

    await fetch("/api/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...order, workspaceId }),
    });
  } catch (err) {
    console.error("Failed to save order to DB:", err);
  }
}

// ── API: update an order in DB (advance stage, etc.) ─────────────────────────
export async function updateOrderInDb(id: string, fields: Partial<Order>): Promise<void> {
  try {
    await fetch("/api/orders", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  } catch (err) {
    console.error("Failed to update order in DB:", err);
  }
}

// ── API: delete an order from DB ──────────────────────────────────────────────
export async function deleteOrderFromDb(id: string): Promise<void> {
  try {
    await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("Failed to delete order from DB:", err);
  }
}

// ── addOrder: saves to localStorage AND DB ────────────────────────────────────
export function addOrder(order: Order): void {
  const current = loadOrders();
  saveOrders([order, ...current]);
  createOrderInDb(order); // fire and forget — DB write in background
}
