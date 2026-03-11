import { api } from "./api";

export type FuelRecord = {
  id: string;
  liters: number;
  totalValue: number;
  km: number;
  station: string;
  fuelType: "GASOLINE" | "ETHANOL" | "DIESEL" | "FLEX" | "ELECTRIC" | "HYBRID" | "CNG";
  averageConsumptionKmPerLiter?: number | null;
  isAnomaly?: boolean;
  anomalyReason?: string | null;
  fuelDate: string;
  createdAt: string;
  vehicleId: string;
  driverId?: string | null;
  driver?: {
    id: string;
    name: string;
  } | null;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
    year: number;
    currentKm: number;
    createdAt: string;
    branchId: string;
    costCenterId: string;
    branch: {
      id: string;
      name: string;
      city: string;
      state: string;
      createdAt: string;
    };
    costCenter?: {
      id: string;
      name: string;
    };
  };
};

export type FuelInsights = {
  summary: {
    totalRecords: number;
    anomalies: number;
  };
  comparison: Array<{
    vehicleId: string;
    label: string;
    liters: number;
    totalValue: number;
    averageConsumptionKmPerLiter: number | null;
    anomalies: number;
  }>;
  anomalies: Array<{
    id: string;
    date: string;
    vehicle: string;
    driver: string;
    averageConsumptionKmPerLiter: number | null;
    reason: string;
  }>;
};

export type CreateFuelRecordInput = {
  liters: number;
  totalValue: number;
  km: number;
  station: string;
  fuelType: FuelRecord["fuelType"];
  fuelDate: string;
  vehicleId: string;
  driverId?: string | null;
};

export type UpdateFuelRecordInput = Partial<
  CreateFuelRecordInput
>;

export async function getFuelRecords() {
  const response = await api.get("/fuel-records");

  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.items)) return response.data.items;
  if (Array.isArray(response.data?.data)) return response.data.data;

  return [];
}

export async function getFuelInsights() {
  const response = await api.get<FuelInsights>("/fuel-records/insights");
  return response.data;
}

export async function createFuelRecord(data: CreateFuelRecordInput) {
  const response = await api.post<FuelRecord>("/fuel-records", data);
  return response.data;
}

export async function updateFuelRecord(id: string, data: UpdateFuelRecordInput) {
  const response = await api.patch<FuelRecord>(`/fuel-records/${id}`, data);
  return response.data;
}

export async function acknowledgeFuelRecordAnomaly(id: string) {
  const response = await api.patch<FuelRecord>(`/fuel-records/${id}/acknowledge-anomaly`);
  return response.data;
}

export async function deleteFuelRecord(id: string) {
  await api.delete(`/fuel-records/${id}`);
}
