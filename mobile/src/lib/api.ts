// mobile/src/lib/api.ts
// All API calls go through here. BASE_URL points to the deployed web app.
// On dev: set EXPO_PUBLIC_API_URL=http://localhost:3000 in .env.local
// On prod: set EXPO_PUBLIC_API_URL=https://industrial-os.vercel.app

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://industrial-os.vercel.app";

// ── Storage abstraction (SecureStore on native, localStorage on web) ──────────
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") { try { return localStorage?.getItem(key) ?? null; } catch { return null; } }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") { try { localStorage?.setItem(key, value); } catch {} return; }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") { try { localStorage?.removeItem(key); } catch {} return; }
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function storeSession(token: string, workspaceId: string, role: string, userId: string, email?: string, name?: string) {
  await storage.setItem("auth_token",   token);
  await storage.setItem("workspace_id", workspaceId);
  await storage.setItem("user_role",    role);
  await storage.setItem("user_id",      userId);
  if (email) await storage.setItem("user_email", email);
  if (name)  await storage.setItem("user_name",  name);
}

export async function getSession() {
  const token       = await storage.getItem("auth_token");
  const workspaceId = await storage.getItem("workspace_id");
  const role        = await storage.getItem("user_role");
  const userId      = await storage.getItem("user_id");
  const email       = await storage.getItem("user_email");
  const name        = await storage.getItem("user_name");
  return { token, workspaceId, role, userId, email, name };
}

export async function clearSession() {
  await storage.removeItem("auth_token");
  await storage.removeItem("workspace_id");
  await storage.removeItem("user_role");
  await storage.removeItem("user_id");
  await storage.removeItem("user_email");
  await storage.removeItem("user_name");
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const { token } = await getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function fetchDashboard(workspaceId: string) {
  return apiFetch(`/api/dashboard?workspaceId=${workspaceId}`);
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export async function fetchInventory(workspaceId: string) {
  return apiFetch(`/api/inventory?workspaceId=${workspaceId}`);
}

export async function updateInventoryItem(id: string, fields: Record<string, any>) {
  return apiFetch("/api/inventory", {
    method: "PATCH",
    body: JSON.stringify({ id, ...fields }),
  });
}

// ── Orders ────────────────────────────────────────────────────────────────────
export async function fetchOrders(workspaceId: string) {
  return apiFetch(`/api/orders?workspaceId=${workspaceId}`);
}

export async function updateOrderStage(id: string, stage: string) {
  return apiFetch("/api/orders", {
    method: "PATCH",
    body: JSON.stringify({ id, stage }),
  });
}

// ── Shipments ─────────────────────────────────────────────────────────────────
export async function fetchShipments(workspaceId: string) {
  return apiFetch(`/api/shipments?workspaceId=${workspaceId}`);
}

export async function updateShipmentStatus(id: string, status: string) {
  return apiFetch("/api/shipments", {
    method: "PATCH",
    body: JSON.stringify({ id, status }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function fetchNotifications(workspaceId: string) {
  return apiFetch(`/api/notifications?workspaceId=${workspaceId}`);
}

export async function markNotificationRead(id: string) {
  return apiFetch("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ id, read: true }),
  });
}

// ── Auth: login via mobile-token endpoint ─────────────────────────────────────
export async function login(email: string, password: string) {
  return apiFetch("/api/auth/mobile-token", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  return apiFetch("/api/users/change-password", {
    method: "POST",
    body: JSON.stringify({ userId, currentPassword, newPassword }),
  });
}

// ── Quotes ────────────────────────────────────────────────────────────────────
export async function fetchQuotes(workspaceId: string) {
  return apiFetch(`/api/quotes?workspaceId=${workspaceId}`);
}

export async function updateQuoteStatus(id: string, status: string) {
  return apiFetch("/api/quotes", {
    method: "PATCH",
    body: JSON.stringify({ id, status }),
  });
}

// ── Customers ─────────────────────────────────────────────────────────────────
export async function fetchCustomers(workspaceId: string) {
  return apiFetch(`/api/customers?workspaceId=${workspaceId}`);
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
export async function fetchSuppliers(workspaceId: string) {
  return apiFetch(`/api/suppliers?workspaceId=${workspaceId}`);
}

// ── Returns ───────────────────────────────────────────────────────────────────
export async function fetchReturns(workspaceId: string) {
  return apiFetch(`/api/returns?workspaceId=${workspaceId}`);
}

export async function updateReturnStatus(id: string, status: string) {
  return apiFetch("/api/returns", {
    method: "PATCH",
    body: JSON.stringify({ id, status }),
  });
}

// ── Purchase Orders ───────────────────────────────────────────────────────────
export async function fetchPurchaseOrders(workspaceId: string) {
  return apiFetch(`/api/purchase-orders?workspaceId=${workspaceId}`);
}

export async function updatePOApproval(id: string, approvalStatus: string, approvedBy?: string) {
  return apiFetch("/api/purchase-orders", {
    method: "PATCH",
    body: JSON.stringify({ id, approvalStatus, approvedBy }),
  });
}

// ── Invoices ──────────────────────────────────────────────────────────────────
export async function fetchInvoices(workspaceId: string) {
  return apiFetch(`/api/invoices?workspaceId=${workspaceId}`);
}

export async function createInvoice(data: object) {
  return apiFetch("/api/invoices", { method: "POST", body: JSON.stringify(data) });
}

export async function updateInvoice(id: string, fields: object) {
  return apiFetch("/api/invoices", { method: "PATCH", body: JSON.stringify({ id, ...fields }) });
}

// ── Contracts ─────────────────────────────────────────────────────────────────
export async function fetchContracts(workspaceId: string) {
  return apiFetch(`/api/contracts?workspaceId=${workspaceId}`);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export async function fetchAnalytics(workspaceId: string) {
  return apiFetch(`/api/dashboard?workspaceId=${workspaceId}`);
}

// ── Tickets ───────────────────────────────────────────────────────────────────
export async function fetchTickets(workspaceId: string) {
  return apiFetch(`/api/tickets?workspaceId=${workspaceId}`);
}

export async function createTicket(data: object) {
  return apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(data) });
}

export async function updateTicket(id: string, fields: object) {
  return apiFetch("/api/tickets", { method: "PATCH", body: JSON.stringify({ id, ...fields }) });
}

export async function fetchTicketComments(ticketId: string) {
  return apiFetch(`/api/tickets/comments?ticketId=${ticketId}`);
}

export async function postTicketComment(ticketId: string, authorId: string, authorName: string, body: string) {
  return apiFetch("/api/tickets/comments", {
    method: "POST",
    body: JSON.stringify({ ticketId, authorId, authorName, body }),
  });
}

// ── Orders (create) ───────────────────────────────────────────────────────────
export async function createOrder(data: object) {
  return apiFetch("/api/orders", { method: "POST", body: JSON.stringify(data) });
}

// ── Inventory (create) ────────────────────────────────────────────────────────
export async function createInventoryItem(data: object) {
  return apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(data) });
}

// ── Customers (create / update) ───────────────────────────────────────────────
export async function createCustomer(data: object) {
  return apiFetch("/api/customers", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCustomer(id: string, fields: object) {
  return apiFetch("/api/customers", { method: "PATCH", body: JSON.stringify({ id, ...fields }) });
}

// ── Suppliers (create / update) ───────────────────────────────────────────────
export async function createSupplier(data: object) {
  return apiFetch("/api/suppliers", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSupplier(id: string, fields: object) {
  return apiFetch("/api/suppliers", { method: "PATCH", body: JSON.stringify({ id, ...fields }) });
}

// ── Quotes (create) ───────────────────────────────────────────────────────────
export async function createQuote(data: object) {
  return apiFetch("/api/quotes", { method: "POST", body: JSON.stringify(data) });
}

// ── Returns (create) ──────────────────────────────────────────────────────────
export async function createReturn(data: object) {
  return apiFetch("/api/returns", { method: "POST", body: JSON.stringify(data) });
}

// ── Shipments (create) ────────────────────────────────────────────────────────
export async function createShipment(data: object) {
  return apiFetch("/api/shipments", { method: "POST", body: JSON.stringify(data) });
}

// ── Invoices (update status) ──────────────────────────────────────────────────
export async function updateInvoiceStatus(id: string, status: string, amountPaid: number) {
  return apiFetch("/api/invoices", { method: "PATCH", body: JSON.stringify({ id, status, amountPaid }) });
}

// ── Purchase Orders (create) ──────────────────────────────────────────────────
export async function createPurchaseOrder(data: object) {
  return apiFetch("/api/purchase-orders", { method: "POST", body: JSON.stringify(data) });
}

// ── Contracts (create) ────────────────────────────────────────────────────────
export async function createContract(data: object) {
  return apiFetch("/api/contracts", { method: "POST", body: JSON.stringify(data) });
}
