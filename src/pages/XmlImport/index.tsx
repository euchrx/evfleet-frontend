import { useEffect, useMemo, useState } from "react";
import { FileArchive, RefreshCw, Upload } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import {
  getXmlImportBatches,
  getXmlImportInvoices,
  processXmlInvoiceCost,
  processXmlInvoiceFuel,
  processXmlInvoiceMaintenance,
  uploadXmlZip,
  type XmlImportBatch,
  type XmlImportBatchSummary,
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

function statusBadgeClass(status?: string) {
  if (status === "AUTHORIZED") return "status-pill status-active";
  if (status === "CANCELED") return "status-pill status-inactive";
  if (status === "DENIED") return "status-pill status-anomaly";
  return "status-pill status-pending";
}

function formatProcessingType(type?: string | null) {
  if (type === "FUEL") return "Combustível";
  if (type === "PRODUCT") return "Produto";
  if (type === "SERVICE") return "Serviço";
  return "Não classificada";
}

function processingTypeBadgeClass(type?: string | null) {
  if (type === "FUEL") return "status-pill status-active";
  if (type === "PRODUCT") return "status-pill status-pending";
  if (type === "SERVICE") return "status-pill status-anomaly";
  return "status-pill";
}

function formatProcessingStatus(status?: string | null) {
  if (status === "PENDING") return "Pendente";
  if (status === "SUGGESTED") return "Sugerida";
  if (status === "PROCESSED") return "Processada";
  if (status === "IGNORED") return "Ignorada";
  if (status === "ERROR") return "Erro";
  return "Não definido";
}

function processingStatusBadgeClass(status?: string | null) {
  if (status === "PROCESSED") return "status-pill status-active";
  if (status === "IGNORED") return "status-pill";
  if (status === "ERROR") return "status-pill status-inactive";
  if (status === "SUGGESTED") return "status-pill status-pending";
  return "status-pill status-pending";
}

function formatCompetencia(invoice: XmlInvoice) {
  const folder = String(invoice.folderName || "").trim();
  const fromFolder = folder.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  if (fromFolder) return `${fromFolder[1]}/${fromFolder[2]}`;

  if (invoice.issuedAt) {
    const date = new Date(invoice.issuedAt);
    if (!Number.isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      return `${y}/${m}`;
    }
  }

  return "-";
}

function formatAmountReais(value: XmlInvoice["totalAmount"]) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numeric)) return "-";

  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function XmlImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastSummary, setLastSummary] = useState<XmlImportBatchSummary | null>(null);
  const [batches, setBatches] = useState<XmlImportBatch[]>([]);
  const [invoices, setInvoices] = useState<XmlInvoice[]>([]);
  const [competenciaFilter, setCompetenciaFilter] = useState("");
  const [emitenteFilter, setEmitenteFilter] = useState("");
  const [numeroFilter, setNumeroFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [processingStatusFilter, setProcessingStatusFilter] = useState("ALL");
  const [processingTypeFilter, setProcessingTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowLoading, setRowLoading] = useState<Record<string, string>>({});
  const [ignoredInvoiceIds, setIgnoredInvoiceIds] = useState<string[]>([]);

  async function loadData(isManualRefresh = false) {
    try {
      if (isManualRefresh) setRefreshing(true);
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
          : "Não foi possível carregar os dados de importação XML.",
      );
    } finally {
      if (isManualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const competencia = formatCompetencia(invoice);
      const emitente = String(invoice.issuerName || "").toLowerCase();
      const numero = String(invoice.number || "");
      const status = String(invoice.invoiceStatus || "");
      const processingStatus = String(invoice.processingStatus || "PENDING");
      const processingType = String(invoice.processingType || "UNKNOWN");
      const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null;

      if (ignoredInvoiceIds.includes(invoice.id)) {
        return false;
      }

      if (competenciaFilter.trim() && !competencia.includes(competenciaFilter.trim())) {
        return false;
      }
      if (
        emitenteFilter.trim() &&
        !emitente.includes(emitenteFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (numeroFilter.trim() && !numero.includes(numeroFilter.trim())) {
        return false;
      }
      if (statusFilter !== "ALL" && status !== statusFilter) {
        return false;
      }
      if (processingStatusFilter !== "ALL" && processingStatus !== processingStatusFilter) {
        return false;
      }
      if (processingTypeFilter !== "ALL" && processingType !== processingTypeFilter) {
        return false;
      }
      if (dateFrom && issuedAt) {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        if (issuedAt < fromDate) return false;
      }
      if (dateFrom && !issuedAt) return false;
      if (dateTo && issuedAt) {
        const toDate = new Date(`${dateTo}T23:59:59`);
        if (issuedAt > toDate) return false;
      }
      if (dateTo && !issuedAt) return false;
      return true;
    });
  }, [
    invoices,
    ignoredInvoiceIds,
    competenciaFilter,
    emitenteFilter,
    numeroFilter,
    statusFilter,
    processingStatusFilter,
    processingTypeFilter,
    dateFrom,
    dateTo,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE)),
    [filteredInvoices.length],
  );

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredInvoices]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    competenciaFilter,
    emitenteFilter,
    numeroFilter,
    statusFilter,
    processingStatusFilter,
    processingTypeFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  async function handleUpload() {
    if (!selectedFile) {
      setErrorMessage("Selecione um arquivo ZIP para importar.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      setErrorMessage("Arquivo inválido. Selecione um .zip.");
      return;
    }

    if (selectedFile.size <= 0) {
      setErrorMessage("Arquivo vazio. Selecione um ZIP válido.");
      return;
    }

    try {
      setUploading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const summary = await uploadXmlZip(selectedFile, branchId, periodLabel);
      setLastSummary(summary);
      setSuccessMessage("Importação concluída com sucesso.");
      setSelectedFile(null);
      await loadData(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível importar o ZIP de XML.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function processInvoice(invoice: XmlInvoice, action: "fuel" | "maintenance" | "cost") {
    const actionLabel =
      action === "fuel"
        ? "criar abastecimento"
        : action === "maintenance"
          ? "criar manutenção"
          : "criar custo";

    if (!window.confirm(`Deseja ${actionLabel} para esta nota?`)) {
      return;
    }

    try {
      setRowLoading((prev) => ({ ...prev, [invoice.id]: action }));
      setErrorMessage("");
      setSuccessMessage("");

      if (action === "fuel") {
        await processXmlInvoiceFuel(invoice.id);
      } else if (action === "maintenance") {
        await processXmlInvoiceMaintenance(invoice.id);
      } else {
        await processXmlInvoiceCost(invoice.id);
      }

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === invoice.id
            ? {
                ...item,
                processingStatus: "PROCESSED",
                processedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setSuccessMessage("Nota processada com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível processar a nota.",
      );
    } finally {
      setRowLoading((prev) => {
        const next = { ...prev };
        delete next[invoice.id];
        return next;
      });
    }
  }

  function ignoreInvoice(invoiceId: string) {
    if (!window.confirm("Deseja ignorar esta nota?")) return;
    setIgnoredInvoiceIds((prev) => (prev.includes(invoiceId) ? prev : [...prev, invoiceId]));
    setSuccessMessage("Nota marcada como ignorada nesta visualização.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Importação XML NF-e</h1>
          <p className="text-sm text-slate-500">
            Envie um ZIP com XMLs para importar notas fiscais em lote por empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Arquivo ZIP
            </label>
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <p className="mt-1 text-xs text-slate-500">
              Formato aceito: .zip contendo arquivos XML de NF-e.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              BranchId (opcional)
            </label>
            <input
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              placeholder="UUID da filial"
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Competência (opcional)
            </label>
            <input
              value={periodLabel}
              onChange={(event) => setPeriodLabel(event.target.value)}
              placeholder="Ex: 202603"
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={16} />
              {uploading ? "Importando..." : "Importar ZIP"}
            </button>
          </div>
        </div>
      </section>

      {lastSummary ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lote</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{lastSummary.batchId}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total de arquivos</p>
            <p className="mt-1 text-3xl font-bold text-blue-900">{lastSummary.totalFiles}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Importados</p>
            <p className="mt-1 text-3xl font-bold text-emerald-900">{lastSummary.importedFiles}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Duplicados</p>
            <p className="mt-1 text-3xl font-bold text-amber-900">{lastSummary.duplicateFiles}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Erros</p>
            <p className="mt-1 text-3xl font-bold text-rose-900">{lastSummary.errorFiles}</p>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <FileArchive size={18} className="text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Lotes importados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Arquivo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Competência</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Importados</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Duplicados</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Erros</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Carregando lotes...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Nenhum lote importado.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{batch.fileName}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.periodLabel || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.status}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.totalFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.importedFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.duplicateFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{batch.errorFiles}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(batch.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Notas importadas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulte e filtre as NF-e importadas por competência, emitente, número, status e data.
          </p>
        </div>
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <input
              value={competenciaFilter}
              onChange={(event) => setCompetenciaFilter(event.target.value)}
              placeholder="Competência (2026/03)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              value={emitenteFilter}
              onChange={(event) => setEmitenteFilter(event.target.value)}
              placeholder="Emitente"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              value={numeroFilter}
              onChange={(event) => setNumeroFilter(event.target.value)}
              placeholder="Número"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos os status</option>
              <option value="AUTHORIZED">Autorizada</option>
              <option value="CANCELED">Cancelada</option>
              <option value="DENIED">Denegada</option>
              <option value="UNKNOWN">Desconhecida</option>
            </select>
            <select
              value={processingTypeFilter}
              onChange={(event) => setProcessingTypeFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="FUEL">Combustível</option>
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Serviço</option>
              <option value="UNKNOWN">Não classificada</option>
            </select>
            <select
              value={processingStatusFilter}
              onChange={(event) => setProcessingStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todas as situações</option>
              <option value="PENDING">Pendente</option>
              <option value="SUGGESTED">Sugerida</option>
              <option value="PROCESSED">Processada</option>
              <option value="IGNORED">Ignorada</option>
              <option value="ERROR">Erro</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1460px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Competência</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Emitente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Número</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Série</th>
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
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Carregando notas...
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma nota encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{formatCompetencia(invoice)}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.issuerName || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.number || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.series || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(invoice.issuedAt || undefined)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={statusBadgeClass(invoice.invoiceStatus)}>
                        {formatInvoiceStatus(invoice.invoiceStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={processingTypeBadgeClass(invoice.processingType)}>
                        {formatProcessingType(invoice.processingType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className={processingStatusBadgeClass(invoice.processingStatus)}>
                        {formatProcessingStatus(invoice.processingStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatAmountReais(invoice.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{invoice.invoiceKey}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.processingStatus === "SUGGESTED" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {invoice.processingType === "FUEL" ? (
                            <button
                              type="button"
                              onClick={() => processInvoice(invoice, "fuel")}
                              disabled={Boolean(rowLoading[invoice.id])}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {rowLoading[invoice.id] === "fuel"
                                ? "Processando..."
                                : "Criar abastecimento"}
                            </button>
                          ) : null}
                          {invoice.processingType === "PRODUCT" ||
                          invoice.processingType === "SERVICE" ? (
                            <button
                              type="button"
                              onClick={() => processInvoice(invoice, "maintenance")}
                              disabled={Boolean(rowLoading[invoice.id])}
                              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {rowLoading[invoice.id] === "maintenance"
                                ? "Processando..."
                                : "Criar manutenção"}
                            </button>
                          ) : null}
                          {invoice.processingType === "UNKNOWN" ? (
                            <button
                              type="button"
                              onClick={() => processInvoice(invoice, "cost")}
                              disabled={Boolean(rowLoading[invoice.id])}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {rowLoading[invoice.id] === "cost"
                                ? "Processando..."
                                : "Criar custo"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => ignoreInvoice(invoice.id)}
                            disabled={Boolean(rowLoading[invoice.id])}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Ignorar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Sem ações</span>
                      )}
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
