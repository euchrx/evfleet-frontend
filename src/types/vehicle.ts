export type VehicleType = "LIGHT" | "HEAVY";
export type VehicleCategory = "CAR" | "TRUCK" | "UTILITY" | "IMPLEMENT";

export type AxleConfiguration = "SINGLE" | "DUAL";

export type FuelType =
  | "GASOLINE"
  | "ETHANOL"
  | "DIESEL"
  | "ARLA32"
  | "FLEX"
  | "ELECTRIC"
  | "HYBRID"
  | "CNG";

export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "SOLD";

export type VehicleLinkedImplementVehicle = {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  fipeValue?: number | null;
  vehicleType: VehicleType;
  category?: VehicleCategory;

  axleCount?: number | null;
  axleConfiguration?: AxleConfiguration | null;

  chassis?: string | null;
  renavam?: string | null;
  acquisitionDate?: string | null;
  fuelType?: FuelType | null;
  tankCapacity?: number | null;
  status?: VehicleStatus;
  currentKm?: number | null;
  profilePhotoUrl?: string | null;
  photoUrls?: string[];
  documentUrls?: string[];
  companyId?: string;
  branchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LinkedImplement = {
  id: string;
  position: number;
  implementId: string;
  implement: VehicleLinkedImplementVehicle;
};

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  fipeValue?: number | null;
  vehicleType: VehicleType;
  category?: VehicleCategory;

  axleCount?: number | null;
  axleConfiguration?: AxleConfiguration | null;

  chassis?: string | null;
  renavam?: string | null;
  acquisitionDate?: string | null;
  fuelType?: FuelType | null;
  tankCapacity?: number | null;
  status?: VehicleStatus;
  currentKm?: number | null;
  profilePhotoUrl?: string | null;
  photoUrls?: string[];
  documentUrls?: string[];
  companyId?: string;
  branchId?: string | null;
  createdAt?: string;
  updatedAt?: string;

  implements?: LinkedImplement[];
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