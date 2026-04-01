export type TripStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export type Trip = {
  id: string;
  origin: string;
  destination: string;
  reason?: string | null;
  departureKm: number;
  returnKm?: number | null;
  departureAt: string;
  returnAt?: string | null;
  status: TripStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicleId: string;
  driverId?: string | null;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
    branchId?: string | null;
    branch?: {
      id: string;
      name: string;
    } | null;
  };
  driver?: {
    id: string;
    name: string;
    status: string;
  };
};
