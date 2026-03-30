import { api } from "./api";

export type FuelRecord = {
  id: string;
  invoiceNumber?: string | null;
  liters: number;
  totalValue: number;
  km: number;
  station: string;
  fuelType: "GASOLINE" | "ETHANOL" | "DIESEL" | "FLEX" | "ELECTRIC" | "HYBRID" | "CNG";
  averageConsumptionKmPerLiter?: number | null;
  isAnomaly?: boolean;
  anomalyReason?: string | null;
  fuelDate: string;
  createdAt: string;
  vehicleId: string;
  driverId?: string | null;
  driver?: {
    id: string;
    name: string;
  } | null;
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

export type FuelInsights = {
  summary: {
    totalRecords: number;
    anomalies: number;
  };
  comparison: Array<{
    vehicleId: string;
    label: string;
    liters: number;
    totalValue: number;
    averageConsumptionKmPerLiter: number | null;
    anomalies: number;
  }>;
  anomalies: Array<{
    id: string;
    date: string;
    vehicle: string;
    driver: string;
    averageConsumptionKmPerLiter: number | null;
    reason: string;
  }>;
};

export type CreateFuelRecordInput = {
  invoiceNumber?: string | null;
  liters: number;
  totalValue: number;
  km: number;
  station: string;
  fuelType: FuelRecord["fuelType"];
  fuelDate: string;
  vehicleId: string;
  driverId?: string | null;
};

export type UpdateFuelRecordInput = Partial<
  CreateFuelRecordInput
>;

export type FuelXmlImportSummary = {
  batchId: string;
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  errorFiles: number;
  eligibleDomainInvoices: number;
  ignoredByDomainFilter: number;
};

export type FuelXmlPreviewItem = {
  invoiceKey: string;
  issuerName?: string | null;
  number?: string | null;
  series?: string | null;
  issuedAt?: string | null;
  totalAmount?: string | number | null;
  items: Array<{
    description: string;
    quantity?: number;
    unitValue?: number;
    totalValue?: number;
  }>;
  suggestedBranchId?: string | null;
  xmlInvoiceId?: string | null;
  alreadyExists?: boolean;
};

export type FuelXmlPreviewResponse = {
  totalFiles: number;
  eligibleCount: number;
  ignoredDuplicates: number;
  ignoredNonFuel: number;
  previewItems: FuelXmlPreviewItem[];
};

export type FuelXmlConfirmInput = {
  invoiceKey: string;
  vehicleId?: string;
  driverId?: string;
  km?: number;
  branchId?: string;
};

export type FuelXmlConfirmResponse = {
  createdCount: number;
  ignoredCount: number;
  createdIds: string[];
};

export type FuelImportedXmlInvoice = {
  id: string;
  issuerName?: string | null;
  number?: string | null;
  issuedAt?: string | null;
  totalAmount?: string | number | null;
  processingStatus?: string | null;
  processingType?: string | null;
  invoiceKey: string;
};

export type FuelImportedXmlFilters = {
  period?: string;
  issuerName?: string;
  number?: string;
  processingStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getFuelRecords() {
  const response = await api.get("/fuel-records");

  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.items)) return response.data.items;
  if (Array.isArray(response.data?.data)) return response.data.data;

  return [];
}

export async function importFuelXml(
  file: File,
  branchId?: string,
  periodLabel?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  if (branchId?.trim()) formData.append("branchId", branchId.trim());
  if (periodLabel?.trim()) formData.append("periodLabel", periodLabel.trim());

  const response = await api.post<FuelXmlImportSummary>(
    "/fuel-records/import-xml",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function previewFuelXml(
  file: File,
  branchId?: string,
  periodLabel?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  if (branchId?.trim()) formData.append("branchId", branchId.trim());
  if (periodLabel?.trim()) formData.append("periodLabel", periodLabel.trim());

  const response = await api.post<FuelXmlPreviewResponse>(
    "/fuel-records/import-xml/preview",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function confirmFuelXmlImports(imports: FuelXmlConfirmInput[]) {
  const response = await api.post<FuelXmlConfirmResponse>(
    "/fuel-records/import-xml/confirm",
    { imports },
  );
  return response.data;
}

export async function getFuelImportedXml(
  filters: FuelImportedXmlFilters = {},
) {
  const response = await api.get<FuelImportedXmlInvoice[]>(
    "/fuel-records/imported-xml",
    {
      params: {
        ...(filters.period?.trim() ? { period: filters.period.trim() } : {}),
        ...(filters.issuerName?.trim()
          ? { issuerName: filters.issuerName.trim() }
          : {}),
        ...(filters.number?.trim() ? { number: filters.number.trim() } : {}),
        ...(filters.processingStatus?.trim()
          ? { processingStatus: filters.processingStatus.trim() }
          : {}),
        ...(filters.dateFrom?.trim() ? { dateFrom: filters.dateFrom.trim() } : {}),
        ...(filters.dateTo?.trim() ? { dateTo: filters.dateTo.trim() } : {}),
      },
    },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function processImportedFuelXmlInvoice(invoiceId: string) {
  const response = await api.post<{ createdRecordId: string; processingStatus: string }>(
    `/xml-import/invoices/${invoiceId}/process/fuel`,
  );
  return response.data;
}

export async function getFuelInsights() {
  const response = await api.get<FuelInsights>("/fuel-records/insights");
  return response.data;
}

export async function createFuelRecord(data: CreateFuelRecordInput) {
  const response = await api.post<FuelRecord>("/fuel-records", data);
  return response.data;
}

export async function updateFuelRecord(id: string, data: UpdateFuelRecordInput) {
  const response = await api.patch<FuelRecord>(`/fuel-records/${id}`, data);
  return response.data;
}

export async function acknowledgeFuelRecordAnomaly(id: string) {
  const response = await api.patch<FuelRecord>(`/fuel-records/${id}/acknowledge-anomaly`);
  return response.data;
}

export async function deleteFuelRecord(id: string) {
  await api.delete(`/fuel-records/${id}`);
}
