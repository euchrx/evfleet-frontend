import { useEffect, useMemo, useState } from "react";
import { FileArchive, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { TablePagination } from "../../components/TablePagination";
import {
  deleteXmlImportBatch,
  deleteXmlImportInvoices,
  getXmlImportBatches,
  getXmlImportInvoices,
  ignoreXmlInvoice,
  type XmlImportBatch,
  type XmlInvoice,
} from "../../services/xmlImport";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 10;

function formatInvoiceStatus(status?: string) {
  if (status === "AUTHORIZED") return "Autorizada";
  if (status === "CANCELED") return "Cancelada";
  if (status === "DENIED") return "Denegada";
  return "Desconhecida";
}

function formatProcessingType(type?: string | null) {
  if (type === "FUEL") return "Combustível";
  if (type === "PRODUCT") return "Peças / Insumos";
  if (type === "SERVICE") return "Serviços";
  if (type === "RETAIL_PRODUCT") return "Produtos / Conveniência";
  return "Não classificada";
}

function formatProcessingStatus(status?: string | null) {
  if (status === "PENDING") return "Pendente";
  if (status === "SUGGESTED") return "Sugerida";
  if (status === "PROCESSED") return "Processada";
  if (status === "IGNORED") return "Ignorada";
  if (status === "ERROR") return "Erro";
  return "Não definido";
}

function formatCompetencia(invoice: XmlInvoice) {
  const folder = String(invoice.folderName || "").trim();
  const fromFolder = folder.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  if (fromFolder) return `${fromFolder[1]}/${fromFolder[2]}`;
  if (!invoice.issuedAt) return "-";
  const date = new Date(invoice.issuedAt);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}/${m}`;
}

function formatAmountReais(value: XmlInvoice["totalAmount"]) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function XmlImportPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [batches, setBatches] = useState<XmlImportBatch[]>([]);
  const [invoices, setInvoices] = useState<XmlInvoice[]>([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [invoiceKeyFilter, setInvoiceKeyFilter] = useState("");
  const [emitenteFilter, setEmitenteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [processingTypeFilter, setProcessingTypeFilter] = useState("ALL");
  const [processingStatusFilter, setProcessingStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [rowLoading, setRowLoading] = useState<Record<string, string>>({});
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  async function loadData(manual = false) {
    try {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");
      const [nextBatches, nextInvoices] = await Promise.all([
        getXmlImportBatches(),
        getXmlImportInvoices(),
      ]);
      setBatches(nextBatches);
      setInvoices(nextInvoices);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados da central XML.",
      );
    } finally {
      if (manual) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const batchId = String(invoice.batchId || "").toLowerCase();
      const invoiceKey = String(invoice.invoiceKey || "").toLowerCase();
      const emitente = String(invoice.issuerName || "").toLowerCase();
      const status = String(invoice.invoiceStatus || "");
      const type = String(invoice.processingType || "UNKNOWN");
      const procStatus = String(invoice.processingStatus || "PENDING");
      const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null;

      if (batchFilter.trim() && !batchId.includes(batchFilter.trim().toLowerCase())) return false;
      if (invoiceKeyFilter.trim() && !invoiceKey.includes(invoiceKeyFilter.trim().toLowerCase()))
        return false;
      if (emitenteFilter.trim() && !emitente.includes(emitenteFilter.trim().toLowerCase()))
        return false;
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (processingTypeFilter !== "ALL" && type !== processingTypeFilter) return false;
      if (processingStatusFilter !== "ALL" && procStatus !== processingStatusFilter)
        return false;
      if (dateFrom) {
        if (!issuedAt) return false;
        if (issuedAt < new Date(`${dateFrom}T00:00:00`)) return false;
      }
      if (dateTo) {
        if (!issuedAt) return false;
        if (issuedAt > new Date(`${dateTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [
    invoices,
    batchFilter,
    invoiceKeyFilter,
    emitenteFilter,
    statusFilter,
    processingTypeFilter,
    processingStatusFilter,
    dateFrom,
    dateTo,
  ]);

  const summaryByType = useMemo(
    () =>
      filteredInvoices.reduce(
        (acc, invoice) => {
          const key = String(invoice.processingType || "UNKNOWN");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [filteredInvoices],
  );

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const allPageIds = paginatedInvoices.map((invoice) => invoice.id);
  const allSelectedInPage =
    allPageIds.length > 0 && allPageIds.every((id) => selectedInvoiceIds.includes(id));

  useEffect(() => setCurrentPage(1), [
    batchFilter,
    invoiceKeyFilter,
    emitenteFilter,
    statusFilter,
    processingTypeFilter,
    processingStatusFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    setSelectedInvoiceIds((prev) =>
      prev.filter((id) => invoices.some((invoice) => invoice.id === id)),
    );
  }, [invoices]);

  async function ignoreInvoice(invoice: XmlInvoice) {
    if (!window.confirm("Deseja ignorar esta nota?")) return;
    try {
      setRowLoading((prev) => ({ ...prev, [invoice.id]: "ignore" }));
      await ignoreXmlInvoice(invoice.id);
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === invoice.id
            ? { ...item, processingStatus: "IGNORED", processedAt: new Date().toISOString() }
            : item,
        ),
      );
      setSuccessMessage("Nota ignorada com sucesso.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao ignorar nota.");
    } finally {
      setRowLoading((prev) => {
        const next = { ...prev };
        delete next[invoice.id];
        return next;
      });
    }
  }

  async function handleDeleteSelected() {
    if (selectedInvoiceIds.length === 0) {
      setErrorMessage("Selecione ao menos uma nota para excluir.");
      return;
    }
    if (!window.confirm(`Deseja excluir ${selectedInvoiceIds.length} nota(s)?`)) return;
    try {
      setDeletingSelected(true);
      const result = await deleteXmlImportInvoices(selectedInvoiceIds);
      setInvoices((prev) => prev.filter((i) => !selectedInvoiceIds.includes(i.id)));
      setSelectedInvoiceIds([]);
      setSuccessMessage(`Removidas ${result.deleted} nota(s).`);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao excluir notas.");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleDeleteBatch(batchId: string) {
    const confirmed = window.confirm(
      "Deseja excluir este lote importado? As notas deste lote também serão removidas.",
    );
    if (!confirmed) return;

    try {
      setDeletingBatchId(batchId);
      setErrorMessage("");
      setSuccessMessage("");

      const result = await deleteXmlImportBatch(batchId);
      const removedInvoiceIds = new Set(
        invoices
          .filter((invoice) => invoice.batchId === batchId)
          .map((invoice) => invoice.id),
      );

      setBatches((prev) => prev.filter((batch) => batch.id !== batchId));
      setInvoices((prev) => prev.filter((invoice) => invoice.batchId !== batchId));
      setSelectedInvoiceIds((prev) => prev.filter((id) => !removedInvoiceIds.has(id)));

      setSuccessMessage(
        `Lote removido com sucesso. Notas removidas: ${result.deletedInvoices}. Produtos vinculados removidos: ${result.deletedRetailProductImports}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível remover o lote.",
      );
    } finally {
      setDeletingBatchId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Central XML (auditoria)</h1>
          <p className="text-sm text-slate-500">
            Consulta global para auditoria, suporte e rastreabilidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/xml-import/retail-products"
            className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            Importação XML de produtos
          </Link>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
          <p>
            Use as importações setorizadas em <strong>Abastecimentos</strong>,{" "}
            <strong>Manutenções</strong> e <strong>Produtos</strong>. Esta tela é de
            auditoria/backoffice.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {["FUEL", "PRODUCT", "SERVICE", "RETAIL_PRODUCT", "UNKNOWN"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setProcessingTypeFilter(type)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-orange-300 hover:bg-orange-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatProcessingType(type)}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{summaryByType[type] || 0}</p>
          </button>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Filtros</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} placeholder="Batch ID" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <input value={invoiceKeyFilter} onChange={(e) => setInvoiceKeyFilter(e.target.value)} placeholder="Chave NF-e" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <input value={emitenteFilter} onChange={(e) => setEmitenteFilter(e.target.value)} placeholder="Emitente" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Status da nota</option>
            <option value="AUTHORIZED">Autorizada</option>
            <option value="CANCELED">Cancelada</option>
            <option value="DENIED">Denegada</option>
          </select>
          <select value={processingTypeFilter} onChange={(e) => setProcessingTypeFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Tipo</option>
            <option value="FUEL">Combustível</option>
            <option value="PRODUCT">Peças / Insumos</option>
            <option value="SERVICE">Serviços</option>
            <option value="RETAIL_PRODUCT">Produtos / Conveniência</option>
            <option value="UNKNOWN">Não classificada</option>
          </select>
          <select value={processingStatusFilter} onChange={(e) => setProcessingStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Situação</option>
            <option value="PENDING">Pendente</option>
            <option value="SUGGESTED">Sugerida</option>
            <option value="PROCESSED">Processada</option>
            <option value="IGNORED">Ignorada</option>
            <option value="ERROR">Erro</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <FileArchive size={18} className="text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Lotes importados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Batch ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Arquivo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Importados</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Duplicados</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Erros</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Criado em</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Carregando lotes...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum lote importado.</td></tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-xs text-slate-600">{batch.id}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.fileName}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.status}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.importedFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.duplicateFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.errorFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(batch.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(batch.id)}
                        disabled={deletingBatchId === batch.id}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingBatchId === batch.id ? "Excluindo..." : "Excluir lote"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deletingSelected || selectedInvoiceIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deletingSelected ? "Excluindo..." : `Excluir selecionadas (${selectedInvoiceIds.length})`}
            </button>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Notas importadas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Auditoria global por lote, chave e status de processamento.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1380px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left font-semibold text-slate-700">
                  <input type="checkbox" checked={allSelectedInPage} onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, ...allPageIds])));
                    } else {
                      setSelectedInvoiceIds((prev) => prev.filter((id) => !allPageIds.includes(id)));
                    }
                  }} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-orange-500" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Batch ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Competência</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Emitente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Número</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Situação</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Chave</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">Carregando notas...</td></tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">Nenhuma nota encontrada.</td></tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(invoice.id)}
                        onChange={(e) =>
                          setSelectedInvoiceIds((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, invoice.id]))
                              : prev.filter((id) => id !== invoice.id),
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-orange-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{invoice.batchId}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCompetencia(invoice)}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.issuerName || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.number || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(invoice.issuedAt || undefined)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatInvoiceStatus(invoice.invoiceStatus)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatProcessingType(invoice.processingType)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatProcessingStatus(invoice.processingStatus)}</td>
                    <td className="px-4 py-3 text-slate-900">{formatAmountReais(invoice.totalAmount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{invoice.invoiceKey}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/xml-import/invoices/${invoice.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Ver detalhes
                        </Link>
                        {invoice.processingStatus === "SUGGESTED" ? (
                          <button
                            type="button"
                            onClick={() => ignoreInvoice(invoice)}
                            disabled={Boolean(rowLoading[invoice.id])}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                          >
                            {rowLoading[invoice.id] === "ignore" ? "Ignorando..." : "Ignorar"}
                          </button>
                        ) : null}
                      </div>
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
          totalItems={filteredInvoices.length}
          pageSize={PAGE_SIZE}
          onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          itemLabel="notas"
        />
      </section>
    </div>
  );
}
