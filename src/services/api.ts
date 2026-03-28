import axios from "axios";
import { localizeAxiosError } from "../utils/errorTranslator";
import { COMPANY_SCOPE_STORAGE_KEY } from "../contexts/CompanyScopeContext";
import { readAuthToken } from "./authToken";
import { joinApiUrl, normalizeApiBaseUrl } from "./url";

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const baseURL = normalizeApiBaseUrl(envBaseUrl);

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = readAuthToken();
  const requestUrl = String(config.url || "");
  const isAuthBootstrapRequest =
    requestUrl.includes("/auth/me") || requestUrl.includes("/companies/me");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (isAuthBootstrapRequest) {
    console.log("[api] request", {
      method: config.method,
      url: joinApiUrl(String(config.baseURL || baseURL), requestUrl),
      hasAuthorization: Boolean(config.headers?.Authorization),
      authorizationPreview: token ? `${token.slice(0, 16)}...` : null,
    });
  }

  const companyScopeId = localStorage.getItem(COMPANY_SCOPE_STORAGE_KEY)?.trim();
  const hasExplicitCompanyScopeHeader =
    typeof (config.headers as any)?.["x-company-scope"] !== "undefined";

  if (companyScopeId && !hasExplicitCompanyScopeHeader) {
    config.headers["x-company-scope"] = companyScopeId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(localizeAxiosError(error))
);
