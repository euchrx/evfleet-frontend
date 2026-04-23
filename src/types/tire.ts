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
  rim?: number | null;

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
  originalTreadDepthMm?: number | null;

  installedAt?: string | null;
  lastInspectionDate?: string | null;

  loadIndex?: string | null;
  speedIndex?: string | null;

  numberOfLives?: number | null;
  currentLifeKm?: number | null;
  totalCasingKm?: number | null;

  reformCost?: number | null;

  warrantyStatus?: string | null;
  warrantyUntil?: string | null;

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