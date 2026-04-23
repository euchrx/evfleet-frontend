import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import { getBranches } from "../../services/branches";
import { createDriver, deleteDriver, getDrivers, updateDriver } from "../../services/drivers";
import { getVehicleDocuments } from "../../services/vehicleDocuments";
import { getVehicles } from "../../services/vehicles";
import type { Branch } from "../../types/branch";
import type { Driver } from "../../types/driver";
import type { Vehicle } from "../../types/vehicle";
import type { VehicleDocument } from "../../types/vehicle-document";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type DriverFormData = {
  name: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  phone: string;
  status: string;
  vehicleId: string;
};

type DriverFilterForm = {
  branchId: string;
  name: string;
  cpf: string;
  cnh: string;
  vehicleId: string;
  status: string;
};

type DriverFieldErrors = Partial<Record<keyof DriverFormData, string>>;
type DriverSortBy = "name" | "cpf" | "documents" | "vehicle" | "status";
type SelectOption = { id: string; label: string };

const initialForm: DriverFormData = {
  name: "",
  cpf: "",
  cnh: "",
  cnhCategory: "",
  cnhExpiresAt: "",
  phone: "",
  status: "ACTIVE",
  vehicleId: "",
};

const TABLE_PAGE_SIZE = 10;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function getDriverStatusLabel(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "INACTIVE") return "Inativo";
  return status;
}

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((item) => {
      if (selectedIds.includes(item.id)) return false;
      if (!normalized) return true;
      return item.label.toLowerCase().includes(normalized);
    });
  }, [options, query, selectedIds]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(false);
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      const target = event.target as Node;
      if (!containerRef.current.contains(target)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      <div ref={containerRef} className="relative">
        <div
          className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm transition focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200"
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
              >
                {item.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!disabled) onChange(selectedIds.filter((id) => id !== item.id));
                  }}
                  className={`text-slate-500 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-red-600"
                    }`}
                >
                  ×
                </button>
              </span>
            ))}

            <input
              value={query}
              onChange={(event) => {
                if (disabled) return;
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (!disabled) setOpen(true);
              }}
              placeholder={selectedOptions.length === 0 ? placeholder : "Digite para buscar..."}
              disabled={disabled}
              className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {open && !disabled && filteredOptions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  addItem(option.id);
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DriversPage() {
  const { selectedBranchId } = useBranch();
  const { selectedCompanyId, currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [consulting, setConsulting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DriverFieldErrors>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<DriverSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState(false);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [deletingSelectedDrivers, setDeletingSelectedDrivers] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<DriverFormData>(initialForm);
  const [draftFilters, setDraftFilters] = useState<DriverFilterForm>({
    branchId: selectedBranchId || "",
    name: "",
    cpf: "",
    cnh: "",
    vehicleId: "",
    status: "ALL",
  });
  const [appliedFilters, setAppliedFilters] = useState<DriverFilterForm>({
    branchId: selectedBranchId || "",
    name: "",
    cpf: "",
    cnh: "",
    vehicleId: "",
    status: "ALL",
  });

  async function loadLookupData() {
    try {
      setLoading(true);
      setPageErrorMessage("");

      const [vehiclesData, documentsData, branchesData] = await Promise.all([
        getVehicles(),
        getVehicleDocuments(),
        getBranches(selectedCompanyId || undefined),
      ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (error) {
      console.error("Erro ao carregar dados auxiliares dos motoristas:", error);
      setPageErrorMessage("Não foi possível carregar os dados auxiliares dos motoristas.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDriversData() {
    try {
      setConsulting(true);
      setPageErrorMessage("");
      const driversData = await getDrivers();
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setHasSearched(true);
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
      setPageErrorMessage("Não foi possível carregar os motoristas.");
      setDrivers([]);
      setHasSearched(true);
    } finally {
      setConsulting(false);
    }
  }

  function handleConsult() {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
    setSelectedDriverIds([]);
    setHasSearched(true);
  }

  function handleClearFilters() {
    const clearedFilters: DriverFilterForm = {
      branchId: selectedBranchId || "",
      name: "",
      cpf: "",
      cnh: "",
      vehicleId: "",
      status: "ALL",
    };

    setDraftFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setCurrentPage(1);
    setSelectedDriverIds([]);
    setHasSearched(true);
  }

  useEffect(() => {
    void loadLookupData();
    void loadDriversData();
  }, [selectedCompanyId]);

  useEffect(() => {
    const nextFilters = {
      branchId: selectedBranchId || "",
      name: "",
      cpf: "",
      cnh: "",
      vehicleId: "",
      status: "ALL",
    };

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSelectedDriverIds([]);
    setCurrentPage(1);
    void loadDriversData();
  }, [selectedBranchId, selectedCompanyId]);

  useEffect(() => {
    if (!pageErrorMessage) return;

    const normalized = pageErrorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tone = /sucesso|concluid|excluid/.test(normalized) ? "success" : "error";

    showToast({
      tone,
      title: tone === "success" ? "Operação concluída" : "Atenção",
      message: pageErrorMessage,
    });
    setPageErrorMessage("");
  }, [pageErrorMessage, showToast]);

  function openCreateModal() {
    setEditingDriver(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(driver: Driver) {
    setEditingDriver(driver);
    setForm({
      name: driver.name,
      cpf: formatCpf(driver.cpf),
      cnh: driver.cnh,
      cnhCategory: driver.cnhCategory,
      cnhExpiresAt: driver.cnhExpiresAt.slice(0, 10),
      phone: driver.phone ? formatPhone(driver.phone) : "",
      status: driver.status,
      vehicleId: driver.vehicleId || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingDriver(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof DriverFormData>(field: K, value: DriverFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleFilterChange<K extends keyof DriverFilterForm>(field: K, value: DriverFilterForm[K]) {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleSort(column: DriverSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: DriverSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function inputClass(field: keyof DriverFormData) {
    if (fieldErrors[field]) {
      return "mt-1 h-10 w-full rounded-xl border border-red-400 bg-red-50 px-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFieldErrors({});

      const payload = {
        name: form.name.trim(),
        cpf: onlyDigits(form.cpf),
        cnh: form.cnh.trim(),
        cnhCategory: form.cnhCategory.trim().toUpperCase(),
        cnhExpiresAt: form.cnhExpiresAt,
        phone: form.phone ? onlyDigits(form.phone) : undefined,
        status: form.status,
        vehicleId: form.vehicleId,
      };

      const nextErrors: DriverFieldErrors = {};
      if (!payload.name) nextErrors.name = "Informe o nome.";
      if (!payload.cpf) nextErrors.cpf = "Informe o CPF.";
      if (!payload.cnh) nextErrors.cnh = "Informe a CNH.";
      if (!payload.cnhCategory) nextErrors.cnhCategory = "Informe a categoria da CNH.";
      if (!payload.cnhExpiresAt) nextErrors.cnhExpiresAt = "Informe a validade da CNH.";
      if (!payload.status) nextErrors.status = "Informe o status.";
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      if (payload.cpf.length !== 11) {
        setFieldErrors({ cpf: "Informe um CPF válido com 11 dígitos." });
        return;
      }

      if (editingDriver) await updateDriver(editingDriver.id, payload);
      else await createDriver(payload);

      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      closeModal();
      await loadDriversData();
    } catch (error: any) {
      console.error("Erro ao salvar motorista:", error);
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";
      const apiText = Array.isArray(apiMessage)
        ? apiMessage.join(" ")
        : typeof apiMessage === "string"
          ? apiMessage
          : JSON.stringify(apiMessage || "");

      if (/cpf/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, cpf: "CPF ja cadastrado." }));
      }
      if (/cnh/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, cnh: "CNH ja cadastrada." }));
      }
      if (!/cpf|cnh/i.test(apiText)) {
        setFieldErrors((prev) => ({
          ...prev,
          name: "Não foi possível salvar. Revise os campos.",
        }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(driver: Driver) {
    setDriverToDelete(driver);
  }

  async function confirmDeleteDriver() {
    if (!driverToDelete) return;
    try {
      setDeletingDriver(true);
      setPageErrorMessage("");
      await deleteDriver(driverToDelete.id);
      setSelectedDriverIds((prev) => prev.filter((id) => id !== driverToDelete.id));
      setDriverToDelete(null);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      await loadDriversData();
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      setPageErrorMessage("Não foi possível excluir o motorista.");
    } finally {
      setDeletingDriver(false);
    }
  }

  function toggleDriverSelection(driverId: string) {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId],
    );
  }

  async function confirmDeleteSelectedDrivers() {
    if (selectedDriverIds.length === 0) return;

    try {
      setDeletingSelectedDrivers(true);
      setPageErrorMessage("");

      const results = await Promise.allSettled(selectedDriverIds.map((id) => deleteDriver(id)));
      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === selectedDriverIds.length
            ? "Não foi possível excluir os motoristas selecionados."
            : `${failedCount} motorista(s) não puderam ser excluídos.`,
        );
      }

      setSelectedDriverIds([]);
      setIsBulkDeleteModalOpen(false);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      await loadDriversData();
    } catch (error) {
      console.error("Erro ao excluir motoristas em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote dos motoristas.");
    } finally {
      setDeletingSelectedDrivers(false);
    }
  }

  const branchOptions = useMemo<SelectOption[]>(
    () =>
      branches.map((branch) => ({
        id: branch.id,
        label: branch.name,
      })),
    [branches],
  );

  const statusOptions: SelectOption[] = [
    { id: "ACTIVE", label: "Ativo" },
    { id: "INACTIVE", label: "Inativo" },
  ];

  const selectedDraftBranchIds = useMemo(
    () => splitCsv(draftFilters.branchId),
    [draftFilters.branchId],
  );

  const selectedDraftStatusIds = useMemo(
    () => (draftFilters.status === "ALL" ? [] : splitCsv(draftFilters.status)),
    [draftFilters.status],
  );

  const vehicleOptions = useMemo(() => {
    let filtered = vehicles.filter((vehicle) => vehicle.category !== "IMPLEMENT");

    const branchIds = selectedDraftBranchIds.length
      ? selectedDraftBranchIds
      : String(selectedBranchId || "").trim()
        ? [String(selectedBranchId || "").trim()]
        : [];

    if (branchIds.length) {
      filtered = filtered.filter((vehicle) => branchIds.includes(String(vehicle.branchId || "")));
    }

    return [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );
  }, [vehicles, selectedDraftBranchIds, selectedBranchId]);

  const availableVehicles = useMemo(() => {
    const branchIds = selectedDraftBranchIds.length
      ? selectedDraftBranchIds
      : String(selectedBranchId || "").trim()
        ? [String(selectedBranchId || "").trim()]
        : [];

    let filtered = branchIds.length
      ? vehicles.filter((vehicle) => branchIds.includes(String(vehicle.branchId || "")))
      : vehicles;

    filtered = filtered.filter((vehicle) => vehicle.category !== "IMPLEMENT");

    const sorted = [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );

    if (editingDriver && form.vehicleId) {
      return sorted.filter((vehicle) => vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId);
    }

    return sorted.filter((vehicle) => vehicle.status === "ACTIVE");
  }, [vehicles, selectedDraftBranchIds, selectedBranchId, editingDriver, form.vehicleId]);

  const driverDocumentsByDriverId = useMemo(() => {
    const driverDocuments = documents
      .filter((item) => item.ownerType === "DRIVER" && item.driverId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const map = new Map<string, VehicleDocument[]>();
    driverDocuments.forEach((item) => {
      if (!item.driverId) return;
      const current = map.get(item.driverId) || [];
      current.push(item);
      map.set(item.driverId, current);
    });
    return map;
  }, [documents]);

  const driverDocumentCountByDriverId = useMemo(() => {
    const map = new Map<string, number>();
    driverDocumentsByDriverId.forEach((items, driverId) => {
      map.set(driverId, items.length);
    });
    return map;
  }, [driverDocumentsByDriverId]);

  const filteredDrivers = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = [...drivers];

    const branchIds = splitCsv(appliedFilters.branchId);
    const cpfDigits = onlyDigits(appliedFilters.cpf);
    const nameTerm = appliedFilters.name.trim().toLowerCase();
    const cnhTerm = appliedFilters.cnh.trim().toLowerCase();
    const vehicleId = String(appliedFilters.vehicleId || "").trim();
    const statuses = appliedFilters.status === "ALL" ? [] : splitCsv(appliedFilters.status);

    if (branchIds.length) {
      filtered = filtered.filter((driver) => {
        const driverBranchId = String(driver.vehicle?.branchId || "");
        return branchIds.includes(driverBranchId);
      });
    }

    if (nameTerm) {
      filtered = filtered.filter((driver) => driver.name.toLowerCase().includes(nameTerm));
    }

    if (cpfDigits) {
      filtered = filtered.filter((driver) => onlyDigits(driver.cpf).includes(cpfDigits));
    }

    if (cnhTerm) {
      filtered = filtered.filter((driver) =>
        `${driver.cnh} ${driver.cnhCategory}`.toLowerCase().includes(cnhTerm),
      );
    }

    if (vehicleId) {
      filtered = filtered.filter((driver) => driver.vehicleId === vehicleId);
    }

    if (statuses.length) {
      filtered = filtered.filter((driver) => statuses.includes(driver.status));
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "cpf") return a.cpf.localeCompare(b.cpf, "pt-BR") * direction;
      if (sortBy === "documents") {
        const aDocuments = driverDocumentCountByDriverId.get(a.id) || 0;
        const bDocuments = driverDocumentCountByDriverId.get(b.id) || 0;
        return (aDocuments - bDocuments) * direction;
      }
      if (sortBy === "vehicle") {
        const aVehicle = a.vehicle ? formatVehicleLabel(a.vehicle) : "";
        const bVehicle = b.vehicle ? formatVehicleLabel(b.vehicle) : "";
        return aVehicle.localeCompare(bVehicle, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "status") return a.status.localeCompare(b.status, "pt-BR") * direction;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [drivers, hasSearched, appliedFilters, sortBy, sortDirection, driverDocumentCountByDriverId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDrivers.length / TABLE_PAGE_SIZE)),
    [filteredDrivers.length],
  );

  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredDrivers.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredDrivers, currentPage]);

  const allDriversOnPageSelected =
    paginatedDrivers.length > 0 &&
    paginatedDrivers.every((driver) => selectedDriverIds.includes(driver.id));

  function toggleSelectAllDriversOnPage() {
    const pageIds = paginatedDrivers.map((driver) => driver.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedDriverIds.includes(id));

    setSelectedDriverIds((prev) => {
      if (allSelected) return prev.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...prev, ...pageIds]));
    });
  }

  useEffect(() => {
    setCurrentPage(1);
    setSelectedDriverIds([]);
  }, [sortBy, sortDirection, hasSearched, appliedFilters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    if (!hasSearched) {
      return { total: 0, active: 0, inactive: 0 };
    }

    return {
      total: filteredDrivers.length,
      active: filteredDrivers.filter((driver) => driver.status === "ACTIVE").length,
      inactive: filteredDrivers.filter((driver) => driver.status !== "ACTIVE").length,
    };
  }, [filteredDrivers, hasSearched]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Motoristas</h1>
          <p className="text-sm text-slate-500">
            Consulte e gerencie os motoristas cadastrados no sistema
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
        >
          + Cadastrar motorista
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Inativos</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{summary.inactive}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Empresa</label>
              <input
                value={currentCompany?.name || "Empresa não selecionada"}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              />
            </div>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
              <input
                type="text"
                value={draftFilters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
                placeholder="Nome do motorista"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>


            <div>
              <MultiSelectField
                label="Status"
                options={statusOptions}
                selectedIds={selectedDraftStatusIds}
                onChange={(value) => handleFilterChange("status", value.length ? value.join(",") : "ALL")}
                placeholder="Selecione os status"
              />
            </div>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Veículo</span>
              <select
                value={draftFilters.vehicleId}
                onChange={(e) => handleFilterChange("vehicleId", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Todos</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {formatVehicleLabel(vehicle)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn-ui btn-ui-neutral"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={handleConsult}
              disabled={loading}
              className="btn-ui btn-ui-primary"
            >
              Consultar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedDriverIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedDriverIds.length} motorista(s) selecionado(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDriverIds([])}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Excluir selecionados
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {hasSearched
                  ? `${filteredDrivers.length} motorista(s) encontrado(s).`
                  : "Nenhum resultado carregado ainda."}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allDriversOnPageSelected}
                    onChange={toggleSelectAllDriversOnPage}
                    disabled={!hasSearched || paginatedDrivers.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Selecionar todos os motoristas da página"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("name")} className="cursor-pointer">
                    Nome {getSortArrow("name")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("cpf")} className="cursor-pointer">
                    CPF {getSortArrow("cpf")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("documents")} className="cursor-pointer">
                    Documentos {getSortArrow("documents")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">
                    Veículo {getSortArrow("vehicle")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("status")} className="cursor-pointer">
                    Status {getSortArrow("status")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando dados auxiliares...
                  </td>
                </tr>
              ) : consulting ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando motoristas...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum resultado carregado ainda.
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum motorista encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedDriverIds.includes(driver.id)}
                        onChange={() => toggleDriverSelection(driver.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar motorista ${driver.name}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{driver.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatCpf(driver.cpf)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">
                          {driverDocumentCountByDriverId.get(driver.id) || 0} documento(s)
                        </p>
                        <Link
                          to={`/vehicle-documents?tab=DRIVER&driverId=${driver.id}`}
                          className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          Ver documentos
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {driver.vehicle ? formatVehicleLabel(driver.vehicle) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`status-pill ${driver.status === "ACTIVE" ? "status-active" : "status-inactive"
                          }`}
                      >
                        {getDriverStatusLabel(driver.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(driver)} className="btn-ui btn-ui-neutral">
                          Editar
                        </button>
                        <button onClick={() => void handleDelete(driver)} className="btn-ui btn-ui-danger">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasSearched && filteredDrivers.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDrivers.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="motoristas"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingDriver ? "Editar motorista" : "Cadastrar motorista"}
                </h2>
                <p className="text-sm text-slate-500">Preencha as informações do motorista</p>
              </div>
              <button
                onClick={closeModal}
                className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={inputClass("name")}
                    placeholder="Nome completo"
                  />
                  {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">CPF</label>
                  <input
                    type="text"
                    value={form.cpf}
                    onChange={(e) => handleChange("cpf", formatCpf(e.target.value))}
                    className={inputClass("cpf")}
                    placeholder="000.000.000-00"
                  />
                  {fieldErrors.cpf ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cpf}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Telefone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    className={inputClass("phone")}
                    placeholder="(00) 00000-0000"
                  />
                  {fieldErrors.phone ? <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">CNH</label>
                  <input
                    type="text"
                    value={form.cnh}
                    onChange={(e) => handleChange("cnh", e.target.value)}
                    className={inputClass("cnh")}
                    placeholder="Numero da CNH"
                  />
                  {fieldErrors.cnh ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cnh}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Categoria CNH</label>
                  <input
                    type="text"
                    value={form.cnhCategory}
                    onChange={(e) => handleChange("cnhCategory", e.target.value.toUpperCase())}
                    className={`${inputClass("cnhCategory")} uppercase`}
                    placeholder="AB"
                  />
                  {fieldErrors.cnhCategory ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.cnhCategory}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Vencimento da CNH</label>
                  <input
                    type="date"
                    value={form.cnhExpiresAt}
                    onChange={(e) => handleChange("cnhExpiresAt", e.target.value)}
                    className={inputClass("cnhExpiresAt")}
                  />
                  {fieldErrors.cnhExpiresAt ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.cnhExpiresAt}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className={inputClass("status")}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                  {fieldErrors.status ? <p className="mt-1 text-xs text-red-600">{fieldErrors.status}</p> : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Veículo vinculado</label>
                  <select
                    value={form.vehicleId}
                    onChange={(e) => handleChange("vehicleId", e.target.value)}
                    className={inputClass("vehicleId")}
                  >
                    <option value="">Selecione um veículo</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.vehicleId ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p>
                  ) : null}
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Salvando..." : editingDriver ? "Salvar alterações" : "Cadastrar motorista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(driverToDelete)}
        title="Excluir motorista"
        description={driverToDelete ? `Deseja excluir o motorista ${driverToDelete.name}?` : ""}
        loading={deletingDriver}
        onCancel={() => setDriverToDelete(null)}
        onConfirm={confirmDeleteDriver}
      />

      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        title="Excluir motoristas selecionados"
        description={`Deseja excluir ${selectedDriverIds.length} motorista(s) selecionado(s)?`}
        loading={deletingSelectedDrivers}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={confirmDeleteSelectedDrivers}
      />
    </div>
  );
}