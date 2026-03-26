import { useEffect, useMemo, useState } from "react";
import { createVehicleDocument, deleteVehicleDocument, getVehicleDocuments, updateVehicleDocument, uploadVehicleDocumentFile } from "../../services/vehicleDocuments";
import { getVehicles } from "../../services/vehicles";
import { useBranch } from "../../contexts/BranchContext";
import type { Vehicle } from "../../types/vehicle";
import type { VehicleDocument, VehicleDocumentStatus, VehicleDocumentType } from "../../types/vehicle-document";
import { api } from "../../services/api";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { useLocation } from "react-router-dom";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type DocumentFormData = {
  type: VehicleDocumentType | "";
  name: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  status: VehicleDocumentStatus | "";
  issuer: string;
  fileUrl: string;
  notes: string;
  vehicleId: string;
};

type DocumentSortBy = "type" | "name" | "vehicle" | "expiryDate" | "status";
type DocumentFieldErrors = Partial<Record<"vehicleId" | "type" | "status" | "name", string>>;

const initialForm: DocumentFormData = {
  type: "",
  name: "",
  number: "",
  issueDate: "",
  expiryDate: "",
  status: "",
  issuer: "",
  fileUrl: "",
  notes: "",
  vehicleId: "",
};
const TABLE_PAGE_SIZE = 10;

const documentTypeOptions: Array<{ value: VehicleDocumentType; label: string }> = [
  { value: "LICENSING", label: "Licenciamento" },
  { value: "INSURANCE", label: "Seguro" },
  { value: "IPVA", label: "IPVA" },
  { value: "LEASING_CONTRACT", label: "Contrato de leasing" },
  { value: "INSPECTION", label: "Inspeção" },
  { value: "OTHER", label: "Outro" },
];

function documentTypeLabel(value?: VehicleDocumentType | null) {
  return documentTypeOptions.find((item) => item.value === value)?.label || "Outro";
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function toDateText(value?: string | null) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function getDaysUntil(value?: string | null) {
  const target = parseLocalDate(value);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEffectiveStatus(item: VehicleDocument): VehicleDocumentStatus {
  const days = getDaysUntil(item.expiryDate);
  if (days !== null && days < 0) return "EXPIRED";
  if (days !== null && days <= 30) return "EXPIRING";
  return item.status || "VALID";
}

function statusLabel(status: VehicleDocumentStatus) {
  if (status === "VALID") return "Válido";
  if (status === "EXPIRING") return "Vencendo";
  return "Vencido";
}

function statusClass(status: VehicleDocumentStatus) {
  if (status === "VALID") return "status-active";
  if (status === "EXPIRING") return "status-pending";
  return "status-inactive";
}

export function VehicleDocumentsPage() {
  const location = useLocation();
  const { selectedBranchId } = useBranch();
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DocumentFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<DocumentSortBy>("expiryDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<VehicleDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [highlightedDocumentId, setHighlightedDocumentId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentFormData>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const [documentsData, vehiclesData] = await Promise.all([getVehicleDocuments(), getVehicles()]);
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      setPageErrorMessage("Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const incomingHighlight = query.get("highlight");
    if (!incomingHighlight) return;

    setHighlightedDocumentId(incomingHighlight);
    const timer = window.setTimeout(() => {
      document
        .getElementById(`vehicle-document-row-${incomingHighlight}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    query.delete("highlight");
    const next = query.toString();
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);

    return () => window.clearTimeout(timer);
  }, [location.search]);

  useEffect(() => {
    if (!highlightedDocumentId) return;
    const clear = () => setHighlightedDocumentId(null);
    document.addEventListener("pointerdown", clear, { passive: true });
    document.addEventListener("keydown", clear);
    return () => {
      document.removeEventListener("pointerdown", clear);
      document.removeEventListener("keydown", clear);
    };
  }, [highlightedDocumentId]);

  const availableVehicles = useMemo(() => {
    let filtered = vehicles;
    if (selectedBranchId) filtered = filtered.filter((item) => item.branchId === selectedBranchId);
    return [...filtered].sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }));
  }, [vehicles, selectedBranchId]);

  const filteredDocuments = useMemo(() => {
    let filtered = documents;
    if (selectedBranchId) filtered = filtered.filter((item) => item.vehicle?.branchId === selectedBranchId);
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((item) =>
        [
          item.name,
          documentTypeLabel(item.type),
          item.number || "",
          item.issuer || "",
          item.vehicle ? formatVehicleLabel(item.vehicle) : "",
          item.vehicle?.plate || "",
          statusLabel(getEffectiveStatus(item)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "type") return documentTypeLabel(a.type).localeCompare(documentTypeLabel(b.type), "pt-BR", { sensitivity: "base" }) * direction;
      if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
      if (sortBy === "vehicle") {
        const av = a.vehicle ? formatVehicleLabel(a.vehicle) : "";
        const bv = b.vehicle ? formatVehicleLabel(b.vehicle) : "";
        return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "expiryDate") return ((parseLocalDate(a.expiryDate)?.getTime() || 0) - (parseLocalDate(b.expiryDate)?.getTime() || 0)) * direction;
      return statusLabel(getEffectiveStatus(a)).localeCompare(statusLabel(getEffectiveStatus(b)), "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [documents, selectedBranchId, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDocuments.length / TABLE_PAGE_SIZE)),
    [filteredDocuments.length]
  );

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredDocuments.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredDocuments, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, sortDirection, selectedBranchId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const scoped = selectedBranchId ? documents.filter((item) => item.vehicle?.branchId === selectedBranchId) : documents;
    const total = scoped.length;
    const valid = scoped.filter((item) => getEffectiveStatus(item) === "VALID").length;
    const expiring = scoped.filter((item) => getEffectiveStatus(item) === "EXPIRING").length;
    const expired = scoped.filter((item) => getEffectiveStatus(item) === "EXPIRED").length;
    return { total, valid, expiring, expired };
  }, [documents, selectedBranchId]);

  function getSortArrow(column: DocumentSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function handleSort(column: DocumentSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function openCreateModal() {
    setEditingDocument(null);
    setForm(initialForm);
    setSelectedFile(null);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(item: VehicleDocument) {
    setEditingDocument(item);
    setForm({
      type: item.type || "LICENSING",
      name: item.name || "",
      number: item.number || "",
      issueDate: item.issueDate ? String(item.issueDate).slice(0, 10) : "",
      expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : "",
      status: item.status || "VALID",
      issuer: item.issuer || "",
      fileUrl: item.fileUrl || "",
      notes: item.notes || "",
      vehicleId: item.vehicleId || "",
    });
    setSelectedFile(null);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingDocument(null);
    setForm(initialForm);
    setSelectedFile(null);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof DocumentFormData>(field: K, value: DocumentFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "vehicleId" || field === "type" || field === "status" || field === "name") {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function inputClass(field?: keyof DocumentFieldErrors) {
    if (field && fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  function resolveFileUrl(fileUrl?: string | null) {
    if (!fileUrl) return "";
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
    const base = String(api.defaults.baseURL || "").replace(/\/+$/, "");
    return `${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFieldErrors({});
      let nextFileUrl = form.fileUrl.trim() || undefined;

      if (selectedFile) {
        const upload = await uploadVehicleDocumentFile(selectedFile);
        nextFileUrl = upload.fileUrl;
      }

      const payload = {
        type: form.type as VehicleDocumentType,
        name: form.name.trim(),
        number: form.number.trim() || undefined,
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        status: form.status as VehicleDocumentStatus,
        issuer: form.issuer.trim() || undefined,
        fileUrl: nextFileUrl,
        notes: form.notes.trim() || undefined,
        vehicleId: form.vehicleId,
      };

      const nextErrors: DocumentFieldErrors = {};
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
      if (!payload.type) nextErrors.type = "Selecione o tipo.";
      if (!payload.status) nextErrors.status = "Selecione o status.";
      if (!payload.name) nextErrors.name = "Informe o nome do documento.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      if (editingDocument) await updateVehicleDocument(editingDocument.id, payload);
      else await createVehicleDocument(payload);

      closeModal();
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
      const apiText = Array.isArray(apiMessage) ? apiMessage.join(", ") : String(apiMessage || "Não foi possível salvar o documento.");
      setFieldErrors((prev) => ({ ...prev, name: apiText }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: VehicleDocument) {
    setDocumentToDelete(item);
    try {
      return;
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      setPageErrorMessage("Não foi possível excluir o documento.");
    }
  }

  async function confirmDeleteDocument() {
    if (!documentToDelete) return;
    try {
      setDeletingDocument(true);
      await deleteVehicleDocument(documentToDelete.id);
      setDocumentToDelete(null);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      setPageErrorMessage("Não foi possível excluir o documento.");
    } finally {
      setDeletingDocument(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Documentos</h1>
          <p className="text-sm text-slate-500">Controle de validade, vencimentos e rastreabilidade documental da frota.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
        >
          + Cadastrar documento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p><p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Válidos</p><p className="mt-1 text-2xl font-bold text-emerald-800">{summary.valid}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Vencendo (30d)</p><p className="mt-1 text-2xl font-bold text-amber-800">{summary.expiring}</p></div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Vencidos</p><p className="mt-1 text-2xl font-bold text-red-800">{summary.expired}</p></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por documento, tipo, veículo, placa, status ou órgão emissor" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
      </div>

      {pageErrorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageErrorMessage}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("type")} className="cursor-pointer">Tipo {getSortArrow("type")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("name")} className="cursor-pointer">Documento {getSortArrow("name")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">Veículo {getSortArrow("vehicle")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("expiryDate")} className="cursor-pointer">Vencimento {getSortArrow("expiryDate")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("status")} className="cursor-pointer">Status {getSortArrow("status")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Carregando documentos...</td></tr> : filteredDocuments.length === 0 ? <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Nenhum documento encontrado.</td></tr> : paginatedDocuments.map((item) => {
                const effectiveStatus = getEffectiveStatus(item);
                const isHighlighted = highlightedDocumentId === item.id;
                return (
                  <tr id={`vehicle-document-row-${item.id}`} key={item.id} className={`border-t border-slate-200 ${isHighlighted ? "notification-highlight" : ""}`}>
                    <td className="px-6 py-4 text-sm text-slate-700">{documentTypeLabel(item.type)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700"><p className="font-medium text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.number || "Sem número"}</p>{item.fileUrl ? <a href={resolveFileUrl(item.fileUrl)} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-blue-700 hover:underline">Ver anexo</a> : null}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.vehicle ? formatVehicleLabel(item.vehicle) : item.vehicleId}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{toDateText(item.expiryDate)}</td>
                    <td className="px-6 py-4 text-sm"><span className={`status-pill ${statusClass(effectiveStatus)}`}>{statusLabel(effectiveStatus)}</span></td>
                    <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button onClick={() => openEditModal(item)} className="btn-ui btn-ui-neutral">Editar</button><button onClick={() => handleDelete(item)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filteredDocuments.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDocuments.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="documentos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingDocument ? "Editar documento" : "Cadastrar documento"}</h2>
                <p className="text-sm text-slate-500">Gerencie validade e rastreabilidade documental do veículo.</p>
              </div>
              <button onClick={closeModal} className="btn-ui btn-ui-neutral">Fechar</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Identificação</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-medium text-slate-700">Veículo</label><select value={form.vehicleId} onChange={(e) => handleChange("vehicleId", e.target.value)} className={inputClass("vehicleId")}><option value="">Selecione um veículo</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}</select>{fieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Tipo</label><select value={form.type} onChange={(e) => handleChange("type", e.target.value as VehicleDocumentType | "")} className={inputClass("type")}><option value="">Selecione o tipo</option>{documentTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{fieldErrors.type ? <p className="mt-1 text-xs text-red-600">{fieldErrors.type}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Nome do documento</label><input value={form.name} onChange={(e) => handleChange("name", e.target.value)} className={inputClass("name")} placeholder="Ex: Seguro veicular 2026" />{fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Número</label><input value={form.number} onChange={(e) => handleChange("number", e.target.value)} className={inputClass()} placeholder="Opcional" /></div>
                  <div><label className="block text-sm font-medium text-slate-700">Órgão emissor</label><input value={form.issuer} onChange={(e) => handleChange("issuer", e.target.value)} className={inputClass()} placeholder="Detran, seguradora..." /></div>
                  <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={form.status} onChange={(e) => handleChange("status", e.target.value as VehicleDocumentStatus | "")} className={inputClass("status")}><option value="">Selecione o status</option><option value="VALID">Válido</option><option value="EXPIRING">Vencendo</option><option value="EXPIRED">Vencido</option></select>{fieldErrors.status ? <p className="mt-1 text-xs text-red-600">{fieldErrors.status}</p> : null}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vigência</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-medium text-slate-700">Data de emissão</label><input type="date" value={form.issueDate} onChange={(e) => handleChange("issueDate", e.target.value)} className={inputClass()} /></div>
                  <div><label className="block text-sm font-medium text-slate-700">Data de vencimento</label><input type="date" value={form.expiryDate} onChange={(e) => handleChange("expiryDate", e.target.value)} className={inputClass()} /></div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Anexo do documento</label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="mt-1 w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700 hover:file:bg-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {selectedFile ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">
                          Novo arquivo: {selectedFile.name}
                        </span>
                      ) : null}
                      {!selectedFile && form.fileUrl ? (
                        <>
                          <a
                            href={resolveFileUrl(form.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            Ver anexo atual
                          </a>
                          <button
                            type="button"
                            onClick={() => handleChange("fileUrl", "")}
                            className="btn-ui btn-ui-danger"
                          >
                            Remover anexo
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-500">Aceita PDF, PNG, JPG e WEBP (até 10MB).</span>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Observações</label><textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={3} className={inputClass()} placeholder="Informações adicionais" /></div>
                </div>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button type="button" onClick={closeModal} className="btn-ui btn-ui-neutral">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-ui btn-ui-primary disabled:cursor-not-allowed disabled:opacity-70">{saving ? "Salvando..." : editingDocument ? "Salvar alterações" : "Cadastrar documento"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ConfirmDeleteModal
        isOpen={Boolean(documentToDelete)}
        title="Excluir documento"
        description={
          documentToDelete
            ? `Deseja excluir o documento "${documentToDelete.name}"?`
            : ""
        }
        loading={deletingDocument}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={confirmDeleteDocument}
      />
    </div>
  );
}

