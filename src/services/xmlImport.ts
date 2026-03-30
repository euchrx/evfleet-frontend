import { api } from "./api";

export type XmlImportBatchSummary = {
  batchId: string;
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  errorFiles: number;
  status?: string;
};

export type XmlImportBatch = {
  id: string;
  fileName: string;
  periodLabel?: string | null;
  status: string;
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  errorFiles: number;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
  } | null;
};

export type XmlInvoice = {
  id: string;
  batchId: string;
  fileName: string;
  folderName?: string | null;
  invoiceKey: string;
  number?: string | null;
  series?: string | null;
  issuedAt?: string | null;
  issuerName?: string | null;
  issuerDocument?: string | null;
  recipientName?: string | null;
  recipientDocument?: string | null;
  totalAmount?: string | number | null;
  protocolNumber?: string | null;
  invoiceStatus: string;
  createdAt: string;
  _count?: {
    items?: number;
  };
};

export async function uploadXmlZip(file: File, branchId?: string, periodLabel?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (branchId?.trim()) formData.append("branchId", branchId.trim());
  if (periodLabel?.trim()) formData.append("periodLabel", periodLabel.trim());

  const { data } = await api.post<XmlImportBatchSummary>("/xml-import/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
}

export async function getXmlImportBatches() {
  const { data } = await api.get<XmlImportBatch[]>("/xml-import/batches");
  return Array.isArray(data) ? data : [];
}

export async function getXmlImportInvoices(batchId?: string) {
  const { data } = await api.get<XmlInvoice[]>("/xml-import/invoices", {
    params: batchId ? { batchId } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

