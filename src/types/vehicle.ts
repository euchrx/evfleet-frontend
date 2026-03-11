export type VehicleType = "LIGHT" | "HEAVY";
export type VehicleCategory = "CAR" | "TRUCK" | "UTILITY";
export type FuelType =
  | "GASOLINE"
  | "ETHANOL"
  | "DIESEL"
  | "FLEX"
  | "ELECTRIC"
  | "HYBRID"
  | "CNG";
export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "SOLD";

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  vehicleType: VehicleType;
  category?: VehicleCategory;
  chassis?: string;
  renavam?: string;
  acquisitionDate?: string;
  fuelType?: FuelType;
  tankCapacity?: number;
  status?: VehicleStatus;
  currentKm?: number;
  photoUrls?: string[];
  documentUrls?: string[];
  branchId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VehicleHistoryItem = {
  date: string;
  type: string;
  title: string;
  description: string;
};

export type VehicleHistoryResponse = {
  vehicle: Vehicle;
  history: VehicleHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
