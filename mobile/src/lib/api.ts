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
export async function storeSession(token: string, workspaceId: string, role: string) {
  await storage.setItem("auth_token",   token);
  await storage.setItem("workspace_id", workspaceId);
  await storage.setItem("user_role",    role);
}

export async function getSession() {
  const token       = await storage.getItem("auth_token");
  const workspaceId = await storage.getItem("workspace_id");
  const role        = await storage.getItem("user_role");
  return { token, workspaceId, role };
}

export async function clearSession() {
  await storage.removeItem("auth_token");
  await storage.removeItem("workspace_id");
  await storage.removeItem("user_role");
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
