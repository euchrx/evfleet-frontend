import { api } from "./api";

export async function resetAllDatabase() {
  const response = await api.post("/system-reset/all");
  return response.data;
}

