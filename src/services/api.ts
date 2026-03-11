import axios from "axios";

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const baseURL =
  envBaseUrl ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://localhost:3000");

function normalizeToken(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "");
}

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = normalizeToken(localStorage.getItem("token"));

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
