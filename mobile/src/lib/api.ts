// mobile/src/lib/api.ts
// All API calls go through here. BASE_URL points to the deployed web app.
// On dev: set EXPO_PUBLIC_API_URL=http://localhost:3000 in .env.local
// On prod: set EXPO_PUBLIC_API_URL=https://industrial-os.vercel.app

import * as SecureStore from "expo-secure-store";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://industrial-os.vercel.app";

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function storeSession(token: string, workspaceId: string, role: string) {
  await SecureStore.setItemAsync("auth_token",    token);
  await SecureStore.setItemAsync("workspace_id",  workspaceId);
  await SecureStore.setItemAsync("user_role",     role);
}

export async function getSession() {
  const token       = await SecureStore.getItemAsync("auth_token");
  const workspaceId = await SecureStore.getItemAsync("workspace_id");
  const role        = await SecureStore.getItemAsync("user_role");
  return { token, workspaceId, role };
}

export async function clearSession() {
  await SecureStore.deleteItemAsync("auth_token");
  await SecureStore.deleteItemAsync("workspace_id");
  await SecureStore.deleteItemAsync("user_role");
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

// ── Auth: login via next-auth credentials ────────────────────────────────────
export async function login(email: string, password: string) {
  // next-auth credentials sign-in returns a session cookie;
  // for mobile we call our custom /api/auth/mobile-token endpoint
  return apiFetch("/api/auth/mobile-token", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
