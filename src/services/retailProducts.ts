import { api } from "./api";

export type RetailProductCategory =
  | "PERFUMARIA"
  | "COSMETICOS"
  | "LUBRIFICANTES"
  | "CONVENIENCIA"
  | "LIMPEZA"
  | "OUTROS";

export type RetailProductItem = {
  id: string;
  productCode?: string | null;
  description: string;
  quantity?: string | number | null;
  unitValue?: string | number | null;
  totalValue?: string | number | null;
  createdAt: string;
  category: RetailProductCategory;
  retailProductImport: {
    id: string;
    supplierName?: string | null;
    supplierDocument?: string | null;
    invoiceNumber?: string | null;
    invoiceSeries?: string | null;
    issuedAt?: string | null;
    totalAmount?: string | number | null;
    branch?: {
      id: string;
      name: string;
    } | null;
    xmlInvoice: {
      id: string;
      invoiceKey: string;
      processingStatus?: string | null;
    };
  };
};

export type RetailProductFilters = {
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  invoiceNumber?: string;
  itemDescription?: string;
  category?: "" | RetailProductCategory;
};

export type ProductXmlPreviewItem = {
  lineIndex: number;
  productCode?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  detectedType: "PRODUCT";
  importable: boolean;
  duplicate: boolean;
  duplicateReason?: string | null;
  category: RetailProductCategory;
};

export type ProductXmlPreviewInvoice = {
  fileName: string;
  invoiceKey: string;
  invoiceNumber?: string;
  issuedAt?: string;
  supplierName?: string;
  supplierDocument?: string;
  items: ProductXmlPreviewItem[];
};

export type ProductXmlPreviewResponse = {
  summary: {
    totalInvoices: number;
    totalItems: number;
    importableItems: number;
    duplicateItems: number;
    ignoredFuelItems: number;
  };
  invoices: ProductXmlPreviewInvoice[];
};

export type ProductXmlConfirmItem = ProductXmlPreviewItem & {
  selected: boolean;
};

export type ProductXmlConfirmInvoice = Omit<ProductXmlPreviewInvoice, "items"> & {
  items: ProductXmlConfirmItem[];
};

export type ProductXmlConfirmResponse = {
  totalInvoicesRead: number;
  totalItemsDetected: number;
  totalImported: number;
  totalIgnored: number;
  totalDuplicated: number;
};

export async function getRetailProducts(
  filters: RetailProductFilters = {},
) {
  const response = await api.get<RetailProductItem[]>("/products", {
    params: {
      ...(filters.dateFrom?.trim() ? { dateFrom: filters.dateFrom.trim() } : {}),
      ...(filters.dateTo?.trim() ? { dateTo: filters.dateTo.trim() } : {}),
      ...(filters.supplier?.trim() ? { supplier: filters.supplier.trim() } : {}),
      ...(filters.invoiceNumber?.trim()
        ? { invoiceNumber: filters.invoiceNumber.trim() }
        : {}),
      ...(filters.itemDescription?.trim()
        ? { itemDescription: filters.itemDescription.trim() }
        : {}),
      ...(filters.category?.trim() ? { category: filters.category.trim() } : {}),
    },
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function previewProductXml(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await api.post<ProductXmlPreviewResponse>(
    "/products/xml/preview",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

export async function confirmProductXmlImports(
  invoices: ProductXmlConfirmInvoice[],
) {
  const response = await api.post<ProductXmlConfirmResponse>(
    "/products/xml/confirm",
    { invoices },
  );

  return response.data;
}
