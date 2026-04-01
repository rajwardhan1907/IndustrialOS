import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://industrial-os.vercel.app";

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

export async function storeSession(token: string, workspaceId: string, role: string) {
  await storage.setItem("auth_token", token);
  await storage.setItem("workspace_id", workspaceId);
  await storage.setItem("user_role", role);
}

export async function getSession() {
  const token = await storage.getItem("auth_token");
  const workspaceId = await storage.getItem("workspace_id");
  const role = await storage.getItem("user_role");
  return { token, workspaceId, role };
}

export async function clearSession() {
  await storage.removeItem("auth_token");
  await storage.removeItem("workspace_id");
  await storage.removeItem("user_role");
}
