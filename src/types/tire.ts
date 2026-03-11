export type TireStatus =
  | "IN_STOCK"
  | "INSTALLED"
  | "MAINTENANCE"
  | "RETREADED"
  | "SCRAPPED";

export type Tire = {
  id: string;
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  status: TireStatus;
  axlePosition?: string | null;
  wheelPosition?: string | null;
  currentKm: number;
  currentTreadDepthMm?: number | null;
  currentPressurePsi?: number | null;
  targetPressurePsi?: number | null;
  minTreadDepthMm: number;
  installedAt?: string | null;
  notes?: string | null;
  vehicleId?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
    branchId: string;
    branch: {
      id: string;
      name: string;
    };
  };
  readings?: TireReading[];
};

export type TireReading = {
  id: string;
  readingDate: string;
  km: number;
  treadDepthMm: number;
  pressurePsi: number;
  condition?: string | null;
  notes?: string | null;
  tireId: string;
  vehicleId?: string | null;
  createdAt: string;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
};

export type TireAlert = {
  tireId: string;
  serialNumber: string;
  vehicle: string;
  type: "TREAD" | "PRESSURE";
  severity: "HIGH" | "MEDIUM";
  message: string;
};
