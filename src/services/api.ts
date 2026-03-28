import axios from "axios";
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

function shouldAttachCompanyScope(url?: string) {
  const path = getNormalizedPath(url);
  if (!path) return true;
  if (/^\/auth(\/|$)/i.test(path)) return false;
  if (/^\/companies\/me(\/|$)/i.test(path)) return false;
  return true;
}

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = readAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!shouldAttachCompanyScope(config.url)) {
    return config;
  }

  const companyScopeId = localStorage.getItem(COMPANY_SCOPE_STORAGE_KEY)?.trim();
  const headers = (config.headers ?? {}) as any;
  const hasExplicitCompanyScopeHeader =
    Object.prototype.hasOwnProperty.call(headers, "x-company-scope") ||
    Object.prototype.hasOwnProperty.call(headers, "X-Company-Scope");

  if (companyScopeId && !hasExplicitCompanyScopeHeader) {
    headers["x-company-scope"] = companyScopeId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(localizeAxiosError(error))
);
