// lib/mobileToken.ts
// Shared token helpers for the mobile auth routes.
// Token format: base64(userId|workspaceId|role|issuedAt|expiresAt)

export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function makeToken(
  userId: string,
  workspaceId: string,
  role: string
): { token: string; expiresAt: number } {
  const now = Date.now();
  const exp = now + TOKEN_TTL_MS;
  const payload = `${userId}|${workspaceId}|${role}|${now}|${exp}`;
  return { token: Buffer.from(payload).toString("base64"), expiresAt: exp };
}

export function decodeToken(
  token: string
): { userId: string; workspaceId: string; role: string; issuedAt: number; expiresAt: number } | null {
  try {
    const raw = Buffer.from(token, "base64").toString("utf8");
    const parts = raw.split("|");
    if (parts.length < 5) return null;
    const [userId, workspaceId, role, issuedAtStr, expiresAtStr] = parts;
    const issuedAt = Number(issuedAtStr);
    const expiresAt = Number(expiresAtStr);
    if (!userId || !workspaceId || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    return { userId, workspaceId, role, issuedAt, expiresAt };
  } catch {
    return null;
  }
}
