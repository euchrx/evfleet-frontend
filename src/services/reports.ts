import axios from "axios";
import { api } from "./api";

function normalizeArrayResponse(data: unknown) {
  if (Array.isArray(data)) return data;

  if (typeof data === "object" && data !== null) {
    const maybeItems = (data as { items?: unknown }).items;
    const maybeData = (data as { data?: unknown }).data;

    if (Array.isArray(maybeItems)) return maybeItems;
    if (Array.isArray(maybeData)) return maybeData;
  }

  return [];
}

async function safeGetArray(url: string, params?: Record<string, string>) {
  try {
    const response = await api.get(url, { params });
    return normalizeArrayResponse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getVehicleCostSummary(vehicleId?: string) {
  return safeGetArray(
    "/reports/vehicle-cost-summary",
    vehicleId ? { vehicleId } : undefined
  );
}

export async function getBranchCostSummary() {
  return safeGetArray("/reports/branch-cost-summary");
}

export async function getVehicleConsumption(vehicleId: string) {
  return safeGetArray(`/reports/vehicle-consumption/${vehicleId}`);
}

export async function getRankingMostExpensiveVehicles() {
  return safeGetArray("/reports/ranking-most-expensive-vehicles");
}
