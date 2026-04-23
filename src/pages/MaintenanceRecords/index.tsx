import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { QuickStatusAction } from "../../components/QuickStatusAction";
import { TablePagination } from "../../components/TablePagination";
import {
  fetchMenuVisibilityMap,
  getCachedMenuVisibilityMap,
  type MenuVisibilityMap,
} from "../../services/menuVisibility";
import {
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
import { getVehicles } from "../../services/vehicles";
import type { MaintenancePlan } from "../../types/maintenance-plan";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type Tab = "records" | "plans";
type SortDirection = "asc" | "desc";
type RecordSortBy = "date" | "vehicle" | "type" | "km" | "cost" | "status";
type PlanSortBy = "name" | "vehicle" | "interval" | "due" | "status";

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

type MaintenanceRecordType = "PREVENTIVE" | "CORRECTIVE" | "PERIODIC";
type MaintenanceRecordStatus = "OPEN" | "DONE";
type MaintenancePlanStatus = "ACTIVE" | "INACTIVE";

type MaintenanceFilters = {
  vehicleId: string;
  recordType: MaintenanceRecordType[];
  recordStatus: MaintenanceRecordStatus[];
  planStatus: MaintenancePlanStatus[];
  startDate: string;
  endDate: string;
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
  recordType: [],
  recordStatus: [],
  planStatus: [],
  startDate: "",
  endDate: "",
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function toDateBR(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
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
  if (plan.intervalUnit === "KM") return `${plan.intervalValue.toLocaleString("pt-BR")} km`;
  if (plan.intervalUnit === "MONTH") return `${plan.intervalValue} mês(es)`;
  if (plan.intervalUnit === "DAY") return `${plan.intervalValue} dia(s)`;
  return "-";
}

function planDueLabel(plan: MaintenancePlan) {
  if (plan.nextDueDate) return toDateBR(plan.nextDueDate);
  if (plan.nextDueKm) return `${plan.nextDueKm.toLocaleString("pt-BR")} km`;
  return "-";
}

function sortArrow(activeColumn: string, currentColumn: string, direction: SortDirection) {
  if (activeColumn !== currentColumn) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function isDateInRange(value: string | null | undefined, startDate: string, endDate: string) {
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
    filters.recordType.length > 0 ||
    filters.recordStatus.length > 0 ||
    filters.planStatus.length > 0,
  );
}

export function MaintenanceRecordsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedBranchId } = useBranch();
  const { currentCompany } = useCompanyScope();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const contextVehicleId = query.get("vehicleId") || "";
  const contextHighlightId = query.get("highlight") || "";
  const incomingTab = query.get("tab");

  const [loading, setLoading] = useState(true);
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
  const [hasSearched, setHasSearched] = useState(false);
  const [draftFilters, setDraftFilters] = useState<MaintenanceFilters>({
    ...initialFilters,
    vehicleId: contextVehicleId || "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MaintenanceFilters>({
    ...initialFilters,
    vehicleId: contextVehicleId || "",
  });
  const [recordSortBy, setRecordSortBy] = useState<RecordSortBy>("date");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("desc");
  const [planSortBy, setPlanSortBy] = useState<PlanSortBy>("due");
  const [planSortDirection, setPlanSortDirection] = useState<SortDirection>("asc");
  const [recordPage, setRecordPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [planToDelete, setPlanToDelete] = useState<MaintenancePlan | null>(null);
  const [bulkDeleteRecordsOpen, setBulkDeleteRecordsOpen] = useState(false);
  const [quickStatusRecordId, setQuickStatusRecordId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);

  async function loadBaseData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [visibility, vehiclesData] = await Promise.all([
        fetchMenuVisibilityMap(),
        getVehicles(),
      ]);
      setMenuVisibility(visibility);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch {
      setErrorMessage("Não foi possível carregar o módulo de manutenções.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConsult(nextFilters?: MaintenanceFilters) {
    const filters = nextFilters ?? draftFilters;
    try {
      setConsulting(true);
      setErrorMessage("");
      const [recordsData, plansData] = await Promise.all([
        getMaintenanceRecords(),
        getMaintenancePlans(),
      ]);
      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setAppliedFilters(filters);
      setHasSearched(true);
      setSelectedRecordIds([]);
      setRecordPage(1);
      setPlanPage(1);
    } catch {
      setErrorMessage("Não foi possível consultar os dados de manutenções.");
    } finally {
      setConsulting(false);
    }
  }

  function handleClearFilters() {
    const clearedFilters: MaintenanceFilters = {
      ...initialFilters,
      vehicleId: contextVehicleId || "",
    };
    setDraftFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setRecords([]);
    setPlans([]);
    setHasSearched(false);
    setSelectedRecordIds([]);
    setRecordPage(1);
    setPlanPage(1);
    setErrorMessage("");
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

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
    const nextVehicleId = contextVehicleId || "";
    setDraftFilters((prev) => ({ ...prev, vehicleId: nextVehicleId }));
    setAppliedFilters((prev) => ({ ...prev, vehicleId: nextVehicleId }));
  }, [contextVehicleId]);

  useEffect(() => {
    setRecordPage(1);
  }, [recordSortBy, recordSortDirection, appliedFilters, selectedBranchId, hasSearched]);

  useEffect(() => {
    setPlanPage(1);
  }, [planSortBy, planSortDirection, appliedFilters, selectedBranchId, hasSearched]);

  const visibleTabs = useMemo(
    () => ({
      records: menuVisibility["/maintenance-records::records"] !== false,
      plans: menuVisibility["/maintenance-records::plans"] !== false,
    }),
    [menuVisibility],
  );

  const scopedVehicles = useMemo(() => {
    let filtered = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;

    if (contextVehicleId) {
      filtered = filtered.filter((vehicle) => vehicle.id === contextVehicleId);
    }

    return filtered.sort((a, b) =>
      formatVehicleLabel(a).localeCompare(formatVehicleLabel(b), "pt-BR", {
        sensitivity: "base",
      }),
    );
  }, [contextVehicleId, selectedBranchId, vehicles]);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );

  const scopedRecords = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = selectedBranchId
      ? records.filter((record) => {
        const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
        return vehicle?.branchId === selectedBranchId;
      })
      : records;

    if (appliedFilters.vehicleId) {
      const selectedVehicleIds = appliedFilters.vehicleId
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (selectedVehicleIds.length > 0) {
        filtered = filtered.filter((record) => selectedVehicleIds.includes(record.vehicleId));
      }
    }

    if (appliedFilters.recordType.length > 0) {
      filtered = filtered.filter((record) =>
        appliedFilters.recordType.includes(record.type as MaintenanceRecordType),
      );
    }

    if (appliedFilters.recordStatus.length > 0) {
      filtered = filtered.filter((record) =>
        appliedFilters.recordStatus.includes(record.status as MaintenanceRecordStatus),
      );
    }

    if (appliedFilters.startDate || appliedFilters.endDate) {
      filtered = filtered.filter((record) =>
        isDateInRange(record.maintenanceDate, appliedFilters.startDate, appliedFilters.endDate),
      );
    }

    const direction = recordSortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const vehicleA = a.vehicle || vehicleMap.get(a.vehicleId);
      const vehicleB = b.vehicle || vehicleMap.get(b.vehicleId);

      if (recordSortBy === "date") {
        return (
          ((parseDate(a.maintenanceDate)?.getTime() || 0) -
            (parseDate(b.maintenanceDate)?.getTime() || 0)) * direction
        );
      }

      if (recordSortBy === "vehicle") {
        const labelA = vehicleA ? formatVehicleLabel(vehicleA) : "";
        const labelB = vehicleB ? formatVehicleLabel(vehicleB) : "";
        return labelA.localeCompare(labelB, "pt-BR", { sensitivity: "base" }) * direction;
      }

      if (recordSortBy === "type") {
        return (
          maintenanceTypeLabel(a.type).localeCompare(maintenanceTypeLabel(b.type), "pt-BR") *
          direction
        );
      }

      if (recordSortBy === "km") return ((a.km || 0) - (b.km || 0)) * direction;
      if (recordSortBy === "cost") return ((a.cost || 0) - (b.cost || 0)) * direction;

      return (
        maintenanceStatusLabel(a.status).localeCompare(
          maintenanceStatusLabel(b.status),
          "pt-BR",
        ) * direction
      );
    });
  }, [
    appliedFilters,
    hasSearched,
    recordSortBy,
    recordSortDirection,
    records,
    selectedBranchId,
    vehicleMap,
  ]);

  const scopedPlans = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = selectedBranchId
      ? plans.filter((plan) => {
        const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);
        return vehicle?.branchId === selectedBranchId;
      })
      : plans;

    if (appliedFilters.vehicleId) {
      const selectedVehicleIds = appliedFilters.vehicleId
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (selectedVehicleIds.length > 0) {
        filtered = filtered.filter((plan) => selectedVehicleIds.includes(plan.vehicleId));
      }
    }

    if (appliedFilters.recordType.length > 0) {
      filtered = filtered.filter((plan) =>
        appliedFilters.recordType.includes(plan.planType as MaintenanceRecordType),
      );
    }

    if (appliedFilters.planStatus.length > 0) {
      filtered = filtered.filter((plan) =>
        appliedFilters.planStatus.includes(plan.active ? "ACTIVE" : "INACTIVE"),
      );
    }

    if (appliedFilters.startDate || appliedFilters.endDate) {
      filtered = filtered.filter((plan) =>
        isDateInRange(plan.nextDueDate, appliedFilters.startDate, appliedFilters.endDate),
      );
    }

    const direction = planSortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const vehicleA = a.vehicle || vehicleMap.get(a.vehicleId);
      const vehicleB = b.vehicle || vehicleMap.get(b.vehicleId);

      if (planSortBy === "name") return a.name.localeCompare(b.name, "pt-BR") * direction;

      if (planSortBy === "vehicle") {
        const labelA = vehicleA ? formatVehicleLabel(vehicleA) : "";
        const labelB = vehicleB ? formatVehicleLabel(vehicleB) : "";
        return labelA.localeCompare(labelB, "pt-BR", { sensitivity: "base" }) * direction;
      }

      if (planSortBy === "interval") {
        return planIntervalLabel(a).localeCompare(planIntervalLabel(b), "pt-BR") * direction;
      }

      if (planSortBy === "due") {
        const dueA = parseDate(a.nextDueDate)?.getTime() || (a.nextDueKm || 0);
        const dueB = parseDate(b.nextDueDate)?.getTime() || (b.nextDueKm || 0);
        return (dueA - dueB) * direction;
      }

      return (Number(a.active) - Number(b.active)) * direction;
    });
  }, [
    appliedFilters,
    hasSearched,
    planSortBy,
    planSortDirection,
    plans,
    selectedBranchId,
    vehicleMap,
  ]);

  const maintenanceMetrics = useMemo(
    () =>
      hasSearched
        ? scopedRecords.reduce(
          (acc, item) => {
            acc.total += 1;
            acc.cost += Number(item.cost || 0);
            if (item.status === "DONE") acc.done += 1;
            else acc.pending += 1;
            return acc;
          },
          { total: 0, pending: 0, done: 0, cost: 0 },
        )
        : { total: 0, pending: 0, done: 0, cost: 0 },
    [hasSearched, scopedRecords],
  );

  const planMetrics = useMemo(() => {
    if (!hasSearched) {
      return { total: 0, active: 0, dueSoon: 0, overdue: 0 };
    }

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
  }, [hasSearched, scopedPlans]);

  const recordTotalPages = Math.max(1, Math.ceil(scopedRecords.length / TABLE_PAGE_SIZE));
  const planTotalPages = Math.max(1, Math.ceil(scopedPlans.length / TABLE_PAGE_SIZE));

  const paginatedRecords = scopedRecords.slice(
    (recordPage - 1) * TABLE_PAGE_SIZE,
    recordPage * TABLE_PAGE_SIZE,
  );

  const paginatedPlans = scopedPlans.slice(
    (planPage - 1) * TABLE_PAGE_SIZE,
    planPage * TABLE_PAGE_SIZE,
  );

  const allRecordsOnPageSelected =
    paginatedRecords.length > 0 &&
    paginatedRecords.every((record) => selectedRecordIds.includes(record.id));

  function updatePlanForm<K extends keyof PlanFormState>(field: K, value: PlanFormState[K]) {
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
    const queryParts = [];
    const selectedVehicleId = draftFilters.vehicleId || appliedFilters.vehicleId || contextVehicleId;

    if (selectedVehicleId) {
      queryParts.push(`vehicleId=${encodeURIComponent(selectedVehicleId)}`);
    }

    navigate(`/maintenance-records/register${queryParts.length ? `?${queryParts.join("&")}` : ""}`);
  }

  function openEditRecord(record: MaintenanceRecord) {
    navigate(
      `/maintenance-records/register?recordId=${encodeURIComponent(
        record.id,
      )}&vehicleId=${encodeURIComponent(record.vehicleId)}`,
    );
  }

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm({
      ...initialPlanForm,
      vehicleId:
        draftFilters.vehicleId ||
        appliedFilters.vehicleId ||
        contextVehicleId ||
        scopedVehicles[0]?.id ||
        "",
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
        alertBeforeDays: planForm.alertBeforeDays ? Number(planForm.alertBeforeDays) : undefined,
        alertBeforeKm: planForm.alertBeforeKm ? Number(planForm.alertBeforeKm) : undefined,
        nextDueDate: planForm.nextDueDate || undefined,
        nextDueKm: planForm.nextDueKm ? Number(planForm.nextDueKm) : undefined,
        active: planForm.active === "" ? true : Boolean(planForm.active),
        notes: planForm.notes.trim() || undefined,
      };

      if (editingPlan) await updateMaintenancePlan(editingPlan.id, payload);
      else await createMaintenancePlan(payload);

      closePlanModal();

      if (hasSearched) {
        await handleConsult(appliedFilters);
      }

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

      if (hasSearched) {
        await handleConsult(appliedFilters);
      }

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
      await deleteMaintenanceRecord(recordToDelete.id);
      setRecordToDelete(null);
      setSelectedRecordIds((prev) => prev.filter((item) => item !== recordToDelete.id));

      if (hasSearched) {
        await handleConsult(appliedFilters);
      }

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
      await deleteMaintenancePlan(planToDelete.id);
      setPlanToDelete(null);

      if (hasSearched) {
        await handleConsult(appliedFilters);
      }

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
      await Promise.all(selectedRecordIds.map((id) => deleteMaintenanceRecord(id)));
      setSelectedRecordIds([]);
      setBulkDeleteRecordsOpen(false);

      if (hasSearched) {
        await handleConsult(appliedFilters);
      }

      notifyUpdates();
    } catch {
      setErrorMessage("Não foi possível concluir a exclusão em lote das manutenções.");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleRecord(id: string) {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
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

  const contextVehicle = contextVehicleId ? vehicleMap.get(contextVehicleId) || null : null;

  const filtersDirty = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  }, [draftFilters, appliedFilters]);
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
              Planos de manutenção
            </button>
          </div>
        ) : null}
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando...
        </section>
      ) : null}

      {!loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-600 xl:col-span-2">
              <span className="font-medium text-slate-700">Empresa</span>
              <input
                value={currentCompany?.name || ""}
                disabled
                className="h-10 w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-3 text-sm text-slate-500"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Veículos</span>
              <select
                multiple
                value={draftFilters.vehicleId ? draftFilters.vehicleId.split(",") : []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  updateDraftFilter("vehicleId", values.join(","));
                }}
                className="h-10 w-full rounded-xl border border-slate-300 px-2 text-sm"
              >
                {scopedVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatVehicleLabel(v)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Tipo</span>
              <select
                multiple
                value={draftFilters.recordType}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map(
                    (o) => o.value as MaintenanceRecordType,
                  );
                  updateDraftFilter("recordType", values);
                }}
                className="h-10 w-full rounded-xl border border-slate-300 px-2 text-sm"
              >
                <option value="PREVENTIVE">Preventiva</option>
                <option value="CORRECTIVE">Corretiva</option>
                <option value="PERIODIC">Periódica</option>
              </select>
            </label>

            {tab === "records" ? (
              <label className="space-y-1 text-xs text-slate-600">
                <span>Status</span>
                <select
                  multiple
                  value={draftFilters.recordStatus}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map(
                      (o) => o.value as MaintenanceRecordStatus,
                    );
                    updateDraftFilter("recordStatus", values);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 px-2 text-sm"
                >
                  <option value="OPEN">Pendente</option>
                  <option value="DONE">Concluída</option>
                </select>
              </label>
            ) : (
              <label className="space-y-1 text-xs text-slate-600">
                <span>Status do plano</span>
                <select
                  multiple
                  value={draftFilters.planStatus}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map(
                      (o) => o.value as MaintenancePlanStatus,
                    );
                    updateDraftFilter("planStatus", values);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 px-2 text-sm"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </label>
            )}

            <label className="space-y-1 text-xs text-slate-600">
              <span>Data inicial</span>
              <input
                type="date"
                value={draftFilters.startDate}
                onChange={(e) => updateDraftFilter("startDate", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Data final</span>
              <input
                type="date"
                value={draftFilters.endDate}
                onChange={(e) => updateDraftFilter("endDate", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleConsult()}
              disabled={consulting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Search className="h-4 w-4" />
              {consulting ? "Consultando..." : "Consultar"}
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={consulting || (!hasSearched && !hasActiveFilters(draftFilters))}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Limpar
            </button>
            {filtersDirty ? (
              <span className="self-center text-xs text-slate-500">
                Existem filtros alterados aguardando consulta.
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {!loading && tab === "records" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total de manutenções</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{maintenanceMetrics.total}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Pendentes</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {maintenanceMetrics.pending}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Concluídas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {maintenanceMetrics.done}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Custo total</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {toMoney(maintenanceMetrics.cost)}
              </p>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
              <span className="text-slate-500">
                {!hasSearched
                  ? "Faça uma consulta para visualizar as manutenções."
                  : selectedRecordIds.length > 0
                    ? `${selectedRecordIds.length} manutenção(ões) selecionada(s)`
                    : "Selecione registros para excluir em lote"}
              </span>
              <button
                type="button"
                onClick={() => setBulkDeleteRecordsOpen(true)}
                disabled={selectedRecordIds.length === 0}
                className="btn-ui btn-ui-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                Excluir selecionados
              </button>
            </div>

            {!hasSearched ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Nenhuma consulta realizada.
              </div>
            ) : consulting ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Consultando manutenções...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={allRecordsOnPageSelected}
                            onChange={handleToggleAllRecords}
                            aria-label="Selecionar manutenções da página"
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("date")}
                            className="cursor-pointer"
                          >
                            Data {sortArrow("date", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("vehicle")}
                            className="cursor-pointer"
                          >
                            Veículo {sortArrow("vehicle", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("type")}
                            className="cursor-pointer"
                          >
                            Tipo {sortArrow("type", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          Peças trocadas
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("km")}
                            className="cursor-pointer"
                          >
                            KM {sortArrow("km", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("cost")}
                            className="cursor-pointer"
                          >
                            Custo {sortArrow("cost", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleRecordSort("status")}
                            className="cursor-pointer"
                          >
                            Status {sortArrow("status", recordSortBy, recordSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedRecords.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500">
                            Nenhuma manutenção encontrada para os filtros informados.
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((record) => {
                          const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
                          const isHighlighted = highlightId === record.id;

                          return (
                            <tr
                              id={`maintenance-row-${record.id}`}
                              key={record.id}
                              className={`border-t border-slate-200 ${isHighlighted ? "notification-highlight" : ""
                                }`}
                            >
                              <td className="px-6 py-4 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selectedRecordIds.includes(record.id)}
                                  onChange={() => handleToggleRecord(record.id)}
                                  aria-label={`Selecionar manutenção ${record.description}`}
                                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {toDateBR(record.maintenanceDate)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-900">
                                <p className="font-medium">
                                  {vehicle ? formatVehicleLabel(vehicle) : "-"}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {maintenanceTypeLabel(record.type)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {Array.isArray(record.partsReplaced) && record.partsReplaced.length > 0
                                  ? record.partsReplaced.join(", ")
                                  : "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {record.km?.toLocaleString("pt-BR") || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {toMoney(Number(record.cost || 0))}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`status-pill ${record.status === "DONE"
                                        ? "status-active"
                                        : "status-pending"
                                      }`}
                                  >
                                    {maintenanceStatusLabel(record.status)}
                                  </span>
                                  {record.status !== "DONE" ? (
                                    <QuickStatusAction
                                      label={`Atualizar status da manutenção ${record.description}`}
                                      loading={quickStatusRecordId === record.id}
                                      options={[{ value: "DONE", label: "Marcar como concluída" }]}
                                      onSelect={(value) =>
                                        handleQuickRecordStatusChange(
                                          record,
                                          value as "OPEN" | "DONE",
                                        )
                                      }
                                    />
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditRecord(record)}
                                    className="btn-ui btn-ui-neutral"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRecordToDelete(record)}
                                    className="btn-ui btn-ui-danger"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {scopedRecords.length > 0 ? (
                  <TablePagination
                    currentPage={recordPage}
                    totalPages={recordTotalPages}
                    totalItems={scopedRecords.length}
                    pageSize={TABLE_PAGE_SIZE}
                    itemLabel="manutenções"
                    onPrevious={() => setRecordPage((prev) => Math.max(prev - 1, 1))}
                    onNext={() =>
                      setRecordPage((prev) => Math.min(prev + 1, recordTotalPages))
                    }
                  />
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}

      {!loading && tab === "plans" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Planos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{planMetrics.total}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Ativos</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{planMetrics.active}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Vencendo em breve</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{planMetrics.dueSoon}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Vencidos</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{planMetrics.overdue}</p>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
              {!hasSearched
                ? "Faça uma consulta para visualizar os planos."
                : `${scopedPlans.length} plano(s) encontrado(s)`}
            </div>

            {!hasSearched ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Nenhuma consulta realizada.
              </div>
            ) : consulting ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Consultando planos...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handlePlanSort("name")}
                            className="cursor-pointer"
                          >
                            Nome {sortArrow("name", planSortBy, planSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handlePlanSort("vehicle")}
                            className="cursor-pointer"
                          >
                            Veículo {sortArrow("vehicle", planSortBy, planSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          Tipo
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handlePlanSort("interval")}
                            className="cursor-pointer"
                          >
                            Intervalo {sortArrow("interval", planSortBy, planSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handlePlanSort("due")}
                            className="cursor-pointer"
                          >
                            Próximo vencimento {sortArrow("due", planSortBy, planSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => handlePlanSort("status")}
                            className="cursor-pointer"
                          >
                            Status {sortArrow("status", planSortBy, planSortDirection)}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedPlans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                            Nenhum plano encontrado para os filtros informados.
                          </td>
                        </tr>
                      ) : (
                        paginatedPlans.map((plan) => {
                          const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);

                          return (
                            <tr key={plan.id} className="border-t border-slate-200">
                              <td className="px-6 py-4 text-sm text-slate-900">
                                <div className="font-medium">{plan.name}</div>
                                {plan.notes ? (
                                  <div className="mt-1 text-xs text-slate-500">{plan.notes}</div>
                                ) : null}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {vehicle ? formatVehicleLabel(vehicle) : "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {maintenanceTypeLabel(plan.planType)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {planIntervalLabel(plan)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {planDueLabel(plan)}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`status-pill ${plan.active ? "status-active" : "status-inactive"
                                    }`}
                                >
                                  {plan.active ? "Ativo" : "Inativo"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditPlan(plan)}
                                    className="btn-ui btn-ui-neutral"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPlanToDelete(plan)}
                                    className="btn-ui btn-ui-danger"
                                  >
                                    Excluir
                                  </button>
                                  {vehicle ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/maintenance-records/register?vehicleId=${encodeURIComponent(
                                            vehicle.id,
                                          )}&planId=${encodeURIComponent(plan.id)}`,
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                                    >
                                      Executar
                                      <ArrowUpRight className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {scopedPlans.length > 0 ? (
                  <TablePagination
                    currentPage={planPage}
                    totalPages={planTotalPages}
                    totalItems={scopedPlans.length}
                    pageSize={TABLE_PAGE_SIZE}
                    itemLabel="planos"
                    onPrevious={() => setPlanPage((prev) => Math.max(prev - 1, 1))}
                    onNext={() => setPlanPage((prev) => Math.min(prev + 1, planTotalPages))}
                  />
                ) : null}
              </>
            )}
          </section>
        </>
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
        onCancel={() => setRecordToDelete(null)}
        onConfirm={confirmDeleteRecord}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(planToDelete)}
        title="Excluir plano de manutenção"
        description={planToDelete ? `Deseja excluir o plano "${planToDelete.name}"?` : ""}
        loading={saving}
        onCancel={() => setPlanToDelete(null)}
        onConfirm={confirmDeletePlan}
      />

      <ConfirmDeleteModal
        isOpen={bulkDeleteRecordsOpen}
        title="Excluir manutenções selecionadas"
        description={`Deseja excluir ${selectedRecordIds.length} manutenção(ões) selecionada(s)?`}
        loading={saving}
        onCancel={() => setBulkDeleteRecordsOpen(false)}
        onConfirm={confirmBulkDeleteRecords}
      />

      {planModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingPlan ? "Editar plano de manutenção" : "Novo plano de manutenção"}
                </h2>
                <p className="text-sm text-slate-500">
                  Configure a periodicidade e os alertas do plano.
                </p>
              </div>
              <button
                type="button"
                onClick={closePlanModal}
                className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium text-slate-700">Veículo</span>
                  <select
                    value={planForm.vehicleId}
                    onChange={(e) => updatePlanForm("vehicleId", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Selecione um veículo</option>
                    {scopedVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium text-slate-700">Nome do plano</span>
                  <input
                    value={planForm.name}
                    onChange={(e) => updatePlanForm("name", e.target.value)}
                    placeholder="Ex: Troca de óleo e filtros"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Tipo</span>
                  <select
                    value={planForm.planType}
                    onChange={(e) =>
                      updatePlanForm("planType", e.target.value as PlanFormState["planType"])
                    }
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="PREVENTIVE">Preventiva</option>
                    <option value="PERIODIC">Periódica</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Unidade do intervalo</span>
                  <select
                    value={planForm.intervalUnit}
                    onChange={(e) =>
                      updatePlanForm(
                        "intervalUnit",
                        e.target.value as PlanFormState["intervalUnit"],
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="DAY">Dias</option>
                    <option value="MONTH">Meses</option>
                    <option value="KM">KM</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Valor do intervalo</span>
                  <input
                    type="number"
                    min="1"
                    value={planForm.intervalValue}
                    onChange={(e) => updatePlanForm("intervalValue", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Alertar antes (dias)</span>
                  <input
                    type="number"
                    min="0"
                    value={planForm.alertBeforeDays}
                    onChange={(e) => updatePlanForm("alertBeforeDays", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Alertar antes (km)</span>
                  <input
                    type="number"
                    min="0"
                    value={planForm.alertBeforeKm}
                    onChange={(e) => updatePlanForm("alertBeforeKm", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Próxima data</span>
                  <input
                    type="date"
                    value={planForm.nextDueDate}
                    onChange={(e) => updatePlanForm("nextDueDate", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Próximo KM</span>
                  <input
                    type="number"
                    min="0"
                    value={planForm.nextDueKm}
                    onChange={(e) => updatePlanForm("nextDueKm", e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Status</span>
                  <select
                    value={
                      planForm.active === "" ? "" : planForm.active ? "ACTIVE" : "INACTIVE"
                    }
                    onChange={(e) =>
                      updatePlanForm(
                        "active",
                        e.target.value === "" ? "" : e.target.value === "ACTIVE",
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium text-slate-700">Observações</span>
                  <textarea
                    value={planForm.notes}
                    onChange={(e) => updatePlanForm("notes", e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Observações opcionais do plano"
                  />
                </label>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={closePlanModal}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                    : editingPlan
                      ? "Salvar alterações"
                      : "Criar plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}