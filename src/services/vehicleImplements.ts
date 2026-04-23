import { api } from "./api";
import type { Vehicle } from "../types/vehicle";

export type LinkedImplementItem = {
  id: string;
  position: number;
  implementId: string;
  implement: Vehicle;
};

export type VehicleImplementsResponse = {
  vehicle: {
    id: string;
    plate: string;
    category?: string;
  };
  implements: LinkedImplementItem[];
};

export type SyncVehicleImplementsPayload = {
  implementIds: string[];
};

export async function getVehicleImplements(vehicleId: string) {
  const { data } = await api.get<VehicleImplementsResponse>(
    `/vehicles/${vehicleId}/implements`,
  );

  return data;
}

export async function syncVehicleImplements(
  vehicleId: string,
  payload: SyncVehicleImplementsPayload,
) {
  const { data } = await api.put<VehicleImplementsResponse>(
    `/vehicles/${vehicleId}/implements`,
    payload,
  );

  return data;
}