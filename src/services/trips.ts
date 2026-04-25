import axios from "axios";
import { api } from "./api";
import type {
  Trip,
  TripGeneratedDocument,
  TripProduct,
  TripStatus,
} from "../types/trip";

export type CreateTripInput = {
  origin: string;
  destination: string;
  reason?: string;
  departureKm: number;
  departureAt: string;
  notes?: string;
  vehicleId: string;
  driverId?: string | null;
};

export type UpdateTripInput = Partial<{
  origin: string;
  destination: string;
  reason?: string;
  departureKm: number;
  returnKm?: number;
  departureAt: string;
  returnAt?: string;
  status?: TripStatus;
  notes?: string;
  vehicleId: string;
  driverId?: string | null;
}>;

export type AddTripProductInput = {
  dangerousProductId: string;
  quantity: number;
  unit: string;
  tankCompartment?: string;
  invoiceKey?: string;
  invoiceNumber?: string;
};

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

export async function getTrip(id: string) {
  const response = await api.get<Trip>(`/trips/${id}`);
  return response.data;
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

export async function addTripProduct(id: string, data: AddTripProductInput) {
  const response = await api.post<TripProduct>(`/trips/${id}/products`, data);
  return response.data;
}

export async function getTripProducts(id: string) {
  const response = await api.get(`/trips/${id}/products`);
  return Array.isArray(response.data) ? (response.data as TripProduct[]) : [];
}

export async function removeTripProduct(id: string, tripProductId: string) {
  await api.delete(`/trips/${id}/products/${tripProductId}`);
}

export async function validateTripCompliance(id: string) {
  const response = await api.post(`/trips/${id}/validate-compliance`);
  return response.data;
}

export async function generateEmergencySheet(id: string) {
  const response = await api.post<TripGeneratedDocument>(
    `/trips/${id}/generate-emergency-sheet`,
  );

  return response.data;
}

export async function generateMdfe(id: string) {
  const response = await api.post<TripGeneratedDocument>(
    `/trips/${id}/generate-mdfe`,
  );

  return response.data;
}

export async function startTrip(id: string) {
  const response = await api.post<Trip>(`/trips/${id}/start`);
  return response.data;
}