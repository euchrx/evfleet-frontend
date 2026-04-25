import { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle } from "lucide-react";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { FuelXmlImportButton } from "../../components/FuelXmlImportButton";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import { FuelRecordsTablesSection } from "./FuelRecordsTablesSection";

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

export function FuelRecordsPage() {
  const location = useLocation();
  const { branches } = useBranch();
  const { selectedCompanyId, currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [, setInsights] = useState<FuelInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FuelFieldErrors>({});
  const [draftFilters, setDraftFilters] =
    useState<FuelListFilters>(initialListFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FuelListFilters>(initialListFilters);
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
        setFieldErrors((prev) => ({
          ...prev,
          totalValue: "Valor total inválido.",
        }));
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
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
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

      setPageErrorMessage(
        `${successCount} abastecimento(s) excluído(s) com sucesso.`,
      );
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
      if (!includesInCsv(appliedFilters.fuelType, getRecordFuelType(record))) {
        return false;
      }

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
        return (
          (new Date(a.fuelDate).getTime() - new Date(b.fuelDate).getTime()) *
          direction
        );
      }

      if (sortBy === "invoiceNumber") {
        return (
          String(a.invoiceNumber || "").localeCompare(
            String(b.invoiceNumber || ""),
            "pt-BR",
            { sensitivity: "base" },
          ) * direction
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
            (b.averageConsumptionKmPerLiter as number)) *
          direction
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
    const totalLiters = filteredRecords.reduce(
      (sum, record) => sum + (record.liters || 0),
      0,
    );
    const totalValue = filteredRecords.reduce(
      (sum, record) => sum + (record.totalValue || 0),
      0,
    );
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
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId],
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
            }}
          />

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-ui btn-ui-primary"
          >
            Novo abastecimento
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totais
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Litros abastecidos
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">
            {summary.liters.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div
          id="deteccao-anomalias"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Anomalias
          </p>
          <p className="mt-1 text-2xl font-bold text-red-900">
            {summary.anomalies}
          </p>
        </div>
      </div>

      <FuelRecordsTablesSection
        currentCompanyName={currentCompany?.name}
        loading={loading}
        hasLoadedData={hasLoadedData}
        draftFilters={draftFilters}
        vehicleFilterOptions={vehicleFilterOptions}
        driverFilterOptions={driverFilterOptions}
        fuelTypeOptions={fuelTypeOptions}
        anomalyStatusOptions={anomalyStatusOptions}
        filteredRecords={filteredRecords}
        paginatedRecords={paginatedRecords}
        selectedRecordIds={selectedRecordIds}
        selectedRecordIdsSet={selectedRecordIdsSet}
        allPageSelected={allPageSelected}
        somePageSelected={somePageSelected}
        deletingSelectedRecords={deletingSelectedRecords}
        currentPage={currentPage}
        totalPages={totalPages}
        tablePageSize={TABLE_PAGE_SIZE}
        anomalyMapByRecordId={anomalyMapByRecordId}
        onFilterChange={handleFilterChange}
        onSearchSubmit={handleSearchSubmit}
        onClearFilters={handleClearFilters}
        onClearSelectedRecords={() => setSelectedRecordIds([])}
        onOpenBulkDeleteModal={() => setIsBulkDeleteModalOpen(true)}
        onToggleSelectAllPage={toggleSelectAllPage}
        onToggleRecordSelection={toggleRecordSelection}
        onSort={handleSort}
        getSortArrow={getSortArrow}
        getRecordBranchName={getRecordBranchName}
        getRecordDriverName={getRecordDriverName}
        getRecordFuelType={getRecordFuelType}
        formatLocalDate={formatLocalDate}
        onOpenEditModal={openEditModal}
        onSetRecordToDelete={setRecordToDelete}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      />

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRecord ? "Editar abastecimento" : "Novo abastecimento"}
              </h2>
              <p className="text-sm text-slate-500">
                Informe os dados do abastecimento realizado.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Veículo
                </span>
                <select
                  value={form.vehicleId}
                  onChange={(event) => handleVehicleChange(event.target.value)}
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
                  <p className="text-xs text-red-600">{fieldErrors.vehicleId}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Motorista
                </span>
                <select
                  value={form.driverId}
                  onChange={(event) => handleChange("driverId", event.target.value)}
                  className={inputClass("driverId")}
                >
                  <option value="">Sem motorista</option>
                  {availableDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.driverId ? (
                  <p className="text-xs text-red-600">{fieldErrors.driverId}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Combustível
                </span>
                <select
                  value={form.fuelType}
                  onChange={(event) =>
                    handleChange("fuelType", event.target.value as FuelFormData["fuelType"])
                  }
                  className={inputClass("fuelType")}
                >
                  <option value="">Selecione</option>
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
                  <p className="text-xs text-red-600">{fieldErrors.fuelType}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Data e hora
                </span>
                <input
                  type="datetime-local"
                  value={form.fuelDate}
                  onChange={(event) => handleChange("fuelDate", event.target.value)}
                  className={inputClass("fuelDate")}
                />
                {fieldErrors.fuelDate ? (
                  <p className="text-xs text-red-600">{fieldErrors.fuelDate}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Litros
                </span>
                <input
                  value={form.liters}
                  onChange={(event) => handleChange("liters", event.target.value)}
                  className={inputClass("liters")}
                  placeholder="0,00"
                />
                {fieldErrors.liters ? (
                  <p className="text-xs text-red-600">{fieldErrors.liters}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Valor total
                </span>
                <input
                  value={form.totalValue}
                  onChange={(event) =>
                    handleChange("totalValue", formatMoney(event.target.value))
                  }
                  className={inputClass("totalValue")}
                  placeholder="0,00"
                />
                {fieldErrors.totalValue ? (
                  <p className="text-xs text-red-600">{fieldErrors.totalValue}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">KM</span>
                <input
                  value={form.km}
                  onChange={(event) => handleChange("km", event.target.value)}
                  className={inputClass("km")}
                  placeholder="0"
                />
                {fieldErrors.km ? (
                  <p className="text-xs text-red-600">{fieldErrors.km}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Nota fiscal
                </span>
                <input
                  value={form.invoiceNumber}
                  onChange={(event) =>
                    handleChange("invoiceNumber", event.target.value)
                  }
                  className={inputClass("invoiceNumber")}
                  placeholder="Número da nota"
                />
                {fieldErrors.invoiceNumber ? (
                  <p className="text-xs text-red-600">{fieldErrors.invoiceNumber}</p>
                ) : null}
              </label>

              <div className="mt-4 flex justify-end gap-2 md:col-span-2">
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
                  className="btn-ui btn-ui-primary"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Detecção de anomalias
            </h2>
            <p className="text-sm text-slate-500">
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

      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir abastecimento"
        description={
          recordToDelete
            ? `Deseja excluir o abastecimento da filial ${getRecordBranchName(
              recordToDelete,
            )}?`
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