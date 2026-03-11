export type Debt = {
  id: string;
  description: string;
  category: "FINE" | "IPVA" | "LICENSING" | "INSURANCE" | "TOLL" | "TAX" | "OTHER";
  amount: number;
  points: number;
  debtDate: string;
  dueDate?: string | null;
  creditor?: string | null;
  isRecurring?: boolean;
  status: string;
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
  };
};
