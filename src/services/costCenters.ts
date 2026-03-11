import { api } from "./api";
import type { CostCenter } from "../types/costCenter";

export async function getCostCenters() {
  const response = await api.get("/cost-centers");

  if (Array.isArray(response.data)) {
    return response.data as CostCenter[];
  }

  if (Array.isArray(response.data?.items)) {
    return response.data.items as CostCenter[];
  }

  if (Array.isArray(response.data?.data)) {
    return response.data.data as CostCenter[];
  }

  return [];
}