import { api } from "./api";
import type {
  MaintenanceAlertsResponse,
  MaintenancePlan,
} from "../types/maintenance-plan";

export type CreateMaintenancePlanInput = {
  name: string;
  planType: string;
  intervalUnit: string;
  intervalValue: number;
  alertBeforeKm?: number;
  alertBeforeDays?: number;
  nextDueDate?: string;
  nextDueKm?: number;
  lastExecutedDate?: string;
  active?: boolean;
  notes?: string;
  vehicleId: string;
};

export type UpdateMaintenancePlanInput = Partial<CreateMaintenancePlanInput>;

export async function getMaintenancePlans() {
  const response = await api.get("/maintenance-plans");

  if (Array.isArray(response.data)) return response.data as MaintenancePlan[];
  if (Array.isArray(response.data?.items))
    return response.data.items as MaintenancePlan[];
  if (Array.isArray(response.data?.data)) return response.data.data as MaintenancePlan[];

  return [];
}

export async function createMaintenancePlan(data: CreateMaintenancePlanInput) {
  const response = await api.post<MaintenancePlan>("/maintenance-plans", data);
  return response.data;
}

export async function getMaintenanceAgenda() {
  const response = await api.get("/maintenance-plans/agenda");
  if (Array.isArray(response.data)) return response.data as MaintenancePlan[];
  if (Array.isArray(response.data?.items)) return response.data.items as MaintenancePlan[];
  if (Array.isArray(response.data?.data)) return response.data.data as MaintenancePlan[];
  return [];
}

export async function getMaintenanceAlerts() {
  const response = await api.get<MaintenanceAlertsResponse>("/maintenance-plans/alerts");
  return response.data;
}

export async function updateMaintenancePlan(
  id: string,
  data: UpdateMaintenancePlanInput
) {
  const response = await api.patch<MaintenancePlan>(`/maintenance-plans/${id}`, data);
  return response.data;
}

export async function deleteMaintenancePlan(id: string) {
  await api.delete(`/maintenance-plans/${id}`);
}
