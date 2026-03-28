export const AUTH_TOKEN_STORAGE_KEY = "evfleet_auth_token";
const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";

function normalizeToken(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "");
}

export function readAuthToken() {
  const primary = normalizeToken(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  if (primary) return primary;
  return normalizeToken(localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY));
}

export function writeAuthToken(token: string) {
  const normalized = normalizeToken(token);
  if (!normalized) return null;
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
  localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, normalized);
  return normalized;
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
}
