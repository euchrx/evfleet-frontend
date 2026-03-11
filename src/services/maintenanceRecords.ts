import axios from "axios";
import { api } from "./api";
import type { MaintenanceRecord } from "../types/maintenance-record";

export type CreateMaintenanceRecordInput = {
  type: string;
  description: string;
  partsReplaced?: string[];
  workshop?: string;
  responsible?: string;
  cost: number;
  km: number;
  maintenanceDate: string;
  status: string;
  notes?: string;
  vehicleId: string;
};

export type UpdateMaintenanceRecordInput = CreateMaintenanceRecordInput;

export async function getMaintenanceRecords() {
  try {
    const response = await api.get("/maintenance-records");

    if (Array.isArray(response.data)) return response.data as MaintenanceRecord[];
    if (Array.isArray(response.data?.items)) return response.data.items as MaintenanceRecord[];
    if (Array.isArray(response.data?.data)) return response.data.data as MaintenanceRecord[];

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createMaintenanceRecord(
  data: CreateMaintenanceRecordInput
) {
  const response = await api.post<MaintenanceRecord>("/maintenance-records", data);
  return response.data;
}

export async function updateMaintenanceRecord(
  id: string,
  data: UpdateMaintenanceRecordInput
) {
  const response = await api.patch<MaintenanceRecord>(
    `/maintenance-records/${id}`,
    data
  );
  return response.data;
}

export async function deleteMaintenanceRecord(id: string) {
  await api.delete(`/maintenance-records/${id}`);
}
