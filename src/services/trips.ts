import axios from "axios";
import { api } from "./api";
import type { Trip } from "../types/trip";

export type CreateTripInput = {
  origin: string;
  destination: string;
  reason?: string;
  departureKm: number;
  returnKm?: number;
  departureAt: string;
  returnAt?: string;
  status?: "OPEN" | "COMPLETED" | "CANCELLED";
  notes?: string;
  vehicleId: string;
  driverId?: string | null;
};

export type UpdateTripInput = Partial<CreateTripInput>;

export async function getTrips() {
  try {
    const response = await api.get("/trips");
    if (Array.isArray(response.data)) return response.data as Trip[];
    if (Array.isArray(response.data?.items)) return response.data.items as Trip[];
    if (Array.isArray(response.data?.data)) return response.data.data as Trip[];
    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}

export async function createTrip(data: CreateTripInput) {
  const response = await api.post<Trip>("/trips", data);
  return response.data;
}

export async function updateTrip(id: string, data: UpdateTripInput) {
  const response = await api.patch<Trip>(`/trips/${id}`, data);
  return response.data;
}

export async function deleteTrip(id: string) {
  await api.delete(`/trips/${id}`);
}
