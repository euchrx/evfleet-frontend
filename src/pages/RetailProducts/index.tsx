import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { ProductXmlImportButton } from "../../components/ProductXmlImportButton";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import {
  deleteRetailProducts,
  getRetailProducts,
  type RetailProductCategory,
  type RetailProductFilters,
  type RetailProductItem,
} from "../../services/retailProducts";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";

const PAGE_SIZE = 10;

const categoryOptions: Array<{ value: RetailProductCategory; label: string }> = [
  { value: "PERFUMARIA", label: "Perfumaria" },
  { value: "COSMETICOS", label: "CosmÃ©ticos" },
  { value: "LUBRIFICANTES", label: "Lubrificantes" },
  { value: "CONVENIENCIA", label: "ConveniÃªncia" },
  { value: "LIMPEZA", label: "Limpeza" },
  { value: "OUTROS", label: "Outros" },
];

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

function formatQuantity(value: string | number | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function categoryLabel(category: RetailProductCategory) {
  return categoryOptions.find((item) => item.value === category)?.label || "Outros";
}

export function RetailProductsPage() {
  const { selectedCompanyId } = useCompanyScope();
  const [items, setItems] = useState<RetailProductItem[]>([]);
  const [lastSuccessfulItems, setLastSuccessfulItems] = useState<RetailProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<RetailProductFilters>({
    dateFrom: "",
    dateTo: "",
    category: "",
  });
  const [search, setSearch] = useState("");

  async function loadData(nextFilters = filters, manualRefresh = false) {
    try {
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");
      const data = await getRetailProducts(nextFilters);
      setItems(data);
      setLastSuccessfulItems(data);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setErrorMessage("NÃ£o foi possÃ­vel carregar os produtos importados.");
      setItems(lastSuccessfulItems);
    } finally {
      if (manualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  function handleFilterChange<K extends keyof RetailProductFilters>(
    key: K,
    value: RetailProductFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSearch() {
    setCurrentPage(1);
    await loadData(filters, true);
  }

  async function handleClear() {
    const emptyFilters: RetailProductFilters = {
      dateFrom: "",
      dateTo: "",
      category: "",
    };
    setFilters(emptyFilters);
    setSearch("");
    setCurrentPage(1);
    await loadData(emptyFilters, true);
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

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      const haystack = [
        item.description,
        item.productCode || "",
        item.retailProductImport.supplierName || "",
        item.retailProductImport.invoiceNumber || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [items, search]);

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
  }, [selectedCompanyId, filters.dateFrom, filters.dateTo, filters.category, search]);

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
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
      await loadData(filters, true);
    } catch (error) {
      console.error("Erro ao excluir produtos em lote:", error);
      setErrorMessage("NÃ£o foi possÃ­vel excluir os produtos selecionados.");
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
            Controle de itens comprados para o veÃ­culo, organizados por categoria e nota fiscal.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ProductXmlImportButton onImported={() => loadData(filters, true)} />
          <button
            type="button"
            onClick={() => loadData(filters, true)}
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Itens</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalItems}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Valor total</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {formatMoney(summary.totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Quantidade</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {formatQuantity(summary.totalQuantity)}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(event) => handleFilterChange("dateFrom", event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(event) => handleFilterChange("dateTo", event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto, fornecedor ou NF-e"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <select
              value={filters.category || ""}
              onChange={(event) =>
                handleFilterChange(
                  "category",
                  (event.target.value || "") as RetailProductFilters["category"],
                )
              }
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Todas as categorias</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {selectedItemIds.length > 0
                ? `${selectedItemIds.length} item(ns) selecionado(s)`
                : "Selecione registros para excluir em lote"}
            </p>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedItemIds.length === 0}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Excluir selecionados
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allItemsOnPageSelected}
                    onChange={toggleSelectAllPage}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                    aria-label="Selecionar itens da pÃ¡gina"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Produto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Veículo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Categoria
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Qtd
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  NF-e
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar produto ${item.description}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        CÃ³digo: {item.productCode || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.vehicle ? (
                        <span>{formatVehicleLabel(item.retailProductImport.vehicle)}</span>
                      ) : item.retailProductImport.sourcePlate ? (
                        <span>{item.retailProductImport.sourcePlate}</span>
                      ) : (
                        <span className="text-slate-500">Sem veículo detectado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatQuantity(item.quantity)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatMoney(item.unitValue)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatMoney(item.totalValue)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.invoiceNumber || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDate(item.retailProductImport.issuedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={PAGE_SIZE}
            itemLabel="produtos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

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
