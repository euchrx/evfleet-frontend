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

export async function getRetailProducts(
  filters: RetailProductFilters = {},
) {
  const response = await api.get<RetailProductItem[]>("/retail-products", {
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
