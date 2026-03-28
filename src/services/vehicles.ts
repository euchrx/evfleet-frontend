import { api } from "./api";
import type { Vehicle, VehicleHistoryResponse } from "../types/vehicle";

export type CreateVehicleInput = {
  plate: string;
  model: string;
  brand: string;
  year: number;
  vehicleType: "LIGHT" | "HEAVY";
  category: "CAR" | "TRUCK" | "UTILITY";
  chassis: string;
  renavam: string;
  acquisitionDate?: string;
  fuelType: "GASOLINE" | "ETHANOL" | "DIESEL" | "FLEX" | "ELECTRIC" | "HYBRID" | "CNG";
  tankCapacity: number;
  status: "ACTIVE" | "MAINTENANCE" | "SOLD";
  photoUrls?: string[];
  documentUrls?: string[];
  branchId?: string;
};

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export async function getVehicles() {
  const response = await api.get("/vehicles");

  if (Array.isArray(response.data)) return response.data as Vehicle[];
  if (Array.isArray(response.data?.items)) return response.data.items as Vehicle[];
  if (Array.isArray(response.data?.data)) return response.data.data as Vehicle[];

  return [];
}

export async function getVehicleHistory(id: string, page = 1, limit = 10) {
  const response = await api.get<VehicleHistoryResponse>(`/vehicles/${id}/history`, {
    params: { page, limit },
  });
  return response.data;
}

export async function createVehicle(data: CreateVehicleInput) {
  const response = await api.post<Vehicle>("/vehicles", data);
  return response.data;
}

export async function uploadVehicleFiles(
  kind: "photo" | "document",
  files: File[]
) {
  if (!files.length) return [];

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await api.post<{ urls: string[] }>(
    `/vehicles/upload/${kind}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data?.urls || [];
}

export async function uploadVehicleProfilePhoto(vehicleId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ vehicleId: string; profilePhotoUrl: string }>(
    `/vehicles/${vehicleId}/profile-photo`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

export async function updateVehicle(id: string, data: UpdateVehicleInput) {
  const response = await api.patch<Vehicle>(`/vehicles/${id}`, data);
  return response.data;
}

export async function deleteVehicle(id: string) {
  await api.delete(`/vehicles/${id}`);
}
