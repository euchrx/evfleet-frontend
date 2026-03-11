export type MaintenanceRecord = {
  id: string;
  type: string;
  description: string;
  partsReplaced?: string[];
  workshop?: string | null;
  responsible?: string | null;
  cost: number;
  km: number;
  maintenanceDate: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  vehicleId: string;
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
