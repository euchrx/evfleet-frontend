import { api } from "../services/api";

export function resolveApiMediaUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  if (/^(https?:\/\/|data:|blob:)/i.test(raw)) {
    return raw;
  }

  const base = String(api.defaults.baseURL || "").trim().replace(/\/+$/, "");
  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;

  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
}
