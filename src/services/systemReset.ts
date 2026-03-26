import { api } from "./api";

export async function resetAllDatabase() {
  return api.post("/system-reset/all");
}

export async function resetAllDatabaseWithToken(jwtSecretToken: string) {
  const response = await api.post("/system-reset/all", { jwtSecretToken });
  return response.data;
}
