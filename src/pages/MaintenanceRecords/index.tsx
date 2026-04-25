import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import {
  fetchMenuVisibilityMap,
  getCachedMenuVisibilityMap,
  type MenuVisibilityMap,
} from "../../services/menuVisibility";
import {
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecords,
  updateMaintenanceRecord,
} from "../../services/maintenanceRecords";
import {
  createMaintenancePlan,
  deleteMaintenancePlan,
  getMaintenancePlans,
  updateMaintenancePlan,
  type CreateMaintenancePlanInput,
} from "../../services/maintenancePlans";
import {
  MaintenanceRecordFormModal,
  initialMaintenanceRecordForm,
  maintenanceRecordToForm,
  type MaintenanceRecordFieldErrors,
  type MaintenanceRecordFormData,
} from "./MaintenanceFormModal";
import { getVehicles } from "../../services/vehicles";
import type { MaintenancePlan } from "../../types/maintenance-plan";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import {
  MaintenanceRecordsTablesSection,
  type MaintenanceFilters,
  type PlanSortBy,
  type RecordSortBy,
  type SelectOption,
  type SortDirection,
  type Tab,
} from "./MaintenanceRecordsTablesSection";

type PlanFormState = {
  vehicleId: string;
  name: string;
  planType: "PREVENTIVE" | "PERIODIC" | "";
  intervalUnit: "DAY" | "MONTH" | "KM" | "";
  intervalValue: string;
  alertBeforeDays: string;
  alertBeforeKm: string;
  nextDueDate: string;
  nextDueKm: string;
  active: boolean | "";
  notes: string;
};

const TABLE_PAGE_SIZE = 10;

const initialPlanForm: PlanFormState = {
  vehicleId: "",
  name: "",
  planType: "",
  intervalUnit: "",
  intervalValue: "",
  alertBeforeDays: "",
  alertBeforeKm: "",
  nextDueDate: "",
  nextDueKm: "",
  active: "",
  notes: "",
};

const initialFilters: MaintenanceFilters = {
  vehicleId: "",
  recordType: "",
  recordStatus: "",
  planStatus: "",
  startDate: "",
  endDate: "",
};

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

function parseDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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

function toMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function maintenanceTypeLabel(value: string) {
  if (value === "PREVENTIVE") return "Preventiva";
  if (value === "CORRECTIVE") return "Corretiva";
  if (value === "PERIODIC") return "Periódica";
  return value || "-";
}

function maintenanceStatusLabel(value: string) {
  return value === "DONE" ? "Concluída" : "Pendente";
}

function planIntervalLabel(plan: MaintenancePlan) {
  if (plan.intervalUnit === "KM") {
    return `${plan.intervalValue.toLocaleString("pt-BR")} km`;
  }

  if (plan.intervalUnit === "MONTH") return `${plan.intervalValue} mês(es)`;
  if (plan.intervalUnit === "DAY") return `${plan.intervalValue} dia(s)`;

  return "-";
}

function isDateInRange(
  value: string | null | undefined,
  startDate: string,
  endDate: string,
) {
  const date = parseDate(value);
  if (!date) return false;

  if (startDate) {
    const start = parseDate(startDate);
    if (start && date < start) return false;
  }

  if (endDate) {
    const end = parseDate(endDate);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
  }

  return true;
}

function hasActiveFilters(filters: MaintenanceFilters) {
  return Boolean(
    filters.vehicleId ||
    filters.startDate ||
    filters.endDate ||
    filters.recordType ||
    filters.recordStatus ||
    filters.planStatus,
  );
}

export function MaintenanceRecordsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedBranchId } = useBranch();
  const { selectedCompanyId, currentCompany } = useCompanyScope();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const contextVehicleId = query.get("vehicleId") || "";
  const contextHighlightId = query.get("highlight") || "";
  const incomingTab = query.get("tab");

  const [loading, setLoading] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityMap>(() =>
    getCachedMenuVisibilityMap(),
  );
  const [tab, setTab] = useState<Tab>("records");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [draftFilters, setDraftFilters] = useState<MaintenanceFilters>({
    ...initialFilters,
    vehicleId: contextVehicleId || "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MaintenanceFilters>({
    ...initialFilters,
    vehicleId: contextVehicleId || "",
  });
  const [recordSortBy, setRecordSortBy] = useState<RecordSortBy>("date");
  const [recordSortDirection, setRecordSortDirection] =
    useState<SortDirection>("desc");
  const [planSortBy, setPlanSortBy] = useState<PlanSortBy>("due");
  const [planSortDirection, setPlanSortDirection] = useState<SortDirection>("asc");
  const [recordPage, setRecordPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(
    null,
  );
  const [planToDelete, setPlanToDelete] = useState<MaintenancePlan | null>(null);
  const [bulkDeleteRecordsOpen, setBulkDeleteRecordsOpen] = useState(false);
  const [quickStatusRecordId, setQuickStatusRecordId] = useState<string | null>(
    null,
  );
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [recordForm, setRecordForm] = useState<MaintenanceRecordFormData>(
    initialMaintenanceRecordForm(contextVehicleId),
  );
  const [recordFieldErrors, setRecordFieldErrors] =
    useState<MaintenanceRecordFieldErrors>({});

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [visibilityResult, vehiclesResult, recordsResult, plansResult] =
        await Promise.allSettled([
          fetchMenuVisibilityMap(),
          getVehicles(),
          getMaintenanceRecords(),
          getMaintenancePlans(),
        ]);

      if (visibilityResult.status === "fulfilled") {
        setMenuVisibility(visibilityResult.value);
      }

      setVehicles(
        vehiclesResult.status === "fulfilled" && Array.isArray(vehiclesResult.value)
          ? vehiclesResult.value
          : [],
      );

      setRecords(
        recordsResult.status === "fulfilled" && Array.isArray(recordsResult.value)
          ? recordsResult.value
          : [],
      );

      setPlans(
        plansResult.status === "fulfilled" && Array.isArray(plansResult.value)
          ? plansResult.value
          : [],
      );

      setHasLoadedData(true);

      const hasFailure =
        visibilityResult.status === "rejected" ||
        vehiclesResult.status === "rejected" ||
        recordsResult.status === "rejected" ||
        plansResult.status === "rejected";

      if (hasFailure) {
        setErrorMessage("Não foi possível carregar todos os dados de manutenções.");
      }
    } catch {
      setErrorMessage("Não foi possível carregar o módulo de manutenções.");
      setHasLoadedData(true);
    } finally {
      setLoading(false);
    }
  }

  function handleConsult(event?: React.FormEvent) {
    event?.preventDefault();

    setConsulting(true);
    setErrorMessage("");
    setAppliedFilters(draftFilters);
    setSelectedRecordIds([]);
    setRecordPage(1);
    setPlanPage(1);

    window.setTimeout(() => {
      setConsulting(false);
    }, 0);
  }

  function handleClearFilters() {
    const clearedFilters: MaintenanceFilters = {
      ...initialFilters,
      vehicleId: contextVehicleId || "",
    };

    setDraftFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setSelectedRecordIds([]);
    setRecordPage(1);
    setPlanPage(1);
    setErrorMessage("");
  }

  useEffect(() => {
    void loadData();
  }, [selectedCompanyId]);

  useEffect(() => {
    const nextFilters = {
      ...initialFilters,
      vehicleId: contextVehicleId || "",
    };

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSelectedRecordIds([]);
    setRecordPage(1);
    setPlanPage(1);
  }, [selectedCompanyId, contextVehicleId]);

  useEffect(() => {
    if (incomingTab === "plans" && menuVisibility["/maintenance-records::plans"] !== false) {
      setTab("plans");
      return;
    }

    setTab("records");
  }, [incomingTab, menuVisibility]);

  useEffect(() => {
    if (!contextHighlightId) return;

    setHighlightId(contextHighlightId);

    const timer = window.setTimeout(() => {
      document.getElementById(`maintenance-row-${contextHighlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [contextHighlightId]);

  useEffect(() => {
    if (!highlightId) return;

    const clear = () => setHighlightId(null);

    document.addEventListener("pointerdown", clear, { passive: true });
    document.addEventListener("keydown", clear);

    return () => {
      document.removeEventListener("pointerdown", clear);
      document.removeEventListener("keydown", clear);
    };
  }, [highlightId]);

  useEffect(() => {
    setRecordPage(1);
  }, [recordSortBy, recordSortDirection, appliedFilters, selectedBranchId]);

  useEffect(() => {
    setPlanPage(1);
  }, [planSortBy, planSortDirection, appliedFilters, selectedBranchId]);

  const visibleTabs = useMemo(
    () => ({
      records: menuVisibility["/maintenance-records::records"] !== false,
      plans: menuVisibility["/maintenance-records::plans"] !== false,
    }),
    [menuVisibility],
  );

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );

  const scopedVehicles = useMemo(() => {
    let filtered = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;

    if (contextVehicleId) {
      filtered = filtered.filter((vehicle) => vehicle.id === contextVehicleId);
    }

    return [...filtered].sort((a, b) =>
      formatVehicleLabel(a).localeCompare(formatVehicleLabel(b), "pt-BR", {
        sensitivity: "base",
      }),
    );
  }, [contextVehicleId, selectedBranchId, vehicles]);

  const vehicleFilterOptions: SelectOption[] = useMemo(
    () =>
      scopedVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: formatVehicleLabel(vehicle),
      })),
    [scopedVehicles],
  );

  const recordTypeOptions: SelectOption[] = [
    { id: "PREVENTIVE", label: "Preventiva" },
    { id: "CORRECTIVE", label: "Corretiva" },
    { id: "PERIODIC", label: "Periódica" },
  ];

  const recordStatusOptions: SelectOption[] = [
    { id: "OPEN", label: "Pendente" },
    { id: "DONE", label: "Concluída" },
  ];

  const planStatusOptions: SelectOption[] = [
    { id: "ACTIVE", label: "Ativo" },
    { id: "INACTIVE", label: "Inativo" },
  ];

  const scopedRecords = useMemo(() => {
    if (!hasLoadedData) return [];

    let filtered = selectedBranchId
      ? records.filter((record) => {
        const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
        return vehicle?.branchId === selectedBranchId;
      })
      : records;

    filtered = filtered.filter((record) => {
      if (!includesInCsv(appliedFilters.vehicleId, record.vehicleId)) return false;
      if (!includesInCsv(appliedFilters.recordType, record.type)) return false;
      if (!includesInCsv(appliedFilters.recordStatus, record.status)) return false;

      if (appliedFilters.startDate || appliedFilters.endDate) {
        return isDateInRange(
          record.maintenanceDate,
          appliedFilters.startDate,
          appliedFilters.endDate,
        );
      }

      return true;
    });

    const direction = recordSortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const vehicleA = a.vehicle || vehicleMap.get(a.vehicleId);
      const vehicleB = b.vehicle || vehicleMap.get(b.vehicleId);

      if (recordSortBy === "date") {
        return (
          ((parseDate(a.maintenanceDate)?.getTime() || 0) -
            (parseDate(b.maintenanceDate)?.getTime() || 0)) *
          direction
        );
      }

      if (recordSortBy === "vehicle") {
        const labelA = vehicleA ? formatVehicleLabel(vehicleA) : "";
        const labelB = vehicleB ? formatVehicleLabel(vehicleB) : "";

        return (
          labelA.localeCompare(labelB, "pt-BR", { sensitivity: "base" }) *
          direction
        );
      }

      if (recordSortBy === "type") {
        return (
          maintenanceTypeLabel(a.type).localeCompare(
            maintenanceTypeLabel(b.type),
            "pt-BR",
          ) * direction
        );
      }

      if (recordSortBy === "km") return ((a.km || 0) - (b.km || 0)) * direction;
      if (recordSortBy === "cost") {
        return ((a.cost || 0) - (b.cost || 0)) * direction;
      }

      return (
        maintenanceStatusLabel(a.status).localeCompare(
          maintenanceStatusLabel(b.status),
          "pt-BR",
        ) * direction
      );
    });
  }, [
    appliedFilters,
    hasLoadedData,
    recordSortBy,
    recordSortDirection,
    records,
    selectedBranchId,
    vehicleMap,
  ]);

  const scopedPlans = useMemo(() => {
    if (!hasLoadedData) return [];

    let filtered = selectedBranchId
      ? plans.filter((plan) => {
        const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);
        return vehicle?.branchId === selectedBranchId;
      })
      : plans;

    filtered = filtered.filter((plan) => {
      if (!includesInCsv(appliedFilters.vehicleId, plan.vehicleId)) return false;
      if (!includesInCsv(appliedFilters.recordType, plan.planType)) return false;
      if (!includesInCsv(appliedFilters.planStatus, plan.active ? "ACTIVE" : "INACTIVE")) {
        return false;
      }

      if (appliedFilters.startDate || appliedFilters.endDate) {
        return isDateInRange(
          plan.nextDueDate,
          appliedFilters.startDate,
          appliedFilters.endDate,
        );
      }

      return true;
    });

    const direction = planSortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const vehicleA = a.vehicle || vehicleMap.get(a.vehicleId);
      const vehicleB = b.vehicle || vehicleMap.get(b.vehicleId);

      if (planSortBy === "name") {
        return a.name.localeCompare(b.name, "pt-BR") * direction;
      }

      if (planSortBy === "vehicle") {
        const labelA = vehicleA ? formatVehicleLabel(vehicleA) : "";
        const labelB = vehicleB ? formatVehicleLabel(vehicleB) : "";

        return (
          labelA.localeCompare(labelB, "pt-BR", { sensitivity: "base" }) *
          direction
        );
      }

      if (planSortBy === "interval") {
        return (
          planIntervalLabel(a).localeCompare(planIntervalLabel(b), "pt-BR") *
          direction
        );
      }

      if (planSortBy === "due") {
        const dueA = parseDate(a.nextDueDate)?.getTime() || a.nextDueKm || 0;
        const dueB = parseDate(b.nextDueDate)?.getTime() || b.nextDueKm || 0;

        return (dueA - dueB) * direction;
      }

      return (Number(a.active) - Number(b.active)) * direction;
    });
  }, [
    appliedFilters,
    hasLoadedData,
    planSortBy,
    planSortDirection,
    plans,
    selectedBranchId,
    vehicleMap,
  ]);

  const maintenanceMetrics = useMemo(
    () =>
      scopedRecords.reduce(
        (acc, item) => {
          acc.total += 1;
          acc.cost += Number(item.cost || 0);

          if (item.status === "DONE") acc.done += 1;
          else acc.pending += 1;

          return acc;
        },
        { total: 0, pending: 0, done: 0, cost: 0 },
      ),
    [scopedRecords],
  );

  const planMetrics = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return scopedPlans.reduce(
      (acc, plan) => {
        acc.total += 1;

        if (plan.active) acc.active += 1;

        const due = parseDate(plan.nextDueDate || undefined);
        if (due) {
          if (due < today) acc.overdue += 1;
          else if (due <= nextWeek) acc.dueSoon += 1;
        }

        return acc;
      },
      { total: 0, active: 0, dueSoon: 0, overdue: 0 },
    );
  }, [scopedPlans]);
  const recordTotalPages = Math.max(
    1,
    Math.ceil(scopedRecords.length / TABLE_PAGE_SIZE),
  );

  const planTotalPages = Math.max(
    1,
    Math.ceil(scopedPlans.length / TABLE_PAGE_SIZE),
  );

  const paginatedRecords = scopedRecords.slice(
    (recordPage - 1) * TABLE_PAGE_SIZE,
    recordPage * TABLE_PAGE_SIZE,
  );

  const paginatedPlans = scopedPlans.slice(
    (planPage - 1) * TABLE_PAGE_SIZE,
    planPage * TABLE_PAGE_SIZE,
  );

  const selectedRecordIdsSet = useMemo(
    () => new Set(selectedRecordIds),
    [selectedRecordIds],
  );

  const allRecordsOnPageSelected =
    paginatedRecords.length > 0 &&
    paginatedRecords.every((record) => selectedRecordIdsSet.has(record.id));

  const someRecordsOnPageSelected =
    paginatedRecords.some((record) => selectedRecordIdsSet.has(record.id)) &&
    !allRecordsOnPageSelected;

  function updatePlanForm<K extends keyof PlanFormState>(
    field: K,
    value: PlanFormState[K],
  ) {
    setPlanForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateDraftFilter<K extends keyof MaintenanceFilters>(
    field: K,
    value: MaintenanceFilters[K],
  ) {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  }

  function notifyUpdates() {
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    window.dispatchEvent(new CustomEvent("evfleet-dashboard-updated"));
  }

  function openTireManagement(vehicleId: string) {
    navigate(`/tire-management?vehicleId=${encodeURIComponent(vehicleId)}`);
  }

  function openCreateRecord() {
    const selectedVehicleId =
      splitCsv(draftFilters.vehicleId)[0] ||
      splitCsv(appliedFilters.vehicleId)[0] ||
      contextVehicleId ||
      scopedVehicles[0]?.id ||
      "";

    setEditingRecord(null);
    setRecordFieldErrors({});
    setRecordForm(initialMaintenanceRecordForm(selectedVehicleId));
    setRecordModalOpen(true);
  }

  function openEditRecord(record: MaintenanceRecord) {
    setEditingRecord(record);
    setRecordFieldErrors({});
    setRecordForm(maintenanceRecordToForm(record));
    setRecordModalOpen(true);
  }

  function openCreatePlan() {
    const selectedVehicleId =
      splitCsv(draftFilters.vehicleId)[0] ||
      splitCsv(appliedFilters.vehicleId)[0] ||
      contextVehicleId ||
      scopedVehicles[0]?.id ||
      "";

    setEditingPlan(null);
    setPlanForm({
      ...initialPlanForm,
      vehicleId: selectedVehicleId,
      planType: "PREVENTIVE",
      intervalUnit: "MONTH",
      active: true,
    });
    setPlanModalOpen(true);
  }

  function openEditPlan(plan: MaintenancePlan) {
    setEditingPlan(plan);
    setPlanForm({
      vehicleId: plan.vehicleId,
      name: plan.name || "",
      planType: (plan.planType as PlanFormState["planType"]) || "PREVENTIVE",
      intervalUnit: (plan.intervalUnit as PlanFormState["intervalUnit"]) || "MONTH",
      intervalValue: String(plan.intervalValue || ""),
      alertBeforeDays: String(plan.alertBeforeDays || ""),
      alertBeforeKm: String(plan.alertBeforeKm || ""),
      nextDueDate: String(plan.nextDueDate || "").slice(0, 10),
      nextDueKm: String(plan.nextDueKm || ""),
      active: plan.active,
      notes: plan.notes || "",
    });
    setPlanModalOpen(true);
  }

  function closePlanModal() {
    if (saving) return;

    setPlanModalOpen(false);
    setEditingPlan(null);
    setPlanForm(initialPlanForm);
  }

  function closeRecordModal() {
    if (saving) return;

    setRecordModalOpen(false);
    setEditingRecord(null);
    setRecordForm(initialMaintenanceRecordForm(contextVehicleId));
    setRecordFieldErrors({});
  }

  function clearRecordFieldError(field: keyof MaintenanceRecordFormData) {
    setRecordFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function getRecordFieldClass(
    field: keyof MaintenanceRecordFormData,
    extra = "",
  ) {
    const base =
      "w-full rounded-xl border px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
    const error =
      "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200";
    const normal = "border-slate-300";

    return `${base} ${recordFieldErrors[field] ? error : normal} ${extra}`;
  }

  function parseMoneyInput(value: string) {
    const normalized = String(value || "")
      .replace(/\./g, "")
      .replace(",", ".");

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function validateRecordForm() {
    const nextErrors: MaintenanceRecordFieldErrors = {};

    if (!recordForm.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
    if (!recordForm.description.trim()) {
      nextErrors.description = "Informe a descrição da manutenção.";
    }
    if (!recordForm.maintenanceDate) {
      nextErrors.maintenanceDate = "Informe a data da manutenção.";
    }

    const km = Number(recordForm.km);
    if (Number.isNaN(km) || km < 0) {
      nextErrors.km = "Informe o KM corretamente.";
    }

    const cost = parseMoneyInput(recordForm.cost);
    if (Number.isNaN(cost) || cost < 0) {
      nextErrors.cost = "Informe o custo corretamente.";
    }

    setRecordFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveRecord(event: React.FormEvent) {
    event.preventDefault();

    if (!validateRecordForm()) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        vehicleId: recordForm.vehicleId,
        type: recordForm.type,
        description: recordForm.description.trim(),
        partsReplaced: recordForm.partsReplaced
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        workshop: recordForm.workshop.trim() || undefined,
        responsible: recordForm.responsible.trim() || undefined,
        cost: parseMoneyInput(recordForm.cost),
        km: Number(recordForm.km || 0),
        maintenanceDate: recordForm.maintenanceDate,
        status: recordForm.status,
        notes: recordForm.notes.trim() || undefined,
      };

      if (editingRecord) {
        await updateMaintenanceRecord(editingRecord.id, payload);
      } else {
        await createMaintenanceRecord(payload);
      }

      closeRecordModal();
      await loadData();
      notifyUpdates();
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;

      setErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : apiMessage || "Não foi possível salvar a manutenção.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePlan(event: FormEvent) {
    event.preventDefault();

    if (!planForm.vehicleId) {
      setErrorMessage("Selecione um veículo para cadastrar o plano.");
      return;
    }

    if (!planForm.name.trim()) {
      setErrorMessage("Informe o nome do plano.");
      return;
    }

    if (!planForm.intervalValue) {
      setErrorMessage("Informe o intervalo do plano.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const payload: CreateMaintenancePlanInput = {
        vehicleId: planForm.vehicleId,
        name: planForm.name.trim(),
        planType: planForm.planType || "PREVENTIVE",
        intervalUnit: planForm.intervalUnit || "MONTH",
        intervalValue: Number(planForm.intervalValue) || 0,
        alertBeforeDays: planForm.alertBeforeDays
          ? Number(planForm.alertBeforeDays)
          : undefined,
        alertBeforeKm: planForm.alertBeforeKm
          ? Number(planForm.alertBeforeKm)
          : undefined,
        nextDueDate: planForm.nextDueDate || undefined,
        nextDueKm: planForm.nextDueKm ? Number(planForm.nextDueKm) : undefined,
        active: planForm.active === "" ? true : Boolean(planForm.active),
        notes: planForm.notes.trim() || undefined,
      };

      if (editingPlan) {
        await updateMaintenancePlan(editingPlan.id, payload);
      } else {
        await createMaintenancePlan(payload);
      }

      closePlanModal();
      await loadData();
      notifyUpdates();
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;

      setErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : apiMessage || "Não foi possível salvar o plano de manutenção.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickRecordStatusChange(
    record: MaintenanceRecord,
    status: "OPEN" | "DONE",
  ) {
    try {
      setQuickStatusRecordId(record.id);
      setErrorMessage("");

      await updateMaintenanceRecord(record.id, {
        vehicleId: record.vehicleId,
        type: record.type,
        description: record.description,
        partsReplaced: record.partsReplaced || [],
        workshop: record.workshop || undefined,
        responsible: record.responsible || undefined,
        cost: Number(record.cost || 0),
        km: Number(record.km || 0),
        maintenanceDate: String(record.maintenanceDate).slice(0, 10),
        status,
        notes: record.notes || undefined,
      });

      await loadData();
      notifyUpdates();
    } catch {
      setErrorMessage("Não foi possível atualizar o status da manutenção.");
    } finally {
      setQuickStatusRecordId(null);
    }
  }

  async function confirmDeleteRecord() {
    if (!recordToDelete) return;

    try {
      setSaving(true);
      setErrorMessage("");

      await deleteMaintenanceRecord(recordToDelete.id);

      setRecordToDelete(null);
      setSelectedRecordIds((prev) =>
        prev.filter((item) => item !== recordToDelete.id),
      );

      await loadData();
      notifyUpdates();
    } catch {
      setErrorMessage("Não foi possível excluir a manutenção.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeletePlan() {
    if (!planToDelete) return;

    try {
      setSaving(true);
      setErrorMessage("");

      await deleteMaintenancePlan(planToDelete.id);

      setPlanToDelete(null);
      await loadData();
      notifyUpdates();
    } catch {
      setErrorMessage("Não foi possível excluir o plano de manutenção.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmBulkDeleteRecords() {
    if (selectedRecordIds.length === 0) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const results = await Promise.allSettled(
        selectedRecordIds.map((id) => deleteMaintenanceRecord(id)),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = results.length - successCount;

      setSelectedRecordIds([]);
      setBulkDeleteRecordsOpen(false);

      await loadData();
      notifyUpdates();

      if (failCount > 0) {
        setErrorMessage(
          `Exclusão parcial. Registros removidos: ${successCount}. Falhas: ${failCount}.`,
        );
      }
    } catch {
      setErrorMessage("Não foi possível concluir a exclusão em lote das manutenções.");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleRecord(id: string) {
    setSelectedRecordIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id],
    );
  }

  function handleToggleAllRecords() {
    if (allRecordsOnPageSelected) {
      setSelectedRecordIds((prev) =>
        prev.filter((id) => !paginatedRecords.some((record) => record.id === id)),
      );
      return;
    }

    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      paginatedRecords.forEach((record) => next.add(record.id));
      return Array.from(next);
    });
  }

  function handleRecordSort(column: RecordSortBy) {
    if (recordSortBy === column) {
      setRecordSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setRecordSortBy(column);
    setRecordSortDirection(column === "date" ? "desc" : "asc");
  }

  function handlePlanSort(column: PlanSortBy) {
    if (planSortBy === column) {
      setPlanSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setPlanSortBy(column);
    setPlanSortDirection("asc");
  }

  const contextVehicle = contextVehicleId
    ? vehicleMap.get(contextVehicleId) || null
    : null;

  const filtersDirty = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  }, [draftFilters, appliedFilters]);

  const hasFiltersApplied = hasActiveFilters(appliedFilters);

  return (
    <div className="min-w-0 space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manutenções</h1>
            <p className="text-sm text-slate-500">
              Gestão de registros, histórico técnico, custos e planos da frota.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {contextVehicle ? (
              <button
                type="button"
                onClick={() => openTireManagement(contextVehicle.id)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 sm:w-auto"
              >
                Gerenciar pneus do veículo
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => (tab === "records" ? openCreateRecord() : openCreatePlan())}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
            >
              + {tab === "records" ? "Registrar manutenção" : "Novo plano de manutenção"}
            </button>
          </div>
        </div>

        {visibleTabs.records && visibleTabs.plans ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("records")}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${tab === "records"
                ? "border-orange-300 bg-orange-50 text-orange-700"
                : "border-slate-300 bg-white text-slate-600 hover:border-orange-200 hover:text-slate-800"
                }`}
            >
              Manutenções
            </button>

            <button
              type="button"
              onClick={() => setTab("plans")}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${tab === "plans"
                ? "border-orange-300 bg-orange-50 text-orange-700"
                : "border-slate-300 bg-white text-slate-600 hover:border-orange-200 hover:text-slate-800"
                }`}
            >
              Planos
            </button>
          </div>
        ) : null}
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {tab === "records" ? (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {maintenanceMetrics.total}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Pendentes
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">
              {maintenanceMetrics.pending}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Concluídas
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {maintenanceMetrics.done}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Custo total
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-800">
              {toMoney(maintenanceMetrics.cost)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Planos
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {planMetrics.total}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Ativos
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {planMetrics.active}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              Próximos
            </p>
            <p className="mt-1 text-2xl font-bold text-orange-800">
              {planMetrics.dueSoon}
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Vencidos
            </p>
            <p className="mt-1 text-2xl font-bold text-red-800">
              {planMetrics.overdue}
            </p>
          </div>
        </div>
      )}

      <MaintenanceRecordsTablesSection
        currentCompanyName={currentCompany?.name}
        tab={tab}
        loading={loading}
        consulting={consulting}
        draftFilters={draftFilters}
        filtersDirty={filtersDirty}
        hasFiltersApplied={hasFiltersApplied}
        vehicleFilterOptions={vehicleFilterOptions}
        recordTypeOptions={recordTypeOptions}
        recordStatusOptions={recordStatusOptions}
        planStatusOptions={planStatusOptions}
        onFilterChange={updateDraftFilter}
        onConsult={handleConsult}
        onClearFilters={handleClearFilters}
        vehicleMap={vehicleMap}
        highlightId={highlightId}
        records={scopedRecords}
        paginatedRecords={paginatedRecords}
        selectedRecordIds={selectedRecordIds}
        selectedRecordIdsSet={selectedRecordIdsSet}
        allRecordsOnPageSelected={allRecordsOnPageSelected}
        someRecordsOnPageSelected={someRecordsOnPageSelected}
        recordPage={recordPage}
        recordTotalPages={recordTotalPages}
        tablePageSize={TABLE_PAGE_SIZE}
        quickStatusRecordId={quickStatusRecordId}
        recordSortBy={recordSortBy}
        recordSortDirection={recordSortDirection}
        onRecordSort={handleRecordSort}
        onToggleRecord={handleToggleRecord}
        onToggleAllRecords={handleToggleAllRecords}
        onClearSelectedRecords={() => setSelectedRecordIds([])}
        onOpenEditSelectedRecord={() => {
          const selectedRecord = scopedRecords.find((record) =>
            selectedRecordIds.includes(record.id),
          );

          if (selectedRecord) {
            openEditRecord(selectedRecord);
          }
        }}
        onOpenBulkDeleteRecords={() => setBulkDeleteRecordsOpen(true)}
        onPreviousRecordPage={() => setRecordPage((prev) => Math.max(prev - 1, 1))}
        onNextRecordPage={() =>
          setRecordPage((prev) => Math.min(prev + 1, recordTotalPages))
        }
        onOpenEditRecord={openEditRecord}
        onQuickRecordStatusChange={handleQuickRecordStatusChange}
        plans={scopedPlans}
        paginatedPlans={paginatedPlans}
        planPage={planPage}
        planTotalPages={planTotalPages}
        planSortBy={planSortBy}
        planSortDirection={planSortDirection}
        onPlanSort={handlePlanSort}
        onPreviousPlanPage={() => setPlanPage((prev) => Math.max(prev - 1, 1))}
        onNextPlanPage={() =>
          setPlanPage((prev) => Math.min(prev + 1, planTotalPages))
        }
        onOpenEditPlan={openEditPlan}
        onSetPlanToDelete={setPlanToDelete}
      />

      <MaintenanceRecordFormModal
        isOpen={recordModalOpen}
        editingRecord={editingRecord}
        vehicles={scopedVehicles}
        currentCompanyName={currentCompany?.name}
        form={recordForm}
        setForm={setRecordForm}
        fieldErrors={recordFieldErrors}
        saving={saving}
        onClose={closeRecordModal}
        onSubmit={handleSaveRecord}
        clearFieldError={clearRecordFieldError}
        getFieldClass={getRecordFieldClass}
      />

      {planModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPlan ? "Editar plano" : "Novo plano de manutenção"}
              </h2>
              <p className="text-sm text-slate-500">
                Configure a periodicidade e os alertas de manutenção preventiva.
              </p>
            </div>

            <form onSubmit={handleSavePlan} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Veículo
                </span>
                <select
                  value={planForm.vehicleId}
                  onChange={(event) => updatePlanForm("vehicleId", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="">Selecione</option>
                  {scopedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {formatVehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Nome do plano
                </span>
                <input
                  value={planForm.name}
                  onChange={(event) => updatePlanForm("name", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex.: Revisão preventiva"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">Tipo</span>
                <select
                  value={planForm.planType}
                  onChange={(event) =>
                    updatePlanForm(
                      "planType",
                      event.target.value as PlanFormState["planType"],
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="PREVENTIVE">Preventiva</option>
                  <option value="PERIODIC">Periódica</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Unidade
                </span>
                <select
                  value={planForm.intervalUnit}
                  onChange={(event) =>
                    updatePlanForm(
                      "intervalUnit",
                      event.target.value as PlanFormState["intervalUnit"],
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="MONTH">Meses</option>
                  <option value="DAY">Dias</option>
                  <option value="KM">KM</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Intervalo
                </span>
                <input
                  value={planForm.intervalValue}
                  onChange={(event) =>
                    updatePlanForm("intervalValue", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex.: 6"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Alertar antes (dias)
                </span>
                <input
                  value={planForm.alertBeforeDays}
                  onChange={(event) =>
                    updatePlanForm("alertBeforeDays", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex.: 15"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Alertar antes (km)
                </span>
                <input
                  value={planForm.alertBeforeKm}
                  onChange={(event) =>
                    updatePlanForm("alertBeforeKm", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex.: 1000"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Próxima data
                </span>
                <input
                  type="date"
                  value={planForm.nextDueDate}
                  onChange={(event) =>
                    updatePlanForm("nextDueDate", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Próximo KM
                </span>
                <input
                  value={planForm.nextDueKm}
                  onChange={(event) => updatePlanForm("nextDueKm", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex.: 50000"
                />
              </label>

              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={planForm.active === "" ? true : Boolean(planForm.active)}
                  onChange={(event) => updatePlanForm("active", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-semibold text-slate-700">
                  Plano ativo
                </span>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Observações
                </span>
                <textarea
                  value={planForm.notes}
                  onChange={(event) => updatePlanForm("notes", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>

              <div className="flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={closePlanModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir manutenção"
        description={
          recordToDelete
            ? `Deseja excluir a manutenção "${recordToDelete.description}"?`
            : ""
        }
        loading={saving}
        onCancel={() => {
          if (!saving) setRecordToDelete(null);
        }}
        onConfirm={confirmDeleteRecord}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(planToDelete)}
        title="Excluir plano de manutenção"
        description={planToDelete ? `Deseja excluir o plano "${planToDelete.name}"?` : ""}
        loading={saving}
        onCancel={() => {
          if (!saving) setPlanToDelete(null);
        }}
        onConfirm={confirmDeletePlan}
      />

      <ConfirmDeleteModal
        isOpen={bulkDeleteRecordsOpen}
        title="Excluir manutenções selecionadas"
        description={`Deseja excluir ${selectedRecordIds.length} manutenção(ões) selecionada(s)?`}
        loading={saving}
        onCancel={() => {
          if (!saving) setBulkDeleteRecordsOpen(false);
        }}
        onConfirm={confirmBulkDeleteRecords}
      />
    </div>
  );
}