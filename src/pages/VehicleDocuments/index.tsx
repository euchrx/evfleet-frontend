import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { useBranch } from "../../contexts/BranchContext";
import { api } from "../../services/api";
import { normalizeApiBaseUrl } from "../../services/url";
import {
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocuments,
  updateVehicleDocument,
  uploadVehicleDocumentFile,
} from "../../services/vehicleDocuments";
import { getDrivers } from "../../services/drivers";
import { getVehicles } from "../../services/vehicles";
import type { Driver } from "../../types/driver";
import type { Vehicle } from "../../types/vehicle";
import type {
  VehicleDocument,
  VehicleDocumentOwnerType,
  VehicleDocumentStatus,
  VehicleDocumentType,
} from "../../types/vehicle-document";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import {
  DocumentsTablesSection,
  type DocumentFilters,
  type DocumentSortBy,
  type DocumentTab,
} from "./DocumentsTablesSection";

type DocumentFormData = {
  ownerType: VehicleDocumentOwnerType;
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
  driverId: string;
};

type DocumentFieldErrors = Partial<
  Record<"vehicleId" | "driverId" | "type" | "status" | "name", string>
>;

const TABLE_PAGE_SIZE = 10;

const vehicleTypeOptions: Array<{ value: VehicleDocumentType; label: string }> = [
  { value: "CRLV", label: "CRLV" },
  { value: "CIV", label: "CIV" },
  { value: "CIPP", label: "CIPP" },
  { value: "LICENSING", label: "Licenciamento" },
  { value: "INSURANCE", label: "Seguro" },
  { value: "IPVA", label: "IPVA" },
  { value: "LEASING_CONTRACT", label: "Contrato de leasing" },
  { value: "INSPECTION", label: "Inspeção" },
  { value: "OTHER", label: "Outro" },
];

const driverTypeOptions: Array<{ value: VehicleDocumentType; label: string }> = [
  { value: "CNH", label: "CNH" },
  { value: "MOPP", label: "MOPP" },
  { value: "TOXICOLOGICAL_EXAM", label: "Exame toxicológico" },
  { value: "EMPLOYMENT_RECORD", label: "Ficha de registro / contrato" },
  { value: "RG", label: "RG" },
  { value: "CPF_DOCUMENT", label: "CPF" },
  { value: "DEFENSIVE_DRIVING", label: "Direção defensiva" },
  { value: "TRUCAO_TRANSPORTE", label: "Trucão Comunicação em Transporte" },
  { value: "OTHER", label: "Outro" },
];

const generalTypeOptions: Array<{ value: VehicleDocumentType; label: string }> = [
  {
    value: "ENVIRONMENTAL_AUTHORIZATION",
    label: "Autorização ambiental para transporte",
  },
  { value: "RNTRC", label: "RNTRC" },
  { value: "OTHER", label: "Outro" },
];

const initialForm: DocumentFormData = {
  ownerType: "VEHICLE",
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
  driverId: "",
};

const initialFilters: DocumentFilters = {
  vehicleId: "",
  driverId: "",
  type: "",
  status: "",
  issuer: "",
  startDate: "",
  endDate: "",
};

function parseFilterIds(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
}

function getDaysUntil(value?: string | null) {
  const target = parseLocalDate(value);
  if (!target) return null;

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );

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

function documentTypeLabel(value?: VehicleDocumentType | null) {
  const allOptions = [...vehicleTypeOptions, ...driverTypeOptions, ...generalTypeOptions];

  return allOptions.find((item) => item.value === value)?.label || "Outro";
}

function getReferenceLabel(item: VehicleDocument) {
  if (item.ownerType === "DRIVER") {
    return item.driver?.name || "Motorista não vinculado";
  }

  if (item.ownerType === "GENERAL") {
    return item.company?.name || "Documento geral";
  }

  return item.vehicle ? formatVehicleLabel(item.vehicle) : "Veículo não vinculado";
}

function getTabTitle(tab: DocumentTab) {
  if (tab === "VEHICLE") return "Veículos";
  if (tab === "DRIVER") return "Motoristas";
  return "Documentos gerais";
}

function getTypeOptionsByTab(tab: DocumentTab) {
  if (tab === "VEHICLE") return vehicleTypeOptions;
  if (tab === "DRIVER") return driverTypeOptions;
  return generalTypeOptions;
}

export function VehicleDocumentsPage() {
  const location = useLocation();
  const { selectedBranchId } = useBranch();

  const [activeTab, setActiveTab] = useState<DocumentTab>("VEHICLE");
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DocumentFieldErrors>({});
  const [draftFilters, setDraftFilters] = useState<DocumentFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<DocumentFilters>(initialFilters);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<DocumentSortBy>("expiryDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<VehicleDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [quickStatusDocumentId, setQuickStatusDocumentId] = useState<string | null>(null);
  const [highlightedDocumentId, setHighlightedDocumentId] = useState<string | null>(null);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentFormData>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isCpfDocument = form.type === "CPF_DOCUMENT";

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");

      const [documentsData, vehiclesData, driversData] = await Promise.all([
        getVehicleDocuments(),
        getVehicles(),
        getDrivers(),
      ]);

      setDocuments(Array.isArray(documentsData) ? documentsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      setPageErrorMessage("Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const incomingTab = query.get("tab");
    const incomingHighlight = query.get("highlight");
    const incomingDriverId = query.get("driverId");

    if (incomingTab === "VEHICLE" || incomingTab === "DRIVER" || incomingTab === "GENERAL") {
      setActiveTab(incomingTab);
    }

    if (incomingDriverId) {
      setFocusedDriverId(incomingDriverId);
      setActiveTab("DRIVER");
    }

    if (!incomingHighlight && !incomingDriverId && !incomingTab) return;

    if (incomingHighlight) {
      setHighlightedDocumentId(incomingHighlight);
    }

    const timer = window.setTimeout(() => {
      if (incomingHighlight) {
        document
          .getElementById(`vehicle-document-row-${incomingHighlight}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);

    query.delete("tab");
    query.delete("highlight");
    query.delete("driverId");

    const next = query.toString();
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash || ""
      }`;

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

    if (selectedBranchId) {
      filtered = filtered.filter((item) => item.branchId === selectedBranchId);
    }

    return [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );
  }, [vehicles, selectedBranchId]);

  const availableDrivers = useMemo(() => {
    let filtered = drivers;

    if (selectedBranchId) {
      filtered = filtered.filter((item) => item.vehicle?.branchId === selectedBranchId);
    }

    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [drivers, selectedBranchId]);

  const scopedDocuments = useMemo(() => {
    return documents.filter((item) => {
      if (item.ownerType !== activeTab) return false;
      if (activeTab === "DRIVER" && focusedDriverId && item.driverId !== focusedDriverId) {
        return false;
      }

      if (!selectedBranchId) return true;
      if (activeTab === "GENERAL") return true;
      if (activeTab === "DRIVER") return item.driver?.vehicle?.branchId === selectedBranchId;

      return item.vehicle?.branchId === selectedBranchId;
    });
  }, [documents, activeTab, focusedDriverId, selectedBranchId]);

  const filteredDocuments = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = scopedDocuments;

    const selectedVehicleIds = parseFilterIds(appliedFilters.vehicleId);
    const selectedDriverIds = parseFilterIds(appliedFilters.driverId);

    if (activeTab === "VEHICLE" && selectedVehicleIds.length > 0) {
      filtered = filtered.filter((item) =>
        item.vehicleId ? selectedVehicleIds.includes(item.vehicleId) : false,
      );
    }

    if (activeTab === "DRIVER" && selectedDriverIds.length > 0) {
      filtered = filtered.filter((item) =>
        item.driverId ? selectedDriverIds.includes(item.driverId) : false,
      );
    }

    if (appliedFilters.type) {
      filtered = filtered.filter((item) => item.type === appliedFilters.type);
    }

    if (appliedFilters.status) {
      filtered = filtered.filter(
        (item) => getEffectiveStatus(item) === appliedFilters.status,
      );
    }

    if (appliedFilters.issuer.trim()) {
      const issuerTerm = appliedFilters.issuer.trim().toLowerCase();

      filtered = filtered.filter((item) =>
        String(item.issuer || "").toLowerCase().includes(issuerTerm),
      );
    }

    if (appliedFilters.startDate) {
      const startDate = parseLocalDate(appliedFilters.startDate)?.getTime() || 0;

      filtered = filtered.filter((item) => {
        const issueDate = parseLocalDate(item.issueDate)?.getTime() || 0;
        const expiryDate = parseLocalDate(item.expiryDate)?.getTime() || 0;

        return issueDate >= startDate || expiryDate >= startDate;
      });
    }

    if (appliedFilters.endDate) {
      const endDateBase = parseLocalDate(appliedFilters.endDate);
      const endDate = endDateBase
        ? new Date(
          endDateBase.getFullYear(),
          endDateBase.getMonth(),
          endDateBase.getDate(),
          23,
          59,
          59,
          999,
        ).getTime()
        : 0;

      filtered = filtered.filter((item) => {
        const issueDate = parseLocalDate(item.issueDate)?.getTime() || 0;
        const expiryDate = parseLocalDate(item.expiryDate)?.getTime() || 0;

        return issueDate <= endDate || expiryDate <= endDate;
      });
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === "type") {
        return (
          documentTypeLabel(a.type).localeCompare(documentTypeLabel(b.type), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
      }

      if (sortBy === "reference") {
        return (
          getReferenceLabel(a).localeCompare(getReferenceLabel(b), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }

      if (sortBy === "expiryDate") {
        return (
          ((parseLocalDate(a.expiryDate)?.getTime() || 0) -
            (parseLocalDate(b.expiryDate)?.getTime() || 0)) *
          direction
        );
      }

      return (
        statusLabel(getEffectiveStatus(a)).localeCompare(
          statusLabel(getEffectiveStatus(b)),
          "pt-BR",
          { sensitivity: "base" },
        ) * direction
      );
    });
  }, [activeTab, appliedFilters, hasSearched, scopedDocuments, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDocuments.length / TABLE_PAGE_SIZE)),
    [filteredDocuments.length],
  );

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;

    return filteredDocuments.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredDocuments, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedDocumentIds([]);
  }, [
    activeTab,
    appliedFilters,
    hasSearched,
    sortBy,
    sortDirection,
    selectedBranchId,
    focusedDriverId,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setHasSearched(false);
    setSelectedDocumentIds([]);
    setCurrentPage(1);
  }, [activeTab, focusedDriverId, selectedBranchId]);

  const summary = useMemo(() => {
    if (!hasSearched) {
      return { total: 0, valid: 0, expiring: 0, expired: 0 };
    }

    return {
      total: filteredDocuments.length,
      valid: filteredDocuments.filter((item) => getEffectiveStatus(item) === "VALID").length,
      expiring: filteredDocuments.filter((item) => getEffectiveStatus(item) === "EXPIRING")
        .length,
      expired: filteredDocuments.filter((item) => getEffectiveStatus(item) === "EXPIRED")
        .length,
    };
  }, [filteredDocuments, hasSearched]);

  function handleFilterChange<K extends keyof DocumentFilters>(
    field: K,
    value: DocumentFilters[K],
  ) {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleSearch() {
    setAppliedFilters({ ...draftFilters });
    setHasSearched(true);
    setCurrentPage(1);
    setSelectedDocumentIds([]);
  }

  function handleClearFilters() {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setHasSearched(false);
    setCurrentPage(1);
    setSelectedDocumentIds([]);
  }

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
  function openCreateModal(tab = activeTab) {
    setEditingDocument(null);
    setForm({
      ...initialForm,
      ownerType: tab,
    });
    setSelectedFile(null);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(item: VehicleDocument) {
    setEditingDocument(item);
    setForm({
      ownerType: item.ownerType,
      type: item.type || "",
      name: item.name || "",
      number: item.number || "",
      issueDate: item.issueDate ? String(item.issueDate).slice(0, 10) : "",
      expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : "",
      status: item.status || "VALID",
      issuer: item.issuer || "",
      fileUrl: item.fileUrl || "",
      notes: item.notes || "",
      vehicleId: item.vehicleId || "",
      driverId: item.driverId || "",
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

  function handleChange<K extends keyof DocumentFormData>(
    field: K,
    value: DocumentFormData[K],
  ) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "type" && value === "CPF_DOCUMENT") {
        next.issueDate = "";
        next.expiryDate = "";
      }

      return next;
    });

    if (
      field === "vehicleId" ||
      field === "driverId" ||
      field === "type" ||
      field === "status" ||
      field === "name"
    ) {
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

    const base = normalizeApiBaseUrl(String(api.defaults.baseURL || "").trim());

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
        ownerType: form.ownerType,
        type: form.type as VehicleDocumentType,
        name: form.name.trim(),
        number: form.number.trim() || undefined,
        issueDate: isCpfDocument ? undefined : form.issueDate || undefined,
        expiryDate: isCpfDocument ? undefined : form.expiryDate || undefined,
        status: form.status as VehicleDocumentStatus,
        issuer: form.issuer.trim() || undefined,
        fileUrl: nextFileUrl,
        notes: form.notes.trim() || undefined,
        vehicleId: form.ownerType === "VEHICLE" ? form.vehicleId || undefined : undefined,
        driverId: form.ownerType === "DRIVER" ? form.driverId || undefined : undefined,
      };

      const nextErrors: DocumentFieldErrors = {};

      if (!payload.type) nextErrors.type = "Selecione o tipo.";
      if (!payload.status) nextErrors.status = "Selecione o status.";
      if (!payload.name) nextErrors.name = "Informe o nome do documento.";

      if (payload.ownerType === "VEHICLE" && !payload.vehicleId) {
        nextErrors.vehicleId = "Selecione o veículo.";
      }

      if (payload.ownerType === "DRIVER" && !payload.driverId) {
        nextErrors.driverId = "Selecione o motorista.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      if (editingDocument) {
        await updateVehicleDocument(editingDocument.id, payload);
      } else {
        await createVehicleDocument(payload);
      }

      closeModal();
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      const apiText = Array.isArray(apiMessage)
        ? apiMessage.join(", ")
        : String(apiMessage || "Não foi possível salvar o documento.");

      setFieldErrors((prev) => ({ ...prev, name: apiText }));
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatusChange(
    item: VehicleDocument,
    nextStatus: VehicleDocumentStatus,
  ) {
    try {
      setQuickStatusDocumentId(item.id);

      const updated = await updateVehicleDocument(item.id, { status: nextStatus });

      setDocuments((prev) =>
        prev.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      setPageErrorMessage("");
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch (error) {
      console.error("Erro ao atualizar status do documento:", error);
      setPageErrorMessage("Não foi possível atualizar o status do documento.");
    } finally {
      setQuickStatusDocumentId(null);
    }
  }

  function handleDelete(item: VehicleDocument) {
    setDocumentToDelete(item);
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

  function handleToggleDocument(id: string) {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleToggleAllDocuments() {
    const pageIds = paginatedDocuments.map((item) => item.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedDocumentIds.includes(id));

    setSelectedDocumentIds((prev) =>
      allSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : [...new Set([...prev, ...pageIds])],
    );
  }

  async function confirmBulkDeleteDocuments() {
    if (selectedDocumentIds.length === 0) return;

    try {
      setDeletingDocument(true);

      const results = await Promise.allSettled(
        selectedDocumentIds.map((id) => deleteVehicleDocument(id)),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === selectedDocumentIds.length
            ? "Não foi possível excluir os documentos selecionados."
            : `${failedCount} documento(s) não puderam ser excluídos.`,
        );
      } else {
        setPageErrorMessage("");
      }

      setBulkDeleteOpen(false);
      setSelectedDocumentIds([]);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch (error) {
      console.error("Erro ao excluir documentos em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote dos documentos.");
    } finally {
      setDeletingDocument(false);
    }
  }

  function openEditSelectedDocument() {
    if (selectedDocumentIds.length !== 1) return;

    const selectedDocument = filteredDocuments.find(
      (item) => item.id === selectedDocumentIds[0],
    );

    if (selectedDocument) {
      openEditModal(selectedDocument);
    }
  }

  const allDocumentsOnPageSelected =
    paginatedDocuments.length > 0 &&
    paginatedDocuments.every((item) => selectedDocumentIds.includes(item.id));

  const typeOptions = getTypeOptionsByTab(activeTab);
  const modalTypeOptions = getTypeOptionsByTab(form.ownerType);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Documentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Controle de validade, vencimentos e rastreabilidade documental da operação.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal(activeTab)}
          className="btn-ui btn-ui-primary w-full sm:w-auto"
        >
          + Cadastrar documento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totais
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Válidos
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.valid}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Vencendo
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.expiring}</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Vencidos
          </p>
          <p className="mt-1 text-2xl font-bold text-red-800">{summary.expired}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          {(["VEHICLE", "DRIVER", "GENERAL"] as DocumentTab[]).map((tab) => {
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${active
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                  }`}
              >
                {getTabTitle(tab)}
              </button>
            );
          })}
        </div>
      </div>

      <DocumentsTablesSection
        activeTab={activeTab}
        loading={loading}
        hasSearched={hasSearched}
        draftFilters={draftFilters}
        vehicles={availableVehicles}
        drivers={availableDrivers}
        typeOptions={typeOptions}
        paginatedDocuments={paginatedDocuments}
        filteredDocumentsLength={filteredDocuments.length}
        selectedDocumentIds={selectedDocumentIds}
        allDocumentsOnPageSelected={allDocumentsOnPageSelected}
        currentPage={currentPage}
        totalPages={totalPages}
        tablePageSize={TABLE_PAGE_SIZE}
        quickStatusDocumentId={quickStatusDocumentId}
        highlightedDocumentId={highlightedDocumentId}
        onFilterChange={handleFilterChange}
        onConsult={handleSearch}
        onClearFilters={handleClearFilters}
        onToggleDocument={handleToggleDocument}
        onToggleAllDocuments={handleToggleAllDocuments}
        onOpenEditSelected={openEditSelectedDocument}
        onOpenBulkDelete={() => setBulkDeleteOpen(true)}
        onOpenEdit={openEditModal}
        onDelete={handleDelete}
        onQuickStatusChange={handleQuickStatusChange}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        onSort={handleSort}
        getSortArrow={getSortArrow}
        getReferenceLabel={getReferenceLabel}
        documentTypeLabel={documentTypeLabel}
        statusLabel={statusLabel}
        statusClass={statusClass}
        getEffectiveStatus={getEffectiveStatus}
        resolveFileUrl={resolveFileUrl}
      />

      {pageErrorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageErrorMessage}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <form
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingDocument ? "Editar documento" : "Cadastrar documento"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Preencha as informações de controle documental.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Categoria
                <select
                  value={form.ownerType}
                  onChange={(event) =>
                    handleChange("ownerType", event.target.value as VehicleDocumentOwnerType)
                  }
                  className={inputClass()}
                >
                  <option value="VEHICLE">Veículo</option>
                  <option value="DRIVER">Motorista</option>
                  <option value="GENERAL">Geral</option>
                </select>
              </label>

              {form.ownerType === "VEHICLE" ? (
                <label className="text-sm font-semibold text-slate-700">
                  Veículo
                  <select
                    value={form.vehicleId}
                    onChange={(event) => handleChange("vehicleId", event.target.value)}
                    className={inputClass("vehicleId")}
                  >
                    <option value="">Selecione</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.vehicleId ? (
                    <span className="mt-1 block text-xs text-red-600">
                      {fieldErrors.vehicleId}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {form.ownerType === "DRIVER" ? (
                <label className="text-sm font-semibold text-slate-700">
                  Motorista
                  <select
                    value={form.driverId}
                    onChange={(event) => handleChange("driverId", event.target.value)}
                    className={inputClass("driverId")}
                  >
                    <option value="">Selecione</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.driverId ? (
                    <span className="mt-1 block text-xs text-red-600">
                      {fieldErrors.driverId}
                    </span>
                  ) : null}
                </label>
              ) : null}

              <label className="text-sm font-semibold text-slate-700">
                Tipo
                <select
                  value={form.type}
                  onChange={(event) =>
                    handleChange("type", event.target.value as VehicleDocumentType | "")
                  }
                  className={inputClass("type")}
                >
                  <option value="">Selecione</option>
                  {modalTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.type ? (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.type}
                  </span>
                ) : null}
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    handleChange("status", event.target.value as VehicleDocumentStatus | "")
                  }
                  className={inputClass("status")}
                >
                  <option value="">Selecione</option>
                  <option value="VALID">Válido</option>
                  <option value="EXPIRING">Vencendo</option>
                  <option value="EXPIRED">Vencido</option>
                </select>
                {fieldErrors.status ? (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.status}
                  </span>
                ) : null}
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Nome do documento
                <input
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  className={inputClass("name")}
                  placeholder="Ex.: CRLV 2026"
                />
                {fieldErrors.name ? (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.name}
                  </span>
                ) : null}
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Número
                <input
                  value={form.number}
                  onChange={(event) => handleChange("number", event.target.value)}
                  className={inputClass()}
                  placeholder="Número do documento"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Emissor
                <input
                  value={form.issuer}
                  onChange={(event) => handleChange("issuer", event.target.value)}
                  className={inputClass()}
                  placeholder="Órgão emissor"
                />
              </label>

              {!isCpfDocument ? (
                <>
                  <label className="text-sm font-semibold text-slate-700">
                    Data de emissão
                    <input
                      type="date"
                      value={form.issueDate}
                      onChange={(event) => handleChange("issueDate", event.target.value)}
                      className={inputClass()}
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Data de vencimento
                    <input
                      type="date"
                      value={form.expiryDate}
                      onChange={(event) => handleChange("expiryDate", event.target.value)}
                      className={inputClass()}
                    />
                  </label>
                </>
              ) : null}

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Arquivo
                <input
                  type="file"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className={inputClass()}
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                URL do arquivo
                <input
                  value={form.fileUrl}
                  onChange={(event) => handleChange("fileUrl", event.target.value)}
                  className={inputClass()}
                  placeholder="Opcional"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Observações
                <textarea
                  value={form.notes}
                  onChange={(event) => handleChange("notes", event.target.value)}
                  className={`${inputClass()} min-h-24`}
                  placeholder="Observações internas"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="btn-ui btn-ui-neutral"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn-ui btn-ui-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar documento"}
              </button>
            </div>
          </form>
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

      <ConfirmDeleteModal
        isOpen={bulkDeleteOpen}
        title="Excluir documentos selecionados"
        description={`Deseja excluir ${selectedDocumentIds.length} documento(s) selecionado(s)?`}
        loading={deletingDocument}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDeleteDocuments}
      />
    </div>
  );
}