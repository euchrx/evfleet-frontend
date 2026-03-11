import axios from "axios";
import { api } from "./api";
import type { Tire, TireAlert, TireReading, TireStatus } from "../types/tire";

export type CreateTireInput = {
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  purchaseDate?: string;
  purchaseCost?: number;
  status?: TireStatus;
  axlePosition?: string;
  wheelPosition?: string;
  currentKm?: number;
  currentTreadDepthMm?: number;
  currentPressurePsi?: number;
  targetPressurePsi?: number;
  minTreadDepthMm?: number;
  installedAt?: string;
  notes?: string;
  vehicleId?: string;
};

export type UpdateTireInput = Partial<CreateTireInput>;

export type CreateTireReadingInput = {
  readingDate: string;
  km: number;
  treadDepthMm: number;
  pressurePsi: number;
  condition?: string;
  notes?: string;
  vehicleId?: string;
};

export async function getTires() {
  try {
    const response = await api.get("/tires");
    if (Array.isArray(response.data)) return response.data as Tire[];
    if (Array.isArray(response.data?.items)) return response.data.items as Tire[];
    if (Array.isArray(response.data?.data)) return response.data.data as Tire[];
    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}

export async function getTireAlerts() {
  const response = await api.get("/tires/alerts/summary");
  return response.data as { totalTires: number; totalAlerts: number; alerts: TireAlert[] };
}

export async function createTire(data: CreateTireInput) {
  const response = await api.post<Tire>("/tires", data);
  return response.data;
}

export async function updateTire(id: string, data: UpdateTireInput) {
  const response = await api.patch<Tire>(`/tires/${id}`, data);
  return response.data;
}

export async function deleteTire(id: string) {
  await api.delete(`/tires/${id}`);
}

export async function createTireReading(tireId: string, data: CreateTireReadingInput) {
  const response = await api.post<TireReading>(`/tires/${tireId}/readings`, data);
  return response.data;
}

export async function getTireReadings(tireId: string) {
  const response = await api.get<TireReading[]>(`/tires/${tireId}/readings`);
  return response.data;
}
