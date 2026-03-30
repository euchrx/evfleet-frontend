import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileArchive, PackageSearch, RefreshCw } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import {
  getRetailProductImports,
  type ListRetailProductImportsFilters,
  type RetailProductImportListItem,
} from "../../services/xmlImport";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;

function formatAmountReais(value: string | number | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function processingStatusLabel(value?: string | null) {
  if (value === "PROCESSED") return "Processada";
  if (value === "SUGGESTED") return "Sugerida";
  if (value === "IGNORED") return "Ignorada";
  if (value === "ERROR") return "Erro";
  if (value === "PENDING") return "Pendente";
  return "Não definido";
}

function processingStatusClass(value?: string | null) {
  if (value === "PROCESSED") return "status-pill status-active";
  if (value === "SUGGESTED") return "status-pill status-pending";
  if (value === "IGNORED") return "status-pill";
  if (value === "ERROR") return "status-pill status-inactive";
  return "status-pill status-pending";
}

export function XmlRetailProductsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [items, setItems] = useState<RetailProductImportListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<ListRetailProductImportsFilters>({
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
      const data = await getRetailProductImports(nextFilters);
      setItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os produtos importados.",
      );
    } finally {
      if (manualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleFilterChange<K extends keyof ListRetailProductImportsFilters>(
    key: K,
    value: ListRetailProductImportsFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSearch() {
    setCurrentPage(1);
    await loadData(filters, true);
  }

  async function handleClear() {
    const empty = {
      dateFrom: "",
      dateTo: "",
      supplier: "",
      invoiceNumber: "",
      itemDescription: "",
    };
    setFilters(empty);
    setCurrentPage(1);
    await loadData(empty, true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Importação XML de produtos</h1>
          <p className="text-sm text-slate-500">
            Produtos &gt; Importação XML. Acompanhe notas classificadas como loja/perfumaria/conveniência.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/xml-import"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para Central XML (auditoria)
          </Link>
          <button
            type="button"
            onClick={() => loadData(filters, true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
            onChange={(event) =>
              handleFilterChange("itemDescription", event.target.value)
            }
            placeholder="Descrição do item"
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
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <PackageSearch size={18} className="text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Importações processadas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1220px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fornecedor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Número/Série</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor total</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Itens</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Origem</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Situação</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Carregando importações...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma importação encontrada.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {item.supplierName || "-"}
                      </p>
                      <p className="text-xs text-slate-500">{item.supplierDocument || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.invoiceNumber || "-"} / {item.invoiceSeries || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(item.issuedAt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatAmountReais(item.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item._count?.items || 0}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="status-pill status-active">XML</span>
                        <span className="text-xs text-slate-500">
                          {item.xmlInvoice.invoiceKey}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={processingStatusClass(item.xmlInvoice.processingStatus)}>
                        {processingStatusLabel(item.xmlInvoice.processingStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Link
                        to={`/xml-import/retail-products/${item.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={items.length}
          pageSize={PAGE_SIZE}
          onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          itemLabel="importações"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <FileArchive size={16} />
          <span>
            Importar XML de produtos é um fluxo contextual: notas de loja/perfumaria/conveniência
            ficam separadas do processamento operacional de frota.
          </span>
        </div>
      </section>
    </div>
  );
}
