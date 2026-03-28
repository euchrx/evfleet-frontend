import axios from "axios";
import { api } from "./api";
import type { Driver } from "../types/driver";

export type CreateDriverInput = {
  name: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  phone?: string;
  status: string;
  vehicleId: string;
};

export type UpdateDriverInput = CreateDriverInput;

export async function getDrivers() {
  try {
    const response = await api.get("/drivers");

    if (Array.isArray(response.data)) return response.data as Driver[];
    if (Array.isArray(response.data?.items)) return response.data.items as Driver[];
    if (Array.isArray(response.data?.data)) return response.data.data as Driver[];

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createDriver(data: CreateDriverInput) {
  const response = await api.post<Driver>("/drivers", data);
  return response.data;
}

export async function updateDriver(id: string, data: UpdateDriverInput) {
  const response = await api.patch<Driver>(`/drivers/${id}`, data);
  return response.data;
}

export async function deleteDriver(id: string) {
  await api.delete(`/drivers/${id}`);
}
