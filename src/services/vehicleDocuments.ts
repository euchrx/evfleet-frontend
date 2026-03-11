import axios from "axios";
import { api } from "./api";
import type { VehicleDocument } from "../types/vehicle-document";

export type CreateVehicleDocumentInput = {
  type: "LICENSING" | "INSURANCE" | "IPVA" | "LEASING_CONTRACT" | "INSPECTION" | "OTHER";
  name: string;
  number?: string;
  issueDate?: string;
  expiryDate?: string;
  status?: "VALID" | "EXPIRING" | "EXPIRED";
  issuer?: string;
  notes?: string;
  fileUrl?: string;
  vehicleId: string;
};

export type UpdateVehicleDocumentInput = Partial<CreateVehicleDocumentInput>;

export async function getVehicleDocuments() {
  try {
    const response = await api.get("/vehicle-documents");
    if (Array.isArray(response.data)) return response.data as VehicleDocument[];
    if (Array.isArray(response.data?.items)) return response.data.items as VehicleDocument[];
    if (Array.isArray(response.data?.data)) return response.data.data as VehicleDocument[];
    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}

export async function createVehicleDocument(data: CreateVehicleDocumentInput) {
  const response = await api.post<VehicleDocument>("/vehicle-documents", data);
  return response.data;
}

export async function uploadVehicleDocumentFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ fileUrl: string; fileName: string }>(
    "/vehicle-documents/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

export async function updateVehicleDocument(id: string, data: UpdateVehicleDocumentInput) {
  const response = await api.patch<VehicleDocument>(`/vehicle-documents/${id}`, data);
  return response.data;
}

export async function deleteVehicleDocument(id: string) {
  await api.delete(`/vehicle-documents/${id}`);
}
