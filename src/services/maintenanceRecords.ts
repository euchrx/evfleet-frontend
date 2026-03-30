import axios from "axios";
import { api } from "./api";
import type { MaintenanceRecord } from "../types/maintenance-record";

export type CreateMaintenanceRecordInput = {
  type: string;
  description: string;
  partsReplaced?: string[];
  workshop?: string;
  responsible?: string;
  cost: number;
  km: number;
  maintenanceDate: string;
  status: string;
  notes?: string;
  vehicleId: string;
};

export type UpdateMaintenanceRecordInput = CreateMaintenanceRecordInput;

export type MaintenanceXmlImportSummary = {
  batchId: string;
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  errorFiles: number;
  eligibleDomainInvoices: number;
  ignoredByDomainFilter: number;
};

export type MaintenanceImportedXmlInvoice = {
  id: string;
  issuerName?: string | null;
  number?: string | null;
  issuedAt?: string | null;
  totalAmount?: string | number | null;
  processingType?: "PRODUCT" | "SERVICE" | string | null;
  processingStatus?: string | null;
  invoiceKey: string;
};

export type MaintenanceImportedXmlFilters = {
  period?: string;
  issuerName?: string;
  number?: string;
  processingStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getMaintenanceRecords() {
  try {
    const response = await api.get("/maintenance-records");

    if (Array.isArray(response.data)) return response.data as MaintenanceRecord[];
    if (Array.isArray(response.data?.items)) return response.data.items as MaintenanceRecord[];
    if (Array.isArray(response.data?.data)) return response.data.data as MaintenanceRecord[];

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createMaintenanceRecord(
  data: CreateMaintenanceRecordInput
) {
  const response = await api.post<MaintenanceRecord>("/maintenance-records", data);
  return response.data;
}

export async function updateMaintenanceRecord(
  id: string,
  data: UpdateMaintenanceRecordInput
) {
  const response = await api.patch<MaintenanceRecord>(
    `/maintenance-records/${id}`,
    data
  );
  return response.data;
}

export async function deleteMaintenanceRecord(id: string) {
  await api.delete(`/maintenance-records/${id}`);
}

export async function importMaintenanceXml(
  file: File,
  branchId?: string,
  periodLabel?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  if (branchId?.trim()) formData.append("branchId", branchId.trim());
  if (periodLabel?.trim()) formData.append("periodLabel", periodLabel.trim());

  const response = await api.post<MaintenanceXmlImportSummary>(
    "/maintenance-records/import-xml",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function getMaintenanceImportedXml(
  filters: MaintenanceImportedXmlFilters = {},
) {
  const response = await api.get<MaintenanceImportedXmlInvoice[]>(
    "/maintenance-records/imported-xml",
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
