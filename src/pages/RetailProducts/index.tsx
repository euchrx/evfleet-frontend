import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { ProductXmlImportButton } from "../../components/ProductXmlImportButton";
import {
  deleteRetailProducts,
  getRetailProducts,
  type RetailProductCategory,
  type RetailProductFilters,
  type RetailProductItem,
} from "../../services/retailProducts";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import {
  ProductsTablesSection,
  type ProductPageFilters,
  type SelectOption,
} from "./ProductsTablesSection";

const PAGE_SIZE = 10;

const categoryOptions: Array<{ value: RetailProductCategory; label: string }> = [
  { value: "PERFUMARIA", label: "Perfumaria" },
  { value: "COSMETICOS", label: "Cosméticos" },
  { value: "LUBRIFICANTES", label: "Lubrificantes" },
  { value: "CONVENIENCIA", label: "Conveniência" },
  { value: "LIMPEZA", label: "Limpeza" },
  { value: "OUTROS", label: "Outros" },
];

const initialPageFilters: ProductPageFilters = {
  dateFrom: "",
  dateTo: "",
  category: "",
  description: "",
  productCode: "",
  supplierName: "",
  invoiceNumber: "",
};

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesInCsv(csv: string, value: string | null | undefined) {
  const values = splitCsv(csv);
  if (values.length === 0) return true;
  return values.includes(String(value || ""));
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.includes(",")
      ? value.replaceAll(".", "").replace(",", ".")
      : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: string | number | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function uniqueOptions(values: Array<string | null | undefined>): SelectOption[] {
  const map = new Map<string, string>();

  values.forEach((value) => {
    const label = String(value || "").trim();
    if (!label) return;
    if (!map.has(label)) map.set(label, label);
  });

  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
}

export function RetailProductsPage() {
  const { selectedCompanyId, currentCompany } = useCompanyScope();

  const [items, setItems] = useState<RetailProductItem[]>([]);
  const [lastSuccessfulItems, setLastSuccessfulItems] = useState<RetailProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [serviceFilters, setServiceFilters] = useState<RetailProductFilters>({
    dateFrom: "",
    dateTo: "",
    category: "",
  });

  const [draftFilters, setDraftFilters] =
    useState<ProductPageFilters>(initialPageFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<ProductPageFilters>(initialPageFilters);

  async function loadData(nextFilters = serviceFilters, manualRefresh = false) {
    try {
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage("");
      const data = await getRetailProducts(nextFilters);
      setItems(data);
      setLastSuccessfulItems(data);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setErrorMessage("Não foi possível carregar os produtos importados.");
      setItems(lastSuccessfulItems);
    } finally {
      if (manualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  function handleDraftFilterChange<K extends keyof ProductPageFilters>(
    key: K,
    value: ProductPageFilters[K],
  ) {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSearch() {
    const selectedCategories = splitCsv(draftFilters.category);
    const nextServiceFilters: RetailProductFilters = {
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      category:
        selectedCategories.length === 1
          ? (selectedCategories[0] as RetailProductFilters["category"])
          : "",
    };

    setServiceFilters(nextServiceFilters);
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
    setSelectedItemIds([]);
    await loadData(nextServiceFilters, true);
  }

  async function handleClear() {
    const emptyServiceFilters: RetailProductFilters = {
      dateFrom: "",
      dateTo: "",
      category: "",
    };

    setDraftFilters(initialPageFilters);
    setAppliedFilters(initialPageFilters);
    setServiceFilters(emptyServiceFilters);
    setCurrentPage(1);
    setSelectedItemIds([]);
    await loadData(emptyServiceFilters, true);
  }

  const summary = useMemo(() => {
    const totalValue = items.reduce((acc, item) => acc + toNumber(item.totalValue), 0);
    const totalQuantity = items.reduce((acc, item) => acc + toNumber(item.quantity), 0);

    return {
      totalItems: items.length,
      totalValue,
      totalQuantity,
    };
  }, [items]);

  const productOptions = useMemo(
    () => uniqueOptions(items.map((item) => item.description)),
    [items],
  );

  const productCodeOptions = useMemo(
    () => uniqueOptions(items.map((item) => item.productCode)),
    [items],
  );

  const supplierOptions = useMemo(
    () => uniqueOptions(items.map((item) => item.retailProductImport.supplierName)),
    [items],
  );

  const invoiceOptions = useMemo(
    () => uniqueOptions(items.map((item) => item.retailProductImport.invoiceNumber)),
    [items],
  );

  const categorySelectOptions: SelectOption[] = useMemo(
    () =>
      categoryOptions.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const description = normalizeText(item.description);
      const productCode = normalizeText(item.productCode);
      const supplierName = normalizeText(item.retailProductImport.supplierName);
      const invoiceNumber = normalizeText(item.retailProductImport.invoiceNumber);

      const selectedDescriptions = splitCsv(appliedFilters.description).map(normalizeText);
      const selectedProductCodes = splitCsv(appliedFilters.productCode).map(normalizeText);
      const selectedSuppliers = splitCsv(appliedFilters.supplierName).map(normalizeText);
      const selectedInvoices = splitCsv(appliedFilters.invoiceNumber).map(normalizeText);

      if (
        selectedDescriptions.length > 0 &&
        !selectedDescriptions.includes(description)
      ) {
        return false;
      }

      if (
        selectedProductCodes.length > 0 &&
        !selectedProductCodes.includes(productCode)
      ) {
        return false;
      }

      if (selectedSuppliers.length > 0 && !selectedSuppliers.includes(supplierName)) {
        return false;
      }

      if (selectedInvoices.length > 0 && !selectedInvoices.includes(invoiceNumber)) {
        return false;
      }

      if (!includesInCsv(appliedFilters.category, item.category)) {
        return false;
      }

      return true;
    });
  }, [items, appliedFilters]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)),
    [filteredItems.length],
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItemIds([]);
  }, [
    selectedCompanyId,
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.category,
    appliedFilters.description,
    appliedFilters.productCode,
    appliedFilters.supplierName,
    appliedFilters.invoiceNumber,
  ]);

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }

  function toggleSelectAllPage() {
    const pageIds = paginatedItems.map((item) => item.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedItemIds.includes(id));

    setSelectedItemIds((prev) => {
      if (allSelected) return prev.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...prev, ...pageIds]));
    });
  }

  const allItemsOnPageSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedItemIds.includes(item.id));

  async function confirmBulkDelete() {
    if (selectedItemIds.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }

    try {
      setDeleting(true);
      setErrorMessage("");
      await deleteRetailProducts(selectedItemIds);
      setSelectedItemIds([]);
      setBulkDeleteOpen(false);
      await loadData(serviceFilters, true);
    } catch (error) {
      console.error("Erro ao excluir produtos em lote:", error);
      setErrorMessage("Não foi possível excluir os produtos selecionados.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">
            Controle de itens comprados para o veículo, organizados por categoria e nota fiscal.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <ProductXmlImportButton onImported={() => loadData(serviceFilters, true)} />

          <button
            type="button"
            onClick={() => loadData(serviceFilters, true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Atualizar dados
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Itens
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {summary.totalItems}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Valor total
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {formatMoney(summary.totalValue)}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <ProductsTablesSection
        currentCompanyName={currentCompany?.name}
        loading={loading}
        refreshing={refreshing}
        draftFilters={draftFilters}
        filteredItems={filteredItems}
        paginatedItems={paginatedItems}
        selectedItemIds={selectedItemIds}
        allItemsOnPageSelected={allItemsOnPageSelected}
        productOptions={productOptions}
        productCodeOptions={productCodeOptions}
        supplierOptions={supplierOptions}
        invoiceOptions={invoiceOptions}
        categoryOptions={categorySelectOptions}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onFilterChange={handleDraftFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
        onToggleItemSelection={toggleItemSelection}
        onToggleSelectAllPage={toggleSelectAllPage}
        onOpenBulkDelete={() => setBulkDeleteOpen(true)}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      />

      <ConfirmDeleteModal
        isOpen={bulkDeleteOpen}
        title="Excluir produtos selecionados"
        description={`Deseja excluir ${selectedItemIds.length} produto(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => {
          if (!deleting) setBulkDeleteOpen(false);
        }}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}