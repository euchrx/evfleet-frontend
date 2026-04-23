import { useEffect, useMemo, useRef, useState } from "react";
import type { Vehicle } from "../../types/vehicle";
import type { Driver } from "../../types/driver";
import {
  acknowledgeFuelRecordAnomaly,
  createFuelRecord,
  deleteFuelRecord,
  getFuelInsights,
  getFuelRecords,
  updateFuelRecord,
  type FuelInsights,
  type FuelRecord,
} from "../../services/fuelRecords";
import { getVehicles } from "../../services/vehicles";
import { getDrivers } from "../../services/drivers";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CarFront, Gauge } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { FuelXmlImportButton } from "../../components/FuelXmlImportButton";
import { TablePagination } from "../../components/TablePagination";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import { formatFuelTypeLabel } from "../../utils/fuelTypeLabel";

type FuelFormData = {
  invoiceNumber: string;
  liters: string;
  totalValue: string;
  km: string;
  fuelDate: string;
  fuelType:
    | ""
    | "GASOLINE"
    | "ETHANOL"
    | "DIESEL"
    | "ARLA32"
    | "FLEX"
    | "ELECTRIC"
    | "HYBRID"
    | "CNG";
  vehicleId: string;
  driverId: string;
};

type FuelFieldErrors = Partial<Record<keyof FuelFormData, string>>;

type FuelListFilters = {
  branchId: string;
  vehicleId: string;
  driverId: string;
  fuelType: string;
  invoiceNumber: string;
  anomalyStatus: string;
  startDate: string;
  endDate: string;
};

type FuelSortBy =
  | "invoiceNumber"
  | "branch"
  | "vehicle"
  | "driver"
  | "fuelDate"
  | "fuelType"
  | "liters"
  | "totalValue"
  | "km"
  | "avgConsumption";

type SelectOption = {
  id: string;
  label: string;
};

const initialForm: FuelFormData = {
  invoiceNumber: "",
  liters: "",
  totalValue: "",
  km: "",
  fuelDate: "",
  fuelType: "",
  vehicleId: "",
  driverId: "",
};

const initialListFilters: FuelListFilters = {
  branchId: "",
  vehicleId: "",
  driverId: "",
  fuelType: "",
  invoiceNumber: "",
  anomalyStatus: "",
  startDate: "",
  endDate: "",
};

const TABLE_PAGE_SIZE = 10;

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

function formatMoney(value: string) {
  const digits = value.replace(/\D/g, "");
  const number = Number(digits) / 100;

  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatLocalDate(dateValue: string) {
  const raw = String(dateValue || "").trim();
  if (!raw) return "-";

  const isoMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (isoMatch) {
    const day = isoMatch[3];
    const month = isoMatch[2];
    const year = isoMatch[1];
    const hour = isoMatch[4] || "00";
    const minute = isoMatch[5] || "00";
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const brMatch = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (brMatch) {
    const day = brMatch[1];
    const month = brMatch[2];
    const year = brMatch[3];
    const hour = brMatch[4] || "00";
    const minute = brMatch[5] || "00";
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return "-";
  return fallback.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateTimeLocalInput(value?: string) {
  if (!value) return "";
  const raw = String(value).trim();
  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (iso) {
    const hh = iso[4] || "00";
    const mm = iso[5] || "00";
    return `${iso[1]}-${iso[2]}-${iso[3]}T${hh}:${mm}`;
  }
  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (br) {
    const hh = br[4] || "00";
    const mm = br[5] || "00";
    return `${br[3]}-${br[2]}-${br[1]}T${hh}:${mm}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function findLinkedDriverByVehicleId(drivers: Driver[], vehicleId: string) {
  const active = drivers.find(
    (item) =>
      item.vehicleId === vehicleId &&
      String(item.status || "").toUpperCase() === "ACTIVE",
  );
  if (active) return active;
  return drivers.find((item) => item.vehicleId === vehicleId) || null;
}

function CompactMultiSelectField({
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
  }, [options, selectedIds, query]);

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
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div ref={containerRef} className="relative">
        <div
          className={`min-h-[40px] w-full rounded-xl border bg-white px-2.5 py-1.5 text-sm focus-within:ring-2 ${
            disabled
              ? "border-slate-200 bg-slate-100"
              : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
          }`}
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
                  className={`leading-none ${
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-red-600"
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
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={selectedOptions.length === 0 ? placeholder : "Buscar..."}
              disabled={disabled}
              className="min-w-[96px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
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

export function FuelRecordsPage() {
  const location = useLocation();
  const { branches } = useBranch();
  const { selectedCompanyId, currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [insights, setInsights] = useState<FuelInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FuelFieldErrors>({});
  const [draftFilters, setDraftFilters] = useState<FuelListFilters>(initialListFilters);
  const [appliedFilters, setAppliedFilters] = useState<FuelListFilters>(initialListFilters);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<FuelSortBy>("vehicle");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FuelRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [deletingSelectedRecords, setDeletingSelectedRecords] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<FuelFormData>(initialForm);
  const [, setAnomalyRefreshSeed] = useState(0);

  function notifyHeaderNotifications() {
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  async function loadAuxData() {
    try {
      setLoading(true);

      const [vehiclesResult, driversResult] = await Promise.allSettled([
        getVehicles(),
        getDrivers(),
      ]);

      const nextVehicles =
        vehiclesResult.status === "fulfilled" && Array.isArray(vehiclesResult.value)
          ? vehiclesResult.value
          : [];
      const nextDrivers =
        driversResult.status === "fulfilled" && Array.isArray(driversResult.value)
          ? driversResult.value
          : [];

      setVehicles(nextVehicles);
      setDrivers(nextDrivers);

      const hasCriticalFailure =
        vehiclesResult.status === "rejected" || driversResult.status === "rejected";

      if (hasCriticalFailure) {
        setPageErrorMessage("Não foi possível carregar os filtros de abastecimentos.");
      } else {
        setPageErrorMessage("");
      }
    } catch (error) {
      console.error("Erro ao carregar dados auxiliares dos abastecimentos:", error);
      setPageErrorMessage("Não foi possível carregar os filtros de abastecimentos.");
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [recordsResult, insightsResult] = await Promise.allSettled([
        getFuelRecords(),
        getFuelInsights(),
      ]);

      const nextRecords =
        recordsResult.status === "fulfilled" && Array.isArray(recordsResult.value)
          ? recordsResult.value
          : [];
      const nextInsights =
        insightsResult.status === "fulfilled" ? insightsResult.value : null;

      setRecords(nextRecords);
      setInsights(nextInsights);
      setHasLoadedData(true);

      if (recordsResult.status === "rejected") {
        setPageErrorMessage("Não foi possível carregar os abastecimentos.");
      } else if (insightsResult.status === "rejected") {
        setPageErrorMessage(
          "Os abastecimentos foram carregados, mas o painel de insights está temporariamente indisponível.",
        );
      } else {
        setPageErrorMessage("");
      }
    } catch (error) {
      console.error("Erro ao carregar abastecimentos:", error);
      setPageErrorMessage("Não foi possível carregar os abastecimentos.");
      setHasLoadedData(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuxData();
    void loadData();
  }, [selectedCompanyId]);

  useEffect(() => {
    setDraftFilters(initialListFilters);
    setAppliedFilters(initialListFilters);
    setSelectedRecordIds([]);
    setCurrentPage(1);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (location.hash !== "#deteccao-anomalias") return;
    window.setTimeout(() => {
      const element = document.getElementById("deteccao-anomalias");
      if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [location.hash, loading]);

  useEffect(() => {
    if (!pageErrorMessage) return;

    const normalized = pageErrorMessage
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const tone = /sucesso|concluid|excluid|atualizad|salv/.test(normalized)
      ? "success"
      : "error";

    showToast({
      tone,
      title: tone === "success" ? "Operação concluída" : "Atenção",
      message: pageErrorMessage,
    });
    setPageErrorMessage("");
  }, [pageErrorMessage, showToast]);

  useEffect(() => {
    function refreshAnomalies() {
      setAnomalyRefreshSeed((prev) => prev + 1);
    }

    window.addEventListener("evfleet-fuel-anomalies-updated", refreshAnomalies);
    return () => {
      window.removeEventListener("evfleet-fuel-anomalies-updated", refreshAnomalies);
    };
  }, []);

  function getBranchNameByVehicleId(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return currentCompany?.name || "Empresa";

    return (
      branches.find((branch) => branch.id === vehicle.branchId)?.name ||
      currentCompany?.name ||
      "Empresa"
    );
  }

  function getRecordBranchName(record: FuelRecord) {
    if (record.vehicle?.branch?.name) return record.vehicle.branch.name;
    return getBranchNameByVehicleId(record.vehicleId);
  }

  function getRecordDriverName(record: FuelRecord) {
    if (record.driver?.name) return record.driver.name;
    const linkedDriver = findLinkedDriverByVehicleId(drivers, record.vehicleId);
    return linkedDriver?.name || "Sem motorista";
  }

  function getRecordFuelType(record: FuelRecord) {
    const vehicle = vehicles.find((item) => item.id === record.vehicleId);
    return vehicle?.fuelType || record.fuelType || "-";
  }

  function openCreateModal() {
    setEditingRecord(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(record: FuelRecord) {
    setEditingRecord(record);
    setForm({
      invoiceNumber: record.invoiceNumber || "",
      liters: String(record.liters).replace(".", ","),
      totalValue: String(record.totalValue).replace(".", ","),
      km: String(record.km),
      fuelDate: toDateTimeLocalInput(record.fuelDate),
      fuelType: record.fuelType || "DIESEL",
      vehicleId: record.vehicleId,
      driverId: record.driverId || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingRecord(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof FuelFormData>(
    field: K,
    value: FuelFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof FuelFormData) {
    if (fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFieldErrors({});

      const payload = {
        invoiceNumber: form.invoiceNumber.trim() || null,
        liters: Number(form.liters.replace(/\./g, "").replace(",", ".")),
        totalValue: Number(form.totalValue.replace(/\./g, "").replace(",", ".")),
        km: Number(form.km),
        fuelDate: form.fuelDate,
        fuelType: form.fuelType,
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,
      };

      const selectedVehicleForPayload = vehicles.find(
        (item) => item.id === payload.vehicleId,
      );

      payload.fuelType =
        (selectedVehicleForPayload?.fuelType as FuelFormData["fuelType"]) ||
        payload.fuelType;

      const nextErrors: FuelFieldErrors = {};
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione um veículo.";
      if (!payload.fuelType) nextErrors.fuelType = "Selecione o combustível.";
      if (!payload.fuelDate) nextErrors.fuelDate = "Informe data e hora.";
      if (Number.isNaN(payload.liters) || payload.liters <= 0) {
        nextErrors.liters = "Informe os litros corretamente.";
      }
      if (Number.isNaN(payload.totalValue) || payload.totalValue <= 0) {
        nextErrors.totalValue = "Informe o valor total corretamente.";
      }
      if (Number.isNaN(payload.km) || payload.km < 0) {
        nextErrors.km = "Informe o KM corretamente.";
      }
      if (payload.invoiceNumber && payload.invoiceNumber.length > 80) {
        nextErrors.invoiceNumber = "A nota deve ter no máximo 80 caracteres.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      const branchName = getBranchNameByVehicleId(payload.vehicleId);

      const payloadWithBranch = {
        ...payload,
        fuelType: payload.fuelType as Exclude<FuelFormData["fuelType"], "">,
        station: branchName,
      };

      if (editingRecord) {
        await updateFuelRecord(editingRecord.id, payloadWithBranch);
      } else {
        await createFuelRecord(payloadWithBranch);
      }

      closeModal();
      await loadData();
      notifyHeaderNotifications();
    } catch (error: any) {
      console.error("Erro ao salvar abastecimento:", error);

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      if (Array.isArray(apiMessage)) {
        setFieldErrors((prev) => ({ ...prev, liters: apiMessage.join(", ") }));
        return;
      }

      const apiText = typeof apiMessage === "string" ? apiMessage : "";
      if (/nota/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, invoiceNumber: apiText }));
      }
      if (/litro/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, liters: "Litros inválidos." }));
      }
      if (/valor|total/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, totalValue: "Valor total inválido." }));
      }
      if (/km|odometro/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, km: "KM inválido." }));
      }
      if (/data|date/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, fuelDate: "Data inválida." }));
      }

      if (!apiText.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          liters: "Não foi possível salvar. Revise os campos.",
        }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRecord() {
    if (!recordToDelete) return;

    try {
      setDeletingRecord(true);
      setPageErrorMessage("");

      await deleteFuelRecord(recordToDelete.id);
      setRecordToDelete(null);
      await loadData();
      notifyHeaderNotifications();
    } catch (error) {
      console.error("Erro ao excluir abastecimento:", error);
      setPageErrorMessage("Não foi possível excluir o abastecimento.");
    } finally {
      setDeletingRecord(false);
    }
  }

  async function confirmDeleteSelectedRecords() {
    if (selectedRecordIds.length === 0) return;

    try {
      setDeletingSelectedRecords(true);
      setPageErrorMessage("");

      const results = await Promise.allSettled(
        selectedRecordIds.map((id) => deleteFuelRecord(id)),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failCount = results.length - successCount;

      setSelectedRecordIds([]);
      await loadData();
      notifyHeaderNotifications();

      if (failCount > 0) {
        setPageErrorMessage(
          `Exclusão parcial. Registros removidos: ${successCount}. Falhas: ${failCount}.`,
        );
        return;
      }

      setPageErrorMessage(`${successCount} abastecimento(s) excluído(s) com sucesso.`);
    } catch (error) {
      console.error("Erro ao excluir abastecimentos selecionados:", error);
      setPageErrorMessage("Não foi possível excluir os abastecimentos selecionados.");
    } finally {
      setDeletingSelectedRecords(false);
    }
  }

  const availableVehicles = useMemo(() => {
    const onlyVehicles = vehicles.filter((vehicle) => vehicle.category !== "IMPLEMENT");
    const sorted = [...onlyVehicles].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );

    if (editingRecord && form.vehicleId) {
      return sorted.filter(
        (vehicle) => vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId,
      );
    }

    return sorted.filter((vehicle) => vehicle.status === "ACTIVE");
  }, [vehicles, editingRecord, form.vehicleId]);

  const availableDrivers = useMemo(() => {
    const sorted = [...drivers].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );

    if (editingRecord && form.driverId) {
      return sorted.filter(
        (driver) => driver.status === "ACTIVE" || driver.id === form.driverId,
      );
    }

    return sorted.filter((driver) => driver.status === "ACTIVE");
  }, [drivers, editingRecord, form.driverId]);

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles, fuelRecords: records }),
    [vehicles, records],
  );

  const latestDriverIdByVehicle = useMemo(() => {
    const sortedByNewest = [...records].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.fuelDate).getTime();
      const bTime = new Date(b.createdAt || b.fuelDate).getTime();
      return bTime - aTime;
    });

    const map = new Map<string, string>();
    for (const record of sortedByNewest) {
      if (!record.driverId || !record.vehicleId) continue;
      if (map.has(record.vehicleId)) continue;

      const driver = drivers.find((item) => item.id === record.driverId);
      if (!driver || driver.status !== "ACTIVE") continue;

      map.set(record.vehicleId, record.driverId);
    }

    return map;
  }, [records, drivers]);

  function handleVehicleChange(vehicleId: string) {
    if (editingRecord) {
      handleChange("vehicleId", vehicleId);
      return;
    }
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    const latestKm = latestKmByVehicle.get(vehicleId);
    const latestDriverId = latestDriverIdByVehicle.get(vehicleId) || "";

    setForm((prev) => ({
      ...prev,
      vehicleId,
      km: typeof latestKm === "number" ? String(latestKm) : "",
      fuelType: selectedVehicle?.fuelType || prev.fuelType,
      driverId: latestDriverId,
    }));
    setFieldErrors((prev) => ({
      ...prev,
      vehicleId: undefined,
      km: undefined,
      driverId: undefined,
    }));
  }

  function handleFilterChange<K extends keyof FuelListFilters>(
    field: K,
    value: FuelListFilters[K],
  ) {
    setDraftFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
    setSelectedRecordIds([]);
  }

  function handleClearFilters() {
    setDraftFilters(initialListFilters);
    setAppliedFilters(initialListFilters);
    setSelectedRecordIds([]);
    setCurrentPage(1);
  }

  const filteredVehicles = useMemo(() => {
    const onlyVehicles = vehicles.filter((vehicle) => vehicle.category !== "IMPLEMENT");
    return onlyVehicles.filter((vehicle) => {
      return includesInCsv(draftFilters.branchId, vehicle.branchId);
    });
  }, [vehicles, draftFilters.branchId]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      if (!includesInCsv(draftFilters.vehicleId, driver.vehicleId)) return false;

      if (draftFilters.branchId) {
        const vehicle = vehicles.find((item) => item.id === driver.vehicleId);
        if (!includesInCsv(draftFilters.branchId, vehicle?.branchId)) return false;
      }

      return true;
    });
  }, [drivers, draftFilters.branchId, draftFilters.vehicleId, vehicles]);

  const branchOptions: SelectOption[] = useMemo(
    () =>
      branches.map((branch) => ({
        id: branch.id,
        label: branch.name,
      })),
    [branches],
  );

  const vehicleFilterOptions: SelectOption[] = useMemo(
    () =>
      filteredVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: formatVehicleLabel(vehicle),
      })),
    [filteredVehicles],
  );

  const driverFilterOptions: SelectOption[] = useMemo(
    () =>
      filteredDrivers.map((driver) => ({
        id: driver.id,
        label: driver.name,
      })),
    [filteredDrivers],
  );

  const fuelTypeOptions: SelectOption[] = [
    { id: "DIESEL", label: "Diesel" },
    { id: "ARLA32", label: "ARLA 32" },
    { id: "GASOLINE", label: "Gasolina" },
    { id: "ETHANOL", label: "Etanol" },
    { id: "FLEX", label: "Flex" },
    { id: "ELECTRIC", label: "Elétrico" },
    { id: "HYBRID", label: "Híbrido" },
    { id: "CNG", label: "GNV" },
  ];

  const anomalyStatusOptions: SelectOption[] = [
    { id: "WITH_ANOMALY", label: "Com anomalia" },
    { id: "WITHOUT_ANOMALY", label: "Sem anomalia" },
  ];

  const baseFilteredRecords = useMemo(() => {
    if (!hasLoadedData) return [];

    return records.filter((record) => {
      const vehicle = vehicles.find((item) => item.id === record.vehicleId);
      const invoiceNumber = String(record.invoiceNumber || "").toLowerCase();
      const recordDateValue = new Date(record.fuelDate).getTime();

      if (!includesInCsv(appliedFilters.branchId, vehicle?.branchId)) return false;
      if (!includesInCsv(appliedFilters.vehicleId, record.vehicleId)) return false;
      if (!includesInCsv(appliedFilters.driverId, record.driverId)) return false;
      if (!includesInCsv(appliedFilters.fuelType, getRecordFuelType(record))) return false;

      if (
        appliedFilters.invoiceNumber &&
        !invoiceNumber.includes(appliedFilters.invoiceNumber.toLowerCase())
      ) {
        return false;
      }

      if (appliedFilters.startDate) {
        const startDateValue = new Date(appliedFilters.startDate).getTime();
        if (!Number.isNaN(startDateValue) && recordDateValue < startDateValue) {
          return false;
        }
      }

      if (appliedFilters.endDate) {
        const endDateValue = new Date(appliedFilters.endDate).getTime();
        if (!Number.isNaN(endDateValue) && recordDateValue > endDateValue) {
          return false;
        }
      }

      return true;
    });
  }, [records, vehicles, appliedFilters, hasLoadedData]);

  const anomalyMapByRecordId = useMemo(() => {
    return baseFilteredRecords.reduce<
      Record<
        string,
        {
          id: string;
          vehicle: string;
          reason: string;
          date: string;
          driver: string;
        }
      >
    >((acc, record) => {
      const avg = record.averageConsumptionKmPerLiter;

      if (typeof avg !== "number") return acc;

      if (avg < 3 || avg > 20) {
        acc[record.id] = {
          id: record.id,
          vehicle: record.vehicle ? formatVehicleLabel(record.vehicle) : record.vehicleId,
          reason: `Consumo fora do padrão (${avg.toFixed(2)} km/L)`,
          date: record.fuelDate,
          driver: getRecordDriverName(record),
        };
      }

      return acc;
    }, {});
  }, [baseFilteredRecords, drivers]);

  const filteredRecords = useMemo(() => {
    let filtered = [...baseFilteredRecords];

    const anomalyStatuses = splitCsv(appliedFilters.anomalyStatus);
    if (anomalyStatuses.length > 0) {
      filtered = filtered.filter((record) => {
        const hasAnomaly = Boolean(anomalyMapByRecordId[record.id]);
        if (anomalyStatuses.includes("WITH_ANOMALY") && hasAnomaly) return true;
        if (anomalyStatuses.includes("WITHOUT_ANOMALY") && !hasAnomaly) return true;
        return false;
      });
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === "branch") {
        return (
          getRecordBranchName(a).localeCompare(getRecordBranchName(b), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }
      if (sortBy === "driver") {
        return (
          getRecordDriverName(a).localeCompare(getRecordDriverName(b), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }
      if (sortBy === "fuelDate") {
        return (new Date(a.fuelDate).getTime() - new Date(b.fuelDate).getTime()) * direction;
      }
      if (sortBy === "invoiceNumber") {
        return (
          String(a.invoiceNumber || "").localeCompare(String(b.invoiceNumber || ""), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }
      if (sortBy === "fuelType") {
        return getRecordFuelType(a).localeCompare(getRecordFuelType(b), "pt-BR") * direction;
      }
      if (sortBy === "liters") return (a.liters - b.liters) * direction;
      if (sortBy === "totalValue") return (a.totalValue - b.totalValue) * direction;
      if (sortBy === "km") return (a.km - b.km) * direction;
      if (sortBy === "avgConsumption") {
        const aHasValue = typeof a.averageConsumptionKmPerLiter === "number";
        const bHasValue = typeof b.averageConsumptionKmPerLiter === "number";

        if (!aHasValue && !bHasValue) return 0;
        if (!aHasValue) return 1;
        if (!bHasValue) return -1;

        return (
          ((a.averageConsumptionKmPerLiter as number) -
            (b.averageConsumptionKmPerLiter as number)) * direction
        );
      }

      const plateA = a.vehicle?.plate || "";
      const plateB = b.vehicle?.plate || "";
      return plateA.localeCompare(plateB, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [
    baseFilteredRecords,
    anomalyMapByRecordId,
    appliedFilters.anomalyStatus,
    sortBy,
    sortDirection,
    drivers,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecords.length / TABLE_PAGE_SIZE)),
    [filteredRecords.length],
  );

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredRecords.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  const selectedRecordIdsSet = useMemo(
    () => new Set(selectedRecordIds),
    [selectedRecordIds],
  );

  const allPageSelected =
    paginatedRecords.length > 0 &&
    paginatedRecords.every((record) => selectedRecordIdsSet.has(record.id));

  const somePageSelected =
    paginatedRecords.some((record) => selectedRecordIdsSet.has(record.id)) &&
    !allPageSelected;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, sortBy, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const validIds = new Set(filteredRecords.map((record) => record.id));
    setSelectedRecordIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredRecords]);

  const detectedAnomalies = useMemo(
    () => Object.values(anomalyMapByRecordId),
    [anomalyMapByRecordId],
  );

  const summary = useMemo(() => {
    const totalLiters = filteredRecords.reduce((sum, record) => sum + (record.liters || 0), 0);
    const totalValue = filteredRecords.reduce((sum, record) => sum + (record.totalValue || 0), 0);
    const anomalyCount = detectedAnomalies.length;

    return {
      total: filteredRecords.length,
      liters: totalLiters,
      totalValue,
      anomalies: anomalyCount,
      normal: Math.max(filteredRecords.length - anomalyCount, 0),
    };
  }, [filteredRecords, detectedAnomalies]);

  async function handleConfirmAnomaly(recordId: string) {
    try {
      await acknowledgeFuelRecordAnomaly(recordId);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-fuel-anomalies-updated"));
      notifyHeaderNotifications();
    } catch {
      setPageErrorMessage("Não foi possível marcar a anomalia como conferida.");
    }
  }

  function handleSort(column: FuelSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: FuelSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function toggleRecordSelection(recordId: string) {
    setSelectedRecordIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId],
    );
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      const pageIds = new Set(paginatedRecords.map((record) => record.id));
      setSelectedRecordIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(selectedRecordIds);
    paginatedRecords.forEach((record) => next.add(record.id));
    setSelectedRecordIds(Array.from(next));
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abastecimentos</h1>
          <p className="text-sm text-slate-500">
            Gerencie os registros de abastecimento da frota
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <FuelXmlImportButton
            onImported={async () => {
              await loadData();
              notifyHeaderNotifications();
              window.dispatchEvent(new CustomEvent("evfleet-dashboard-updated"));
              window.dispatchEvent(new CustomEvent("evfleet-fuel-anomalies-updated"));
            }}
          />
          <button
            onClick={openCreateModal}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
          >
            + Cadastrar abastecimento
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Litros</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {summary.liters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Valor total
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {summary.totalValue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
            Anomalias
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-800">{summary.anomalies}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form onSubmit={handleSearchSubmit} className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Empresa</span>
              <input
                value={currentCompany?.name || ""}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              />
            </label>

            <CompactMultiSelectField
              label="Filiais"
              options={branchOptions}
              selectedIds={splitCsv(draftFilters.branchId)}
              onChange={(value) => handleFilterChange("branchId", value.join(","))}
              placeholder="Selecione as filiais"
            />

            <CompactMultiSelectField
              label="Veículos"
              options={vehicleFilterOptions}
              selectedIds={splitCsv(draftFilters.vehicleId)}
              onChange={(value) => handleFilterChange("vehicleId", value.join(","))}
              placeholder="Selecione os veículos"
            />

            <CompactMultiSelectField
              label="Motoristas"
              options={driverFilterOptions}
              selectedIds={splitCsv(draftFilters.driverId)}
              onChange={(value) => handleFilterChange("driverId", value.join(","))}
              placeholder="Selecione os motoristas"
            />

            <CompactMultiSelectField
              label="Combustível"
              options={fuelTypeOptions}
              selectedIds={splitCsv(draftFilters.fuelType)}
              onChange={(value) => handleFilterChange("fuelType", value.join(","))}
              placeholder="Selecione os combustíveis"
            />

            <CompactMultiSelectField
              label="Situação"
              options={anomalyStatusOptions}
              selectedIds={splitCsv(draftFilters.anomalyStatus)}
              onChange={(value) => handleFilterChange("anomalyStatus", value.join(","))}
              placeholder="Selecione a situação"
            />

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nota</span>
              <input
                value={draftFilters.invoiceNumber}
                onChange={(e) => handleFilterChange("invoiceNumber", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Data inicial</span>
              <input
                type="datetime-local"
                value={draftFilters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Data final</span>
              <input
                type="datetime-local"
                value={draftFilters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
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
              type="submit"
              disabled={loading}
              className="btn-ui btn-ui-primary"
            >
              {loading ? "Atualizando..." : "Consultar"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedRecordIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedRecordIds.length} abastecimento(s) selecionado(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordIds([])}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  disabled={deletingSelectedRecords}
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingSelectedRecords ? "Excluindo..." : "Excluir selecionados"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {hasLoadedData
                  ? `${filteredRecords.length} abastecimento(s) encontrado(s).`
                  : "Nenhum resultado carregado ainda."}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectAllPage}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                    aria-label="Selecionar abastecimentos da página"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("branch")} className="cursor-pointer">
                    Filial {getSortArrow("branch")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">
                    Veículo {getSortArrow("vehicle")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("driver")} className="cursor-pointer">
                    Motorista {getSortArrow("driver")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("fuelDate")} className="cursor-pointer">
                    Data e Hora {getSortArrow("fuelDate")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("fuelType")} className="cursor-pointer">
                    Combustível {getSortArrow("fuelType")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("liters")} className="cursor-pointer">
                    Litros {getSortArrow("liters")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("totalValue")} className="cursor-pointer">
                    Valor total {getSortArrow("totalValue")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("km")} className="cursor-pointer">
                    KM {getSortArrow("km")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("avgConsumption")} className="cursor-pointer">
                    Consumo médio {getSortArrow("avgConsumption")}
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
                  <td colSpan={11} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando abastecimentos...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum abastecimento encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="border-t border-slate-200">
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedRecordIdsSet.has(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300"
                        aria-label={`Selecionar abastecimento ${record.id}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getRecordBranchName(record)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.vehicle ? formatVehicleLabel(record.vehicle) : record.vehicleId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getRecordDriverName(record)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatLocalDate(record.fuelDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatFuelTypeLabel(getRecordFuelType(record))}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.liters.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {record.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{record.km}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.averageConsumptionKmPerLiter
                        ? `${record.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} km/L`
                        : "-"}
                      {anomalyMapByRecordId[record.id] ? (
                        <span className="status-pill status-anomaly ml-2">Anomalia</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(record)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setRecordToDelete(record)}
                          className="btn-ui btn-ui-danger"
                        >
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

        {!loading && filteredRecords.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRecords.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="abastecimentos"
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
                  {editingRecord ? "Editar abastecimento" : "Cadastrar abastecimento"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha as informações do abastecimento
                </p>
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
                  <label className="block text-sm font-medium text-slate-700">Veículo</label>
                  <select
                    value={form.vehicleId}
                    onChange={(e) => handleVehicleChange(e.target.value)}
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

                <div>
                  <label className="block text-sm font-medium text-slate-700">Motorista</label>
                  <select
                    value={form.driverId}
                    onChange={(e) => handleChange("driverId", e.target.value)}
                    className={inputClass("driverId")}
                  >
                    <option value="">Selecione um motorista</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.driverId ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.driverId}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Tipo de combustível
                  </label>
                  <select
                    value={form.fuelType}
                    onChange={(e) =>
                      handleChange("fuelType", e.target.value as FuelFormData["fuelType"])
                    }
                    className={inputClass("fuelType")}
                  >
                    <option value="">Selecione um combustível</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="ARLA32">ARLA 32</option>
                    <option value="GASOLINE">Gasolina</option>
                    <option value="ETHANOL">Etanol</option>
                    <option value="FLEX">Flex</option>
                    <option value="ELECTRIC">Elétrico</option>
                    <option value="HYBRID">Híbrido</option>
                    <option value="CNG">GNV</option>
                  </select>
                  {fieldErrors.fuelType ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.fuelType}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Nota</label>
                  <input
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) =>
                      handleChange("invoiceNumber", e.target.value.toUpperCase())
                    }
                    className={inputClass("invoiceNumber")}
                    placeholder="Ex: 123456"
                  />
                  {fieldErrors.invoiceNumber ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.invoiceNumber}</p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Filial (automática)
                  </label>
                  <input
                    type="text"
                    value={form.vehicleId ? getBranchNameByVehicleId(form.vehicleId) : ""}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-700 outline-none"
                    placeholder="Selecione um veículo para identificar a filial"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Litros</label>
                  <input
                    type="text"
                    value={form.liters}
                    onChange={(e) =>
                      handleChange("liters", e.target.value.replace(/[^0-9,\\.]/g, ""))
                    }
                    className={inputClass("liters")}
                    placeholder="0,00"
                  />
                  {fieldErrors.liters ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.liters}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Valor total
                  </label>
                  <input
                    type="text"
                    value={form.totalValue}
                    onChange={(e) =>
                      handleChange("totalValue", formatMoney(e.target.value))
                    }
                    className={inputClass("totalValue")}
                    placeholder="0,00"
                  />
                  {fieldErrors.totalValue ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.totalValue}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">KM</label>
                  <input
                    type="number"
                    min="0"
                    value={form.km}
                    onChange={(e) => handleChange("km", e.target.value)}
                    className={inputClass("km")}
                    placeholder="50000"
                  />
                  {fieldErrors.km ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.km}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Data e Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fuelDate}
                    onChange={(e) => handleChange("fuelDate", e.target.value)}
                    className={inputClass("fuelDate")}
                  />
                  {fieldErrors.fuelDate ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.fuelDate}</p>
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
                  {saving
                    ? "Salvando..."
                    : editingRecord
                      ? "Salvar alterações"
                      : "Cadastrar abastecimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {hasLoadedData && insights ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Comparação entre veículos
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Custos e eficiência de consumo por veículo.
                </p>
              </div>
              <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                <CarFront size={16} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {insights.comparison.slice(0, 5).map((item) => (
                <div
                  key={item.vehicleId}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      <Gauge size={12} />
                      {item.averageConsumptionKmPerLiter
                        ? `${item.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} km/L`
                        : "Sem consumo médio"}
                    </span>
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {item.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="deteccao-anomalias"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Detecção de anomalias
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {detectedAnomalies.length} anomalia(s) detectada(s).
                </p>
              </div>
              <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {detectedAnomalies.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Nenhuma anomalia no momento.
                </div>
              ) : (
                detectedAnomalies.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800"
                  >
                    <p className="font-semibold">{item.vehicle}</p>
                    <p className="mt-1">{item.reason}</p>
                    <p className="mt-1 text-xs">
                      {formatLocalDate(item.date)} - {item.driver}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConfirmAnomaly(item.id)}
                      className="btn-ui btn-ui-neutral mt-2"
                    >
                      Conferido
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir abastecimento"
        description={
          recordToDelete
            ? `Deseja excluir o abastecimento da filial ${getRecordBranchName(recordToDelete)}?`
            : ""
        }
        loading={deletingRecord}
        onCancel={() => setRecordToDelete(null)}
        onConfirm={confirmDeleteRecord}
      />

      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        title="Excluir abastecimentos selecionados"
        description={`Deseja excluir ${selectedRecordIds.length} abastecimento(s) selecionado(s)?`}
        loading={deletingSelectedRecords}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={async () => {
          await confirmDeleteSelectedRecords();
          setIsBulkDeleteModalOpen(false);
        }}
      />
    </div>
  );
}