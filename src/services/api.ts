import axios, { AxiosHeaders } from "axios";
import { localizeAxiosError } from "../utils/errorTranslator";
import { COMPANY_SCOPE_STORAGE_KEY } from "../contexts/CompanyScopeContext";
import { readAuthToken } from "./authToken";
import { normalizeApiBaseUrl } from "./url";

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const baseURL = normalizeApiBaseUrl(envBaseUrl);

function getNormalizedPath(url?: string) {
  if (!url) return "";
  const trimmed = String(url).trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname || "";
    } catch {
      return "";
    }
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isPublicRoute(url?: string) {
  const path = getNormalizedPath(url);

  if (!path) return false;

  return (
    /^\/auth\/login(\/|$)/i.test(path) ||
    /^\/auth\/register(\/|$)/i.test(path) ||
    /^\/companies\/me(\/|$)/i.test(path) ||
    /^\/kiosk\/feedback(\/|$)/i.test(path)
  );
}

function shouldAttachAuthToken(url?: string) {
  return !isPublicRoute(url);
}

function shouldAttachCompanyScope(url?: string) {
  const path = getNormalizedPath(url);

  if (!path) return true;
  if (isPublicRoute(path)) return false;
  if (/^\/auth(\/|$)/i.test(path)) return false;

  return true;
}

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const path = getNormalizedPath(config.url);
  const headers = AxiosHeaders.from(config.headers);

  if (shouldAttachAuthToken(path)) {
    const token = readAuthToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } else {
    headers.delete("Authorization");
  }

  if (shouldAttachCompanyScope(path)) {
    const companyScopeId = localStorage
      .getItem(COMPANY_SCOPE_STORAGE_KEY)
      ?.trim();

    const hasExplicitCompanyScopeHeader =
      headers.has("x-company-scope") ||
      headers.has("X-Company-Scope");

    if (companyScopeId && !hasExplicitCompanyScopeHeader) {
      headers.set("x-company-scope", companyScopeId);
    }
  } else {
    headers.delete("x-company-scope");
    headers.delete("X-Company-Scope");
  }

  config.headers = headers;

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(localizeAxiosError(error))
);