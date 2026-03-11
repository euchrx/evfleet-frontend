export type MaintenancePlan = {
  id: string;
  name: string;
  planType: string;
  intervalUnit: string;
  intervalValue: number;
  alertBeforeKm?: number | null;
  alertBeforeDays?: number | null;
  nextDueDate?: string | null;
  nextDueKm?: number | null;
  lastExecutedDate?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicleId: string;
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
};

export type MaintenanceAlert = {
  planId: string;
  vehicleId: string;
  vehicle: string;
  type: "TIME" | "KM";
  status: "DUE_SOON" | "OVERDUE";
  message: string;
  dueDate?: string;
  dueKm?: number;
  currentKm?: number;
};

export type MaintenanceAlertsResponse = {
  total: number;
  alerts: MaintenanceAlert[];
};
