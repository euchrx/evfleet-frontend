import { api } from "./api";
import axios from "axios";

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
  branchId?: string | null;
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
  processingType?: string | null;
  processingStatus?: string | null;
  processedAt?: string | null;
  linkedFuelRecordId?: string | null;
  linkedMaintenanceRecordId?: string | null;
  linkedCostId?: string | null;
  createdAt: string;
  _count?: {
    items?: number;
  };
};

export type XmlInvoiceDetailItem = {
  id: string;
  productCode?: string | null;
  description: string;
  quantity?: string | number | null;
  unitValue?: string | number | null;
  totalValue?: string | number | null;
  createdAt: string;
};

export type XmlInvoiceDetail = XmlInvoice & {
  updatedAt?: string;
  rawXml?: string | null;
  linkedRetailProductImportId?: string | null;
  linkedFuelRecord?: {
    id: string;
    vehicleId?: string | null;
    driverId?: string | null;
    km?: number | null;
    fuelDate?: string | null;
    totalValue?: string | number | null;
  } | null;
  linkedMaintenanceRecord?: {
    id: string;
    vehicleId?: string | null;
    description?: string | null;
    maintenanceDate?: string | null;
    status?: string | null;
    cost?: string | number | null;
  } | null;
  linkedCost?: {
    id: string;
    vehicleId?: string | null;
    category?: string | null;
    amount?: string | number | null;
    debtDate?: string | null;
    status?: string | null;
  } | null;
  items: XmlInvoiceDetailItem[];
};

export type XmlInvoiceProcessResult = {
  invoiceId: string;
  processingStatus: string;
  createdRecordType:
    | "FUEL_RECORD"
    | "MAINTENANCE_RECORD"
    | "COST_RECORD"
    | "RETAIL_PRODUCT_IMPORT";
  createdRecordId: string;
};

export type XmlInvoiceIgnoreResult = {
  invoiceId: string;
  processingStatus: string;
  processedAt?: string | null;
};

export type DeleteXmlInvoicesResult = {
  requested: number;
  deleted: number;
  notFound: number;
  notFoundIds: string[];
};

export type DeleteXmlBatchResult = {
  batchId: string;
  deleted: boolean;
  deletedInvoices: number;
  deletedRetailProductImports: number;
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

export async function processXmlInvoiceFuel(invoiceId: string) {
  const { data } = await api.post<XmlInvoiceProcessResult>(
    `/xml-import/invoices/${invoiceId}/process/fuel`,
  );
  return data;
}

export type ConfirmFuelPayload = {
  vehicleId?: string;
  driverId?: string;
  km?: number;
  branchId?: string;
};

export type ConfirmMaintenancePayload = {
  vehicleId?: string;
  branchId?: string;
  descriptionComplement?: string;
};

export type ConfirmCostPayload = {
  vehicleId?: string;
  branchId?: string;
  category?: string;
};

export type ConfirmRetailProductPayload = {
  branchId?: string;
  category?: string;
};

export async function confirmXmlInvoiceFuel(
  invoiceId: string,
  payload: ConfirmFuelPayload,
) {
  try {
    const { data } = await api.post(`/xml-import/invoices/${invoiceId}/confirm/fuel`, payload);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      await processXmlInvoiceFuel(invoiceId);
      if (payload.vehicleId) {
        await completeXmlFuelLink(invoiceId, {
          vehicleId: payload.vehicleId,
          ...(payload.driverId ? { driverId: payload.driverId } : {}),
          ...(typeof payload.km === "number" ? { km: payload.km } : {}),
          ...(payload.branchId ? { branchId: payload.branchId } : {}),
        });
      }
      return { invoiceId, processingStatus: "PROCESSED" };
    }
    throw error;
  }
}

export async function confirmXmlInvoiceMaintenance(
  invoiceId: string,
  payload: ConfirmMaintenancePayload,
) {
  try {
    const { data } = await api.post(
      `/xml-import/invoices/${invoiceId}/confirm/maintenance`,
      payload,
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      await processXmlInvoiceMaintenance(invoiceId);
      if (payload.vehicleId) {
        await completeXmlMaintenanceLink(invoiceId, {
          vehicleId: payload.vehicleId,
          ...(payload.branchId ? { branchId: payload.branchId } : {}),
          ...(payload.descriptionComplement
            ? { descriptionComplement: payload.descriptionComplement }
            : {}),
        });
      }
      return { invoiceId, processingStatus: "PROCESSED" };
    }
    throw error;
  }
}

export async function confirmXmlInvoiceCost(
  invoiceId: string,
  payload: ConfirmCostPayload,
) {
  try {
    const { data } = await api.post(`/xml-import/invoices/${invoiceId}/confirm/cost`, payload);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      await processXmlInvoiceCost(invoiceId);
      if (payload.vehicleId || payload.branchId || payload.category) {
        await completeXmlCostLink(invoiceId, {
          ...(payload.vehicleId ? { vehicleId: payload.vehicleId } : {}),
          ...(payload.branchId ? { branchId: payload.branchId } : {}),
          ...(payload.category ? { category: payload.category } : {}),
        });
      }
      return { invoiceId, processingStatus: "PROCESSED" };
    }
    throw error;
  }
}

export async function confirmXmlInvoiceRetailProduct(
  invoiceId: string,
  payload: ConfirmRetailProductPayload,
) {
  try {
    const { data } = await api.post(
      `/xml-import/invoices/${invoiceId}/confirm/retail-product`,
      payload,
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      await processXmlInvoiceRetailProduct(invoiceId);
      return { invoiceId, processingStatus: "PROCESSED" };
    }
    throw error;
  }
}

export async function rejectXmlInvoice(invoiceId: string) {
  try {
    const { data } = await api.post(`/xml-import/invoices/${invoiceId}/reject`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return ignoreXmlInvoice(invoiceId);
    }
    throw error;
  }
}

export async function processXmlInvoiceMaintenance(invoiceId: string) {
  const { data } = await api.post<XmlInvoiceProcessResult>(
    `/xml-import/invoices/${invoiceId}/process/maintenance`,
  );
  return data;
}

export async function processXmlInvoiceCost(invoiceId: string) {
  const { data } = await api.post<XmlInvoiceProcessResult>(
    `/xml-import/invoices/${invoiceId}/process/cost`,
  );
  return data;
}

export async function processXmlInvoiceRetailProduct(invoiceId: string) {
  const { data } = await api.post<XmlInvoiceProcessResult>(
    `/xml-import/invoices/${invoiceId}/process/retail-product`,
  );
  return data;
}

export async function ignoreXmlInvoice(invoiceId: string) {
  const { data } = await api.post<XmlInvoiceIgnoreResult>(
    `/xml-import/invoices/${invoiceId}/ignore`,
  );
  return data;
}

export async function deleteXmlImportInvoices(invoiceIds: string[]) {
  const { data } = await api.delete<DeleteXmlInvoicesResult>("/xml-import/invoices", {
    data: { invoiceIds },
  });
  return data;
}

export async function deleteXmlImportBatch(batchId: string) {
  const { data } = await api.delete<DeleteXmlBatchResult>(`/xml-import/batches/${batchId}`);
  return data;
}

export async function getXmlImportInvoiceById(invoiceId: string, includeRawXml = false) {
  const { data } = await api.get<XmlInvoiceDetail>(`/xml-import/invoices/${invoiceId}`, {
    params: includeRawXml ? { includeRawXml: "true" } : undefined,
  });
  return data;
}

export type RetailProductImportListItem = {
  id: string;
  supplierName?: string | null;
  supplierDocument?: string | null;
  invoiceNumber?: string | null;
  invoiceSeries?: string | null;
  issuedAt?: string | null;
  totalAmount?: string | number | null;
  createdAt: string;
  updatedAt?: string;
  branch?: {
    id: string;
    name: string;
  } | null;
  xmlInvoice: {
    id: string;
    invoiceKey: string;
    number?: string | null;
    series?: string | null;
    issuedAt?: string | null;
    invoiceStatus: string;
    processingType?: string | null;
    processingStatus?: string | null;
  };
  _count?: {
    items?: number;
  };
};

export type RetailProductImportItem = {
  id: string;
  productCode?: string | null;
  description: string;
  quantity?: string | number | null;
  unitValue?: string | number | null;
  totalValue?: string | number | null;
  createdAt: string;
};

export type RetailProductImportDetail = RetailProductImportListItem & {
  items: RetailProductImportItem[];
  xmlInvoice: RetailProductImportListItem["xmlInvoice"] & {
    issuerName?: string | null;
    issuerDocument?: string | null;
    recipientName?: string | null;
    recipientDocument?: string | null;
    processedAt?: string | null;
    protocolNumber?: string | null;
    totalAmount?: string | number | null;
    folderName?: string | null;
    fileName?: string | null;
  };
};

export type ListRetailProductImportsFilters = {
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  invoiceNumber?: string;
  itemDescription?: string;
};

export async function getRetailProductImports(
  filters: ListRetailProductImportsFilters = {},
) {
  const { data } = await api.get<RetailProductImportListItem[]>(
    "/xml-import/retail-products",
    {
      params: {
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.supplier ? { supplier: filters.supplier } : {}),
        ...(filters.invoiceNumber
          ? { invoiceNumber: filters.invoiceNumber }
          : {}),
        ...(filters.itemDescription
          ? { itemDescription: filters.itemDescription }
          : {}),
      },
    },
  );
  return Array.isArray(data) ? data : [];
}

export async function getRetailProductImportById(id: string) {
  const { data } = await api.get<RetailProductImportDetail>(
    `/xml-import/retail-products/${id}`,
  );
  return data;
}

export type CompleteFuelLinkInput = {
  vehicleId: string;
  driverId?: string;
  km?: number;
  branchId?: string;
};

export type CompleteMaintenanceLinkInput = {
  vehicleId: string;
  branchId?: string;
  descriptionComplement?: string;
};

export type CompleteCostLinkInput = {
  vehicleId?: string;
  branchId?: string;
  category?: string;
};

export async function completeXmlFuelLink(invoiceId: string, payload: CompleteFuelLinkInput) {
  try {
    const { data } = await api.patch(`/xml-import/invoices/${invoiceId}/link/fuel`, payload);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const { data } = await api.patch(
        `/fuel-records/imported-xml/${invoiceId}/link/fuel`,
        payload,
      );
      return data;
    }
    throw error;
  }
}

export async function completeXmlMaintenanceLink(
  invoiceId: string,
  payload: CompleteMaintenanceLinkInput,
) {
  const { data } = await api.patch(
    `/xml-import/invoices/${invoiceId}/link/maintenance`,
    payload,
  );
  return data;
}

export async function completeXmlCostLink(invoiceId: string, payload: CompleteCostLinkInput) {
  const { data } = await api.patch(`/xml-import/invoices/${invoiceId}/link/cost`, payload);
  return data;
}
