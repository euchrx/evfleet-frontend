export type Driver = {
  id: string;
  name: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  vehicleId?: string | null;
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
  } | null;
};