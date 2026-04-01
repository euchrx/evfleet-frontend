import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import {
  getRetailProducts,
  type RetailProductFilters,
  type RetailProductItem,
} from "../../services/retailProducts";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";

const PAGE_SIZE = 10;

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

export function RetailProductsPage() {
  const { selectedCompanyId } = useCompanyScope();
  const [items, setItems] = useState<RetailProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<RetailProductFilters>({
    dateFrom: "",
    dateTo: "",
    supplier: "",
    invoiceNumber: "",
    itemDescription: "",
  });

  async function loadData(nextFilters = filters, manualRefresh = false) {
    try {
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");
      const data = await getRetailProducts(nextFilters);
      setItems(data);
    } catch (error) {
      console.error("Erro ao carregar itens de perfumaria:", error);
      setErrorMessage("Não foi possível carregar os itens de perfumaria.");
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
    const emptyFilters = {
      dateFrom: "",
      dateTo: "",
      supplier: "",
      invoiceNumber: "",
      itemDescription: "",
    };
    setFilters(emptyFilters);
    setCurrentPage(1);
    await loadData(emptyFilters, true);
  }

  const summary = useMemo(() => {
    const totalValue = items.reduce((acc, item) => acc + toNumber(item.totalValue), 0);
    const totalQuantity = items.reduce(
      (acc, item) => acc + toNumber(item.quantity),
      0,
    );
    const suppliers = new Set(
      items
        .map((item) => String(item.retailProductImport.supplierName || "").trim())
        .filter(Boolean),
    );
    const invoices = new Set(
      items
        .map((item) => String(item.retailProductImport.xmlInvoice.invoiceKey || "").trim())
        .filter(Boolean),
    );

    return {
      totalItems: items.length,
      totalValue,
      totalQuantity,
      suppliers: suppliers.size,
      invoices: invoices.size,
    };
  }, [items]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / PAGE_SIZE)),
    [items.length],
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [currentPage, items]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Perfumaria</h1>
          <p className="text-sm text-slate-500">
            Itens de perfumaria e cosméticos importados via XML para controle de gastos do veículo.
          </p>
        </div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Notas lidas</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.invoices}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              value={filters.supplier || ""}
              onChange={(event) => handleFilterChange("supplier", event.target.value)}
              placeholder="Fornecedor"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              value={filters.invoiceNumber || ""}
              onChange={(event) => handleFilterChange("invoiceNumber", event.target.value)}
              placeholder="Número da nota"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              value={filters.itemDescription || ""}
              onChange={(event) => handleFilterChange("itemDescription", event.target.value)}
              placeholder="Buscar item"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
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

        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          <Sparkles size={16} className="text-orange-600" />
          <span>Itens importados para acompanhamento de valores e consumo por nota fiscal.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Produto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Quantidade
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor unitário
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Fornecedor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  NF-e
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Filial
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando itens de perfumaria...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum item de perfumaria encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Código: {item.productCode || "-"}
                      </p>
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
                      <p className="font-medium text-slate-900">
                        {item.retailProductImport.supplierName || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.retailProductImport.supplierDocument || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.invoiceNumber || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.branch?.name || "Empresa"}
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
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            itemLabel="itens"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </section>
    </div>
  );
}
