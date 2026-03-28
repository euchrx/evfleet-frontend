export function normalizeApiBaseUrl(rawValue: string | null | undefined) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "/api";

  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  if (!withoutTrailingSlash || withoutTrailingSlash === ".") {
    return "/api";
  }

  return withoutTrailingSlash;
}

export function joinApiUrl(baseUrl: string, path: string) {
  const base = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return base;
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${base}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
