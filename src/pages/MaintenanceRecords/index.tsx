import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";
import { getVehicles } from "../../services/vehicles";
import {
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecords,
  updateMaintenanceRecord,
  type CreateMaintenanceRecordInput,
} from "../../services/maintenanceRecords";
import {
  createMaintenancePlan,
  deleteMaintenancePlan,
  getMaintenancePlans,
  updateMaintenancePlan,
  type CreateMaintenancePlanInput,
} from "../../services/maintenancePlans";
import {
  createTire,
  createTireReading,
  deleteTire,
  getTireAlerts,
  getTireReadings,
  getTires,
  updateTire,
  type CreateTireInput,
  type CreateTireReadingInput,
} from "../../services/tires";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import type { Vehicle } from "../../types/vehicle";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { MaintenancePlan } from "../../types/maintenance-plan";
import type { Tire, TireAlert, TireReading, TireStatus } from "../../types/tire";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type Tab = "records" | "plans" | "tires";
type SortDirection = "asc" | "desc";

type RecordSortBy = "date" | "vehicle" | "type" | "km" | "cost" | "status";
type PlanSortBy = "name" | "vehicle" | "interval" | "due" | "status";
type TireSortBy = "serial" | "tire" | "vehicle" | "km" | "status";
type RecordFieldKey = "vehicleId" | "type" | "status" | "description" | "maintenanceDate" | "km" | "cost";
type PlanFieldKey = "vehicleId" | "name" | "planType" | "active" | "intervalUnit" | "intervalValue";
type TireFieldKey = "serialNumber" | "brand" | "model" | "size" | "status";
type ReadingFieldKey = "readingDate" | "km" | "treadDepthMm" | "pressurePsi";

type RecordFormState = {
  vehicleId: string;
  type: "PREVENTIVE" | "CORRECTIVE" | "PERIODIC" | "";
  description: string;
  partsReplaced: string[];
  workshop: string;
  cost: string;
  km: string;
  maintenanceDate: string;
  status: "OPEN" | "DONE" | "";
  notes: string;
};

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

type TireFormState = {
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  status: TireStatus | "";
  vehicleId: string;
  axlePosition: string;
  wheelPosition: string;
  currentKm: string;
  targetPressurePsi: string;
  purchaseDate: string;
  purchaseCost: string;
  installedAt: string;
  notes: string;
};

type TireReadingFormState = {
  readingDate: string;
  km: string;
  treadDepthMm: string;
  pressurePsi: string;
  condition: string;
  notes: string;
};

const initialRecordForm: RecordFormState = {
  vehicleId: "",
  type: "",
  description: "",
  partsReplaced: [],
  workshop: "",
  cost: "",
  km: "",
  maintenanceDate: new Date().toISOString().slice(0, 10),
  status: "",
  notes: "",
};

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

const initialTireForm: TireFormState = {
  serialNumber: "",
  brand: "",
  model: "",
  size: "",
  status: "",
  vehicleId: "",
  axlePosition: "",
  wheelPosition: "",
  currentKm: "",
  targetPressurePsi: "",
  purchaseDate: "",
  purchaseCost: "",
  installedAt: "",
  notes: "",
};

const initialReadingForm: TireReadingFormState = {
  readingDate: new Date().toISOString().slice(0, 10),
  km: "",
  treadDepthMm: "",
  pressurePsi: "",
  condition: "",
  notes: "",
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function toDateBR(value?: string | null) {
  const dt = parseDate(value);
  return dt ? dt.toLocaleDateString("pt-BR") : "-";
}

function toMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toNumber(value: string) {
  return Number(String(value || "").replace(",", ".")) || 0;
}

function maintenanceTypeLabel(value: string) {
  if (value === "CORRECTIVE") return "Corretiva";
  if (value === "PERIODIC") return "Periódica";
  return "Preventiva";
}

function maintenanceStatusLabel(value: string) {
  return value === "DONE" ? "Concluída" : "Pendente";
}

function tireStatusLabel(value: TireStatus) {
  if (value === "IN_STOCK") return "Estoque";
  if (value === "INSTALLED") return "Instalado";
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "RETREADED") return "Recapado";
  return "Descartado";
}

function tireStatusClass(value: TireStatus) {
  if (value === "INSTALLED") return "status-active";
  if (value === "IN_STOCK") return "status-pending";
  if (value === "MAINTENANCE") return "status-anomaly";
  return "status-inactive";
}

function planIntervalLabel(plan: MaintenancePlan) {
  const unitMap: Record<string, string> = { KM: "km", DAY: "dia(s)", MONTH: "mês(es)" };
  return `${plan.intervalValue} ${unitMap[plan.intervalUnit] || plan.intervalUnit}`;
}

function planDueLabel(plan: MaintenancePlan) {
  if (plan.nextDueDate) return toDateBR(plan.nextDueDate);
  if (plan.nextDueKm) return `${plan.nextDueKm} km`;
  return "-";
}

const TABLE_PAGE_SIZE = 10;

export function MaintenanceRecordsPage() {
  const location = useLocation();
  const { selectedBranchId } = useBranch();

  const [tab, setTab] = useState<Tab>("records");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<"ALL" | "PREVENTIVE" | "CORRECTIVE" | "PERIODIC">("ALL");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"ALL" | "OPEN" | "DONE">("ALL");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [recordSortBy, setRecordSortBy] = useState<RecordSortBy>("date");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("desc");
  const [planSortBy, setPlanSortBy] = useState<PlanSortBy>("name");
  const [planSortDirection, setPlanSortDirection] = useState<SortDirection>("asc");
  const [tireSortBy, setTireSortBy] = useState<TireSortBy>("serial");
  const [tireSortDirection, setTireSortDirection] = useState<SortDirection>("asc");
  const [recordPage, setRecordPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [tirePage, setTirePage] = useState(1);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [tireAlerts, setTireAlerts] = useState<TireAlert[]>([]);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordFieldErrors, setRecordFieldErrors] = useState<Partial<Record<RecordFieldKey, string>>>({});
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [recordForm, setRecordForm] = useState<RecordFormState>(initialRecordForm);
  const [partsInput, setPartsInput] = useState("");

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planFieldErrors, setPlanFieldErrors] = useState<Partial<Record<PlanFieldKey, string>>>({});
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);

  const [tireModalOpen, setTireModalOpen] = useState(false);
  const [tireSaving, setTireSaving] = useState(false);
  const [tireFieldErrors, setTireFieldErrors] = useState<Partial<Record<TireFieldKey, string>>>({});
  const [editingTire, setEditingTire] = useState<Tire | null>(null);
  const [tireForm, setTireForm] = useState<TireFormState>(initialTireForm);
  const [tireSerialInput, setTireSerialInput] = useState("");
  const [tireSerialBatch, setTireSerialBatch] = useState<string[]>([]);

  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [readingSaving, setReadingSaving] = useState(false);
  const [readingFieldErrors, setReadingFieldErrors] = useState<Partial<Record<ReadingFieldKey, string>>>({});
  const [selectedTire, setSelectedTire] = useState<Tire | null>(null);
  const [readingForm, setReadingForm] = useState<TireReadingFormState>(initialReadingForm);
  const [tireReadings, setTireReadings] = useState<TireReading[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [planToDelete, setPlanToDelete] = useState<MaintenancePlan | null>(null);
  const [tireToDelete, setTireToDelete] = useState<Tire | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [vehiclesData, recordsData, plansData, tiresData, alertsData] = await Promise.all([
        getVehicles(),
        getMaintenanceRecords(),
        getMaintenancePlans(),
        getTires(),
        getTireAlerts(),
      ]);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setTires(Array.isArray(tiresData) ? tiresData : []);
      setTireAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts : []);
    } catch (error) {
      console.error("Erro ao carregar manutenção:", error);
      setErrorMessage("Não foi possível carregar os dados de manutenção.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const incomingTab = query.get("tab");
    const incomingHighlight = query.get("highlight");
    if (incomingTab === "records" || incomingTab === "plans" || incomingTab === "tires") {
      setTab(incomingTab);
    }
    if (incomingHighlight) {
      setHighlightId(incomingHighlight);
      const timer = window.setTimeout(() => {
        document.getElementById(`maintenance-row-${incomingHighlight}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 120);
      query.delete("highlight");
      const next = query.toString();
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", nextUrl);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname, location.search]);

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
    if (!recordModalOpen && !planModalOpen && !tireModalOpen && !readingModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [recordModalOpen, planModalOpen, tireModalOpen, readingModalOpen]);

  const scopedVehicles = useMemo(
    () => (selectedBranchId ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId) : vehicles),
    [vehicles, selectedBranchId]
  );

  const activeVehicles = useMemo(
    () =>
      scopedVehicles
        .filter((vehicle) => vehicle.status === "ACTIVE")
        .sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" })),
    [scopedVehicles]
  );

  const vehicleMap = useMemo(() => new Map(scopedVehicles.map((v) => [v.id, v])), [scopedVehicles]);

  const scopedRecords = useMemo(() => {
    let filtered = selectedBranchId
      ? records.filter((record) => {
          const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
          return vehicle?.branchId === selectedBranchId;
        })
      : records;

    if (recordTypeFilter !== "ALL") {
      filtered = filtered.filter((record) => record.type === recordTypeFilter);
    }

    if (recordStatusFilter !== "ALL") {
      filtered = filtered.filter((record) => record.status === recordStatusFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((record) => {
        const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
        const text = [
          record.description,
          maintenanceTypeLabel(record.type),
          maintenanceStatusLabel(record.status),
          record.workshop || "",
          record.responsible || "",
          String(record.km || ""),
          String(record.cost || ""),
          vehicle?.plate || "",
          vehicle ? formatVehicleLabel(vehicle) : "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(term);
      });
    }

    const direction = recordSortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a.vehicle || vehicleMap.get(a.vehicleId);
      const vb = b.vehicle || vehicleMap.get(b.vehicleId);
      if (recordSortBy === "date") {
        return ((parseDate(a.maintenanceDate)?.getTime() || 0) - (parseDate(b.maintenanceDate)?.getTime() || 0)) * direction;
      }
      if (recordSortBy === "vehicle") {
        const sa = va ? `${va.brand} ${va.model}` : "";
        const sb = vb ? `${vb.brand} ${vb.model}` : "";
        return sa.localeCompare(sb, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (recordSortBy === "type") return maintenanceTypeLabel(a.type).localeCompare(maintenanceTypeLabel(b.type), "pt-BR") * direction;
      if (recordSortBy === "km") return ((a.km || 0) - (b.km || 0)) * direction;
      if (recordSortBy === "cost") return ((a.cost || 0) - (b.cost || 0)) * direction;
      return maintenanceStatusLabel(a.status).localeCompare(maintenanceStatusLabel(b.status), "pt-BR") * direction;
    });
  }, [records, selectedBranchId, vehicleMap, recordTypeFilter, recordStatusFilter, search, recordSortBy, recordSortDirection]);

  const scopedPlans = useMemo(() => {
    let filtered = selectedBranchId
      ? plans.filter((plan) => {
          const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);
          return vehicle?.branchId === selectedBranchId;
        })
      : plans;

    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((plan) => {
        const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);
        const text = [
          plan.name,
          maintenanceTypeLabel(plan.planType),
          planIntervalLabel(plan),
          planDueLabel(plan),
          plan.active ? "ativo" : "inativo",
          vehicle?.plate || "",
          vehicle ? formatVehicleLabel(vehicle) : "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(term);
      });
    }

    const direction = planSortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a.vehicle || vehicleMap.get(a.vehicleId);
      const vb = b.vehicle || vehicleMap.get(b.vehicleId);
      if (planSortBy === "name") return a.name.localeCompare(b.name, "pt-BR") * direction;
      if (planSortBy === "vehicle") {
        const sa = va ? `${va.brand} ${va.model}` : "";
        const sb = vb ? `${vb.brand} ${vb.model}` : "";
        return sa.localeCompare(sb, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (planSortBy === "interval") return planIntervalLabel(a).localeCompare(planIntervalLabel(b), "pt-BR") * direction;
      if (planSortBy === "due") {
        const ad = parseDate(a.nextDueDate || undefined)?.getTime() || (a.nextDueKm || 0);
        const bd = parseDate(b.nextDueDate || undefined)?.getTime() || (b.nextDueKm || 0);
        return (ad - bd) * direction;
      }
      return (Number(a.active) - Number(b.active)) * direction;
    });
  }, [plans, selectedBranchId, vehicleMap, search, planSortBy, planSortDirection]);

  const scopedTires = useMemo(() => {
    let filtered = selectedBranchId
      ? tires.filter((tire) => {
          if (!tire.vehicleId) return true;
          const vehicle = tire.vehicle || vehicleMap.get(tire.vehicleId);
          return vehicle?.branchId === selectedBranchId;
        })
      : tires;

    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((tire) => {
        const vehicle = tire.vehicleId ? tire.vehicle || vehicleMap.get(tire.vehicleId) : undefined;
        const text = [
          tire.serialNumber,
          `${tire.brand} ${tire.model}`,
          tire.size,
          tireStatusLabel(tire.status),
          tire.axlePosition || "",
          tire.wheelPosition || "",
          vehicle?.plate || "",
          vehicle ? formatVehicleLabel(vehicle) : "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(term);
      });
    }

    const direction = tireSortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a.vehicleId ? a.vehicle || vehicleMap.get(a.vehicleId) : undefined;
      const vb = b.vehicleId ? b.vehicle || vehicleMap.get(b.vehicleId) : undefined;
      if (tireSortBy === "serial") return a.serialNumber.localeCompare(b.serialNumber, "pt-BR") * direction;
      if (tireSortBy === "tire") return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR") * direction;
      if (tireSortBy === "vehicle") {
        const sa = va ? `${va.brand} ${va.model}` : "";
        const sb = vb ? `${vb.brand} ${vb.model}` : "";
        return sa.localeCompare(sb, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (tireSortBy === "km") return ((a.currentKm || 0) - (b.currentKm || 0)) * direction;
      return tireStatusLabel(a.status).localeCompare(tireStatusLabel(b.status), "pt-BR") * direction;
    });
  }, [tires, selectedBranchId, vehicleMap, search, tireSortBy, tireSortDirection]);

  const recordTotalPages = useMemo(
    () => Math.max(1, Math.ceil(scopedRecords.length / TABLE_PAGE_SIZE)),
    [scopedRecords.length]
  );
  const planTotalPages = useMemo(
    () => Math.max(1, Math.ceil(scopedPlans.length / TABLE_PAGE_SIZE)),
    [scopedPlans.length]
  );
  const tireTotalPages = useMemo(
    () => Math.max(1, Math.ceil(scopedTires.length / TABLE_PAGE_SIZE)),
    [scopedTires.length]
  );

  const paginatedRecords = useMemo(() => {
    const start = (recordPage - 1) * TABLE_PAGE_SIZE;
    return scopedRecords.slice(start, start + TABLE_PAGE_SIZE);
  }, [scopedRecords, recordPage]);
  const paginatedPlans = useMemo(() => {
    const start = (planPage - 1) * TABLE_PAGE_SIZE;
    return scopedPlans.slice(start, start + TABLE_PAGE_SIZE);
  }, [scopedPlans, planPage]);
  const paginatedTires = useMemo(() => {
    const start = (tirePage - 1) * TABLE_PAGE_SIZE;
    return scopedTires.slice(start, start + TABLE_PAGE_SIZE);
  }, [scopedTires, tirePage]);

  useEffect(() => {
    setRecordPage(1);
  }, [search, selectedBranchId, recordTypeFilter, recordStatusFilter, recordSortBy, recordSortDirection]);
  useEffect(() => {
    setPlanPage(1);
  }, [search, selectedBranchId, planSortBy, planSortDirection]);
  useEffect(() => {
    setTirePage(1);
  }, [search, selectedBranchId, tireSortBy, tireSortDirection]);

  useEffect(() => {
    if (recordPage > recordTotalPages) setRecordPage(recordTotalPages);
  }, [recordPage, recordTotalPages]);
  useEffect(() => {
    if (planPage > planTotalPages) setPlanPage(planTotalPages);
  }, [planPage, planTotalPages]);
  useEffect(() => {
    if (tirePage > tireTotalPages) setTirePage(tireTotalPages);
  }, [tirePage, tireTotalPages]);

  const maintenanceMetrics = useMemo(() => {
    const pending = scopedRecords.filter((record) => record.status !== "DONE").length;
    const done = scopedRecords.length - pending;
    const cost = scopedRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    return { total: scopedRecords.length, pending, done, cost };
  }, [scopedRecords]);

  const planMetrics = useMemo(() => {
    const active = scopedPlans.filter((plan) => plan.active).length;
    const dueSoon = scopedPlans.filter((plan) => {
      if (!plan.active || !plan.nextDueDate) return false;
      const due = parseDate(plan.nextDueDate);
      if (!due) return false;
      const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).length;
    const overdue = scopedPlans.filter((plan) => {
      if (!plan.active || !plan.nextDueDate) return false;
      const due = parseDate(plan.nextDueDate);
      return Boolean(due && due.getTime() < Date.now());
    }).length;
    return { total: scopedPlans.length, active, dueSoon, overdue };
  }, [scopedPlans]);

  const tireMetrics = useMemo(() => {
    const installed = scopedTires.filter((tire) => tire.status === "INSTALLED").length;
    const invested = scopedTires.reduce((sum, tire) => sum + (tire.purchaseCost || 0), 0);
    return { total: scopedTires.length, installed, alerts: tireAlerts.length, invested };
  }, [scopedTires, tireAlerts]);

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles, maintenanceRecords: records }),
    [vehicles, records],
  );

  function normalizePartLabel(value: string) {
    return value.replace(/[.,;]+$/g, "").trim();
  }

  function normalizeSerialLabel(value: string) {
    return value
      .replace(/[.,;]+$/g, "")
      .trim()
      .toUpperCase();
  }

  function getFieldClass(hasError: boolean) {
    if (hasError) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  function addParts(parts: string[]) {
    const normalized = parts.map(normalizePartLabel).filter(Boolean);
    if (!normalized.length) return;
    setRecordForm((prev) => {
      const next = [...prev.partsReplaced];
      for (const part of normalized) {
        if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) {
          next.push(part);
        }
      }
      return { ...prev, partsReplaced: next };
    });
  }

  function removePart(partToRemove: string) {
    setRecordForm((prev) => ({
      ...prev,
      partsReplaced: prev.partsReplaced.filter((part) => part !== partToRemove),
    }));
  }

  function addTireSerials(serials: string[]) {
    const normalized = serials.map(normalizeSerialLabel).filter(Boolean);
    if (!normalized.length) return;
    setTireSerialBatch((prev) => {
      const next = [...prev];
      for (const serial of normalized) {
        if (!next.some((item) => item.toLowerCase() === serial.toLowerCase())) {
          next.push(serial);
        }
      }
      return next;
    });
  }

  function removeTireSerial(serialToRemove: string) {
    setTireSerialBatch((prev) => prev.filter((serial) => serial !== serialToRemove));
  }

  function openCreateRecord() {
    setEditingRecord(null);
    setRecordFieldErrors({});
    const defaultVehicleId = "";
    const latestKm = undefined;
    setRecordForm({
      ...initialRecordForm,
      vehicleId: defaultVehicleId,
      km: typeof latestKm === "number" ? String(latestKm) : "",
    });
    setPartsInput("");
    setRecordModalOpen(true);
  }

  function openEditRecord(record: MaintenanceRecord) {
    setEditingRecord(record);
    setRecordFieldErrors({});
    setRecordForm({
      vehicleId: record.vehicleId,
      type: (record.type as RecordFormState["type"]) || "",
      description: record.description || "",
      partsReplaced: Array.isArray(record.partsReplaced) ? record.partsReplaced.filter(Boolean) : [],
      workshop: record.workshop || "",
      cost: String(record.cost ?? ""),
      km: String(record.km ?? ""),
      maintenanceDate: String(record.maintenanceDate).slice(0, 10),
      status: (record.status as RecordFormState["status"]) || "",
      notes: record.notes || "",
    });
    setPartsInput("");
    setRecordModalOpen(true);
  }

  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    const pendingPart = normalizePartLabel(partsInput);
    const mergedParts = pendingPart
      ? Array.from(new Set([...recordForm.partsReplaced, pendingPart]))
      : recordForm.partsReplaced;

    const nextErrors: Partial<Record<RecordFieldKey, string>> = {};
    if (!recordForm.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
    if (!recordForm.type) nextErrors.type = "Selecione o tipo.";
    if (!recordForm.status) nextErrors.status = "Selecione o status.";
    if (!recordForm.description.trim()) nextErrors.description = "Informe a descrição.";
    if (!recordForm.maintenanceDate) nextErrors.maintenanceDate = "Informe a data.";
    if (!recordForm.km) nextErrors.km = "Informe o KM.";
    if (!recordForm.cost) nextErrors.cost = "Informe o custo.";
    setRecordFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload: CreateMaintenanceRecordInput = {
      vehicleId: recordForm.vehicleId,
      type: recordForm.type as "PREVENTIVE" | "CORRECTIVE" | "PERIODIC",
      description: recordForm.description.trim(),
      partsReplaced: mergedParts.length ? mergedParts : undefined,
      workshop: recordForm.workshop.trim() || undefined,
      cost: toNumber(recordForm.cost),
      km: Number(recordForm.km) || 0,
      maintenanceDate: recordForm.maintenanceDate,
      status: recordForm.status as "OPEN" | "DONE",
      notes: recordForm.notes.trim() || undefined,
    };

    try {
      setRecordSaving(true);
      setRecordFieldErrors({});
      if (editingRecord) await updateMaintenanceRecord(editingRecord.id, payload);
      else await createMaintenanceRecord(payload);
      setPartsInput("");
      setRecordModalOpen(false);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch {
      setRecordFieldErrors((prev) => ({
        ...prev,
        description: prev.description || "Não foi possível salvar. Revise os dados.",
      }));
    } finally {
      setRecordSaving(false);
    }
  }

  async function removeRecord(record: MaintenanceRecord) {
    setRecordToDelete(record);
  }

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanFieldErrors({});
    setPlanForm({ ...initialPlanForm });
    setPlanModalOpen(true);
  }

  function openEditPlan(plan: MaintenancePlan) {
    setEditingPlan(plan);
    setPlanFieldErrors({});
    setPlanForm({
      vehicleId: plan.vehicleId,
      name: plan.name || "",
      planType: (plan.planType as PlanFormState["planType"]) || "",
      intervalUnit: (plan.intervalUnit as PlanFormState["intervalUnit"]) || "",
      intervalValue: String(plan.intervalValue || ""),
      alertBeforeDays: String(plan.alertBeforeDays || ""),
      alertBeforeKm: String(plan.alertBeforeKm || ""),
      nextDueDate: plan.nextDueDate ? String(plan.nextDueDate).slice(0, 10) : "",
      nextDueKm: String(plan.nextDueKm || ""),
      active: typeof plan.active === "boolean" ? plan.active : "",
      notes: plan.notes || "",
    });
    setPlanModalOpen(true);
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<PlanFieldKey, string>> = {};
    if (!planForm.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
    if (!planForm.name.trim()) nextErrors.name = "Informe o nome do plano.";
    if (!planForm.planType) nextErrors.planType = "Selecione o tipo.";
    if (planForm.active === "") nextErrors.active = "Selecione o status.";
    if (!planForm.intervalUnit) nextErrors.intervalUnit = "Selecione a unidade do intervalo.";
    if (!planForm.intervalValue.trim()) nextErrors.intervalValue = "Informe o intervalo.";
    setPlanFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload: CreateMaintenancePlanInput = {
      vehicleId: planForm.vehicleId,
      name: planForm.name.trim(),
      planType: planForm.planType as "PREVENTIVE" | "PERIODIC",
      intervalUnit: planForm.intervalUnit as "DAY" | "MONTH" | "KM",
      intervalValue: Number(planForm.intervalValue) || 0,
      alertBeforeDays: planForm.alertBeforeDays ? Number(planForm.alertBeforeDays) : undefined,
      alertBeforeKm: planForm.alertBeforeKm ? Number(planForm.alertBeforeKm) : undefined,
      nextDueDate: planForm.nextDueDate || undefined,
      nextDueKm: planForm.nextDueKm ? Number(planForm.nextDueKm) : undefined,
      active: Boolean(planForm.active),
      notes: planForm.notes.trim() || undefined,
    };

    try {
      setPlanSaving(true);
      setPlanFieldErrors({});
      if (editingPlan) await updateMaintenancePlan(editingPlan.id, payload);
      else await createMaintenancePlan(payload);
      setPlanModalOpen(false);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch {
      setPlanFieldErrors((prev) => ({
        ...prev,
        name: prev.name || "Não foi possível salvar. Revise os dados.",
      }));
    } finally {
      setPlanSaving(false);
    }
  }

  async function removePlan(plan: MaintenancePlan) {
    setPlanToDelete(plan);
  }

  function openCreateTire() {
    setEditingTire(null);
    setTireFieldErrors({});
    setTireSerialBatch([]);
    setTireSerialInput("");
    const defaultVehicleId = "";
    const latestKm = undefined;
    setTireForm({
      ...initialTireForm,
      vehicleId: defaultVehicleId,
      currentKm: typeof latestKm === "number" ? String(latestKm) : "",
    });
    setTireModalOpen(true);
  }

  function openEditTire(tire: Tire) {
    setEditingTire(tire);
    setTireFieldErrors({});
    setTireSerialBatch([]);
    setTireSerialInput("");
    setTireForm({
      serialNumber: tire.serialNumber || "",
      brand: tire.brand || "",
      model: tire.model || "",
      size: tire.size || "",
      status: tire.status || "",
      vehicleId: tire.vehicleId || "",
      axlePosition: tire.axlePosition || "",
      wheelPosition: tire.wheelPosition || "",
      currentKm: String(tire.currentKm || ""),
      targetPressurePsi: String(tire.targetPressurePsi || ""),
      purchaseDate: tire.purchaseDate ? String(tire.purchaseDate).slice(0, 10) : "",
      purchaseCost: String(tire.purchaseCost || ""),
      installedAt: tire.installedAt ? String(tire.installedAt).slice(0, 10) : "",
      notes: tire.notes || "",
    });
    setTireModalOpen(true);
  }

  async function saveTire(event: React.FormEvent) {
    event.preventDefault();
    const pendingSerial = normalizeSerialLabel(tireSerialInput);
    const mergedSerials = pendingSerial
      ? Array.from(new Set([...tireSerialBatch, pendingSerial]))
      : tireSerialBatch;
    const nextErrors: Partial<Record<TireFieldKey, string>> = {};
    if (editingTire) {
      if (!tireForm.serialNumber.trim()) nextErrors.serialNumber = "Informe o DOT/TIN.";
    } else if (!mergedSerials.length) {
      nextErrors.serialNumber = "Informe ao menos um DOT/TIN.";
    }
    if (!tireForm.status) nextErrors.status = "Selecione o status.";
    if (!tireForm.brand.trim()) nextErrors.brand = "Informe a marca.";
    if (!tireForm.model.trim()) nextErrors.model = "Informe o modelo.";
    if (!tireForm.size.trim()) nextErrors.size = "Informe a medida.";
    setTireFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    const payloadBase: Omit<CreateTireInput, "serialNumber"> = {
      brand: tireForm.brand.trim(),
      model: tireForm.model.trim(),
      size: tireForm.size.trim(),
      status: tireForm.status as TireStatus,
      vehicleId: tireForm.vehicleId || undefined,
      axlePosition: tireForm.axlePosition.trim() || undefined,
      wheelPosition: tireForm.wheelPosition.trim() || undefined,
      currentKm: Number(tireForm.currentKm) || 0,
      targetPressurePsi: tireForm.targetPressurePsi ? toNumber(tireForm.targetPressurePsi) : undefined,
      purchaseDate: tireForm.purchaseDate || undefined,
      purchaseCost: tireForm.purchaseCost ? toNumber(tireForm.purchaseCost) : undefined,
      installedAt: tireForm.installedAt || undefined,
      notes: tireForm.notes.trim() || undefined,
    };

    try {
      setTireSaving(true);
      setTireFieldErrors({});
      if (editingTire) {
        await updateTire(editingTire.id, {
          ...payloadBase,
          serialNumber: tireForm.serialNumber.trim().toUpperCase(),
        });
      } else {
        const failures: string[] = [];
        for (const serialNumber of mergedSerials) {
          try {
            await createTire({
              ...payloadBase,
              serialNumber,
            });
          } catch {
            failures.push(serialNumber);
          }
        }

        if (failures.length) {
          setTireFieldErrors((prev) => ({
            ...prev,
            serialNumber:
              failures.length === mergedSerials.length
                ? "Nao foi possivel cadastrar os DOT/TIN informados. Revise os dados."
                : `Alguns DOT/TIN nao foram cadastrados: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? "..." : ""}`,
          }));
          return;
        }
      }
      setTireModalOpen(false);
      setTireSerialBatch([]);
      setTireSerialInput("");
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch {
      setTireFieldErrors((prev) => ({
        ...prev,
        serialNumber: prev.serialNumber || "Não foi possível salvar. Revise os dados.",
      }));
    } finally {
      setTireSaving(false);
    }
  }

  async function removeTire(tire: Tire) {
    setTireToDelete(tire);
  }

  async function confirmRemoveRecord() {
    if (!recordToDelete) return;
    await deleteMaintenanceRecord(recordToDelete.id);
    setRecordToDelete(null);
    await loadData();
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  async function confirmRemovePlan() {
    if (!planToDelete) return;
    await deleteMaintenancePlan(planToDelete.id);
    setPlanToDelete(null);
    await loadData();
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  async function confirmRemoveTire() {
    if (!tireToDelete) return;
    await deleteTire(tireToDelete.id);
    setTireToDelete(null);
    await loadData();
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  async function openReadingModal(tire: Tire) {
    setSelectedTire(tire);
    setReadingFieldErrors({});
    setReadingForm({
      ...initialReadingForm,
      km: String(tire.currentKm || ""),
      pressurePsi: tire.currentPressurePsi ? String(tire.currentPressurePsi) : "",
      treadDepthMm: tire.currentTreadDepthMm ? String(tire.currentTreadDepthMm) : "",
    });
    const readings = await getTireReadings(tire.id);
    setTireReadings(Array.isArray(readings) ? readings : []);
    setReadingModalOpen(true);
  }

  async function saveReading(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTire) return;
    const nextErrors: Partial<Record<ReadingFieldKey, string>> = {};
    if (!readingForm.readingDate) nextErrors.readingDate = "Informe a data.";
    if (!readingForm.km) nextErrors.km = "Informe o KM.";
    if (!readingForm.treadDepthMm) nextErrors.treadDepthMm = "Informe o sulco.";
    if (!readingForm.pressurePsi) nextErrors.pressurePsi = "Informe a pressão.";
    setReadingFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload: CreateTireReadingInput = {
      readingDate: readingForm.readingDate,
      km: Number(readingForm.km) || 0,
      treadDepthMm: toNumber(readingForm.treadDepthMm),
      pressurePsi: toNumber(readingForm.pressurePsi),
      condition: readingForm.condition.trim() || undefined,
      notes: readingForm.notes.trim() || undefined,
      vehicleId: selectedTire.vehicleId || undefined,
    };

    try {
      setReadingSaving(true);
      setReadingFieldErrors({});
      await createTireReading(selectedTire.id, payload);
      const readings = await getTireReadings(selectedTire.id);
      setTireReadings(Array.isArray(readings) ? readings : []);
      await loadData();
      setReadingForm(initialReadingForm);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    } catch {
      setReadingFieldErrors((prev) => ({
        ...prev,
        readingDate: prev.readingDate || "Não foi possível salvar. Revise os dados.",
      }));
    } finally {
      setReadingSaving(false);
    }
  }

  function handleRecordSort(column: RecordSortBy) {
    if (recordSortBy === column) {
      setRecordSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setRecordSortBy(column);
    setRecordSortDirection("asc");
  }

  function handlePlanSort(column: PlanSortBy) {
    if (planSortBy === column) {
      setPlanSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setPlanSortBy(column);
    setPlanSortDirection("asc");
  }

  function handleTireSort(column: TireSortBy) {
    if (tireSortBy === column) {
      setTireSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setTireSortBy(column);
    setTireSortDirection("asc");
  }

  function sortArrow(activeColumn: string, currentColumn: string, direction: SortDirection) {
    if (activeColumn !== currentColumn) return "↕";
    return direction === "asc" ? "↑" : "↓";
  }

  const actionLabel =
    tab === "records" ? "Registrar manutenção" : tab === "plans" ? "Novo plano de manutenção" : "Cadastrar pneu";

  return (
    <div className="min-w-0 space-y-6">
      <section className={`${tab === "records" ? "rounded-t-2xl rounded-b-none border-b-0" : "rounded-2xl"} border border-slate-200 bg-white p-4 shadow-sm`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manutenções</h1>
            <p className="text-sm text-slate-500">Gestão de manutenção preventiva, corretiva, planos e pneus.</p>
          </div>
          <button
            type="button"
            onClick={() => (tab === "records" ? openCreateRecord() : tab === "plans" ? openCreatePlan() : openCreateTire())}
            className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 md:w-auto"
          >
            + {actionLabel}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
          <button type="button" onClick={() => setTab("records")} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "records" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>Manutenções</button>
          <button type="button" onClick={() => setTab("plans")} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "plans" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>Planos de manutenção</button>
          <button type="button" onClick={() => setTab("tires")} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "tires" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>Gestão de pneus</button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      {tab === "records" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p><p className="mt-1 text-2xl font-bold text-slate-900">{maintenanceMetrics.total}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendentes</p><p className="mt-1 text-2xl font-bold text-amber-800">{maintenanceMetrics.pending}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Concluídas</p><p className="mt-1 text-2xl font-bold text-emerald-800">{maintenanceMetrics.done}</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Custo total</p><p className="mt-1 text-2xl font-bold text-blue-900">{toMoney(maintenanceMetrics.cost)}</p></div>
        </div>
      ) : null}

      {tab === "plans" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p><p className="mt-1 text-2xl font-bold text-slate-900">{planMetrics.total}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativos</p><p className="mt-1 text-2xl font-bold text-emerald-800">{planMetrics.active}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Vencem em 7 dias</p><p className="mt-1 text-2xl font-bold text-amber-800">{planMetrics.dueSoon}</p></div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Vencidos</p><p className="mt-1 text-2xl font-bold text-red-800">{planMetrics.overdue}</p></div>
        </div>
      ) : null}

      {tab === "tires" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pneus totais</p><p className="mt-1 text-2xl font-bold text-slate-900">{tireMetrics.total}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Instalados</p><p className="mt-1 text-2xl font-bold text-emerald-800">{tireMetrics.installed}</p></div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Alertas</p><p className="mt-1 text-2xl font-bold text-orange-800">{tireMetrics.alerts}</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Investimento</p><p className="mt-1 text-2xl font-bold text-blue-900">{toMoney(tireMetrics.invested)}</p></div>
        </div>
      ) : null}

      <section className={`${tab === "records" ? "rounded-t-2xl rounded-b-none border-b-0" : "rounded-2xl"} border border-slate-200 bg-white p-4 shadow-sm`}>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tab === "records" ? "Buscar por veículo, tipo, status, descrição..." : tab === "plans" ? "Buscar por plano, veículo, intervalo..." : "Buscar por DOT/TIN, pneu, status, veículo..."}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          {tab === "records" ? (
            <>
              <select
                value={recordTypeFilter}
                onChange={(event) => setRecordTypeFilter(event.target.value as "ALL" | "PREVENTIVE" | "CORRECTIVE" | "PERIODIC")}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              >
                <option value="ALL">Todas as categorias</option>
                <option value="PREVENTIVE">Preventiva</option>
                <option value="CORRECTIVE">Corretiva</option>
                <option value="PERIODIC">Periódica</option>
              </select>
              <select
                value={recordStatusFilter}
                onChange={(event) => setRecordStatusFilter(event.target.value as "ALL" | "OPEN" | "DONE")}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              >
                <option value="ALL">Todos os status</option>
                <option value="OPEN">Pendente</option>
                <option value="DONE">Concluída</option>
              </select>
            </>
          ) : null}
        </div>
      </section>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Carregando...</section> : null}

      {!loading && tab === "records" ? (
        <section className="-mt-6 overflow-hidden rounded-b-2xl rounded-t-none border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("date")} className="cursor-pointer">Data {sortArrow("date", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("vehicle")} className="cursor-pointer">Veículo {sortArrow("vehicle", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("type")} className="cursor-pointer">Tipo {sortArrow("type", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("km")} className="cursor-pointer">KM {sortArrow("km", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("cost")} className="cursor-pointer">Custo {sortArrow("cost", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleRecordSort("status")} className="cursor-pointer">Status {sortArrow("status", recordSortBy, recordSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {scopedRecords.length === 0 ? <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Nenhuma manutenção encontrada.</td></tr> : paginatedRecords.map((record) => {
                  const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
                  const isHighlighted = highlightId === record.id;
                  return (
                    <tr id={`maintenance-row-${record.id}`} key={record.id} className={`border-t border-slate-200 ${isHighlighted ? "notification-highlight" : ""}`}>
                      <td className="px-6 py-4 text-sm text-slate-700">{toDateBR(record.maintenanceDate)}</td>
                      <td className="px-6 py-4 text-sm text-slate-900"><p className="font-medium">{vehicle ? formatVehicleLabel(vehicle) : "-"}</p></td>
                      <td className="px-6 py-4 text-sm text-slate-700">{maintenanceTypeLabel(record.type)}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{record.km?.toLocaleString("pt-BR") || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{toMoney(Number(record.cost || 0))}</td>
                      <td className="px-6 py-4 text-sm"><span className={`status-pill ${record.status === "DONE" ? "status-active" : "status-pending"}`}>{maintenanceStatusLabel(record.status)}</span></td>
                      <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button type="button" onClick={() => openEditRecord(record)} className="btn-ui btn-ui-neutral">Editar</button><button type="button" onClick={() => removeRecord(record)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                    </tr>
                  );
                })}
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
              onNext={() => setRecordPage((prev) => Math.min(prev + 1, recordTotalPages))}
            />
          ) : null}
        </section>
      ) : null}

      {!loading && tab === "plans" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handlePlanSort("name")} className="cursor-pointer">Plano {sortArrow("name", planSortBy, planSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handlePlanSort("vehicle")} className="cursor-pointer">Veículo {sortArrow("vehicle", planSortBy, planSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handlePlanSort("interval")} className="cursor-pointer">Intervalo {sortArrow("interval", planSortBy, planSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handlePlanSort("due")} className="cursor-pointer">Próximo vencimento {sortArrow("due", planSortBy, planSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handlePlanSort("status")} className="cursor-pointer">Status {sortArrow("status", planSortBy, planSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {scopedPlans.length === 0 ? <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Nenhum plano encontrado.</td></tr> : paginatedPlans.map((plan) => {
                  const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);
                  return (
                    <tr key={plan.id} className="border-t border-slate-200">
                      <td className="px-6 py-4 text-sm text-slate-900"><p className="font-medium">{plan.name}</p><p className="text-xs text-slate-500">{maintenanceTypeLabel(plan.planType)}</p></td>
                      <td className="px-6 py-4 text-sm text-slate-700"><p>{vehicle ? formatVehicleLabel(vehicle) : "-"}</p></td>
                      <td className="px-6 py-4 text-sm text-slate-700">{planIntervalLabel(plan)}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{planDueLabel(plan)}</td>
                      <td className="px-6 py-4 text-sm"><span className={`status-pill ${plan.active ? "status-active" : "status-inactive"}`}>{plan.active ? "Ativo" : "Inativo"}</span></td>
                      <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button type="button" onClick={() => openEditPlan(plan)} className="btn-ui btn-ui-neutral">Editar</button><button type="button" onClick={() => removePlan(plan)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                    </tr>
                  );
                })}
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
        </section>
      ) : null}

      {!loading && tab === "tires" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleTireSort("serial")} className="cursor-pointer">DOT/TIN {sortArrow("serial", tireSortBy, tireSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleTireSort("tire")} className="cursor-pointer">Pneu {sortArrow("tire", tireSortBy, tireSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleTireSort("vehicle")} className="cursor-pointer">Veículo / posição {sortArrow("vehicle", tireSortBy, tireSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleTireSort("km")} className="cursor-pointer">Leitura {sortArrow("km", tireSortBy, tireSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleTireSort("status")} className="cursor-pointer">Status {sortArrow("status", tireSortBy, tireSortDirection)}</button></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {scopedTires.length === 0 ? <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Nenhum pneu encontrado.</td></tr> : paginatedTires.map((tire) => {
                  const vehicle = tire.vehicle || (tire.vehicleId ? vehicleMap.get(tire.vehicleId) : undefined);
                  return (
                    <tr key={tire.id} className="border-t border-slate-200">
                      <td className="px-6 py-4 text-sm text-slate-700">{tire.serialNumber}</td>
                      <td className="px-6 py-4 text-sm text-slate-900"><p className="font-medium">{tire.brand} {tire.model}</p><p className="text-xs text-slate-500">{tire.size}</p></td>
                      <td className="px-6 py-4 text-sm text-slate-700"><p>{vehicle ? formatVehicleLabel(vehicle) : "Sem veículo"}</p><p className="text-xs text-slate-500">{tire.axlePosition || "-"} / {tire.wheelPosition || "-"}</p></td>
                      <td className="px-6 py-4 text-sm text-slate-700"><p>KM: {tire.currentKm || 0}</p><p className="text-xs text-slate-500">Pressão recomendada: {typeof tire.targetPressurePsi === "number" ? `${tire.targetPressurePsi} PSI` : "-"}</p></td>
                      <td className="px-6 py-4 text-sm"><span className={`status-pill ${tireStatusClass(tire.status)}`}>{tireStatusLabel(tire.status)}</span></td>
                      <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button type="button" onClick={() => openReadingModal(tire)} className="btn-ui btn-ui-neutral">Leituras</button><button type="button" onClick={() => openEditTire(tire)} className="btn-ui btn-ui-neutral">Editar</button><button type="button" onClick={() => removeTire(tire)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scopedTires.length > 0 ? (
            <TablePagination
              currentPage={tirePage}
              totalPages={tireTotalPages}
              totalItems={scopedTires.length}
              pageSize={TABLE_PAGE_SIZE}
              itemLabel="pneus"
              onPrevious={() => setTirePage((prev) => Math.max(prev - 1, 1))}
              onNext={() => setTirePage((prev) => Math.min(prev + 1, tireTotalPages))}
            />
          ) : null}
        </section>
      ) : null}

      {recordModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingRecord ? "Editar manutenção" : "Registrar manutenção"}</h2>
                <p className="text-sm text-slate-500">Preencha os dados técnicos e financeiros da manutenção.</p>
              </div>
              <button type="button" onClick={() => setRecordModalOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100">Fechar</button>
            </div>
            <form onSubmit={saveRecord} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Veículo</label>
                  <select value={recordForm.vehicleId} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, vehicleId: undefined })); setRecordForm((prev) => { const vehicleId = event.target.value; if (editingRecord) return { ...prev, vehicleId }; const latestKm = latestKmByVehicle.get(vehicleId); return { ...prev, vehicleId, km: typeof latestKm === "number" ? String(latestKm) : "" }; }); }} className={getFieldClass(Boolean(recordFieldErrors.vehicleId))}>
                    <option value="">Selecione um veículo</option>
                    {(editingRecord ? scopedVehicles : activeVehicles).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}
                  </select>
                  {recordFieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.vehicleId}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tipo</label>
                  <select value={recordForm.type} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, type: undefined })); setRecordForm((prev) => ({ ...prev, type: event.target.value as RecordFormState["type"] })); }} className={getFieldClass(Boolean(recordFieldErrors.type))}>
                    <option value="">Selecione o tipo</option>
                    <option value="PREVENTIVE">Preventiva</option>
                    <option value="PERIODIC">Periódica</option>
                    <option value="CORRECTIVE">Corretiva</option>
                  </select>
                  {recordFieldErrors.type ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.type}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select value={recordForm.status} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, status: undefined })); setRecordForm((prev) => ({ ...prev, status: event.target.value as RecordFormState["status"] })); }} className={getFieldClass(Boolean(recordFieldErrors.status))}>
                    <option value="">Selecione o status</option>
                    <option value="OPEN">Pendente</option>
                    <option value="DONE">Concluída</option>
                  </select>
                  {recordFieldErrors.status ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.status}</p> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Descrição</label>
                  <input value={recordForm.description} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, description: undefined })); setRecordForm((prev) => ({ ...prev, description: event.target.value })); }} className={getFieldClass(Boolean(recordFieldErrors.description))} placeholder="Ex: troca de embreagem, revisão 20.000 km..." />
                  {recordFieldErrors.description ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.description}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Data</label>
                  <input type="date" value={recordForm.maintenanceDate} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, maintenanceDate: undefined })); setRecordForm((prev) => ({ ...prev, maintenanceDate: event.target.value })); }} className={getFieldClass(Boolean(recordFieldErrors.maintenanceDate))} />
                  {recordFieldErrors.maintenanceDate ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.maintenanceDate}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">KM</label>
                  <input type="number" min={0} value={recordForm.km} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, km: undefined })); setRecordForm((prev) => ({ ...prev, km: event.target.value })); }} className={getFieldClass(Boolean(recordFieldErrors.km))} placeholder="0" />
                  {recordFieldErrors.km ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.km}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Custo (R$)</label>
                  <input value={recordForm.cost} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, cost: undefined })); setRecordForm((prev) => ({ ...prev, cost: event.target.value })); }} className={getFieldClass(Boolean(recordFieldErrors.cost))} placeholder="0,00" />
                  {recordFieldErrors.cost ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.cost}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Oficina</label>
                  <input value={recordForm.workshop} onChange={(event) => setRecordForm((prev) => ({ ...prev, workshop: event.target.value }))} className={getFieldClass(false)} placeholder="Nome da oficina" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Peças trocadas</label>
                  <div className="mt-1 rounded-xl border border-slate-300 px-3 py-2 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200">
                    {recordForm.partsReplaced.length ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {recordForm.partsReplaced.map((part) => (
                          <span key={part} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {part}
                            <button type="button" onClick={() => removePart(part)} className="cursor-pointer text-blue-500 transition hover:text-blue-700">
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <input
                      value={partsInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        const chunks = value.split(/[,.]/);
                        if (chunks.length > 1) {
                          addParts(chunks.slice(0, -1));
                          setPartsInput(chunks[chunks.length - 1] || "");
                          return;
                        }
                        setPartsInput(value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addParts([partsInput]);
                          setPartsInput("");
                        }
                      }}
                      className="w-full border-0 px-0 py-1 text-sm outline-none"
                      placeholder="Ex: filtro de óleo, correia dentada, vela de ignição"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Obs.: digite o nome da peça e pressione Enter, vírgula ou ponto para adicionar cada item.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Observações</label>
                  <textarea rows={3} value={recordForm.notes} onChange={(event) => setRecordForm((prev) => ({ ...prev, notes: event.target.value }))} className={getFieldClass(false)} placeholder="Detalhes complementares" />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setRecordModalOpen(false)} className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={recordSaving} className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{recordSaving ? "Salvando..." : editingRecord ? "Salvar alterações" : "Registrar manutenção"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {planModalOpen ? (
        <div className="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingPlan ? "Editar plano de manutenção" : "Novo plano de manutenção"}</h2>
                <p className="text-sm text-slate-500">Configure frequência, alertas e vencimentos por veículo.</p>
              </div>
              <button type="button" onClick={() => setPlanModalOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100">Fechar</button>
            </div>
            <form onSubmit={savePlan} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Veículo</label><select value={planForm.vehicleId} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, vehicleId: undefined })); setPlanForm((prev) => ({ ...prev, vehicleId: event.target.value })); }} className={getFieldClass(Boolean(planFieldErrors.vehicleId))}><option value="">Selecione um veículo</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}</select>{planFieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.vehicleId}</p> : null}</div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Nome do plano</label><input value={planForm.name} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, name: undefined })); setPlanForm((prev) => ({ ...prev, name: event.target.value })); }} className={getFieldClass(Boolean(planFieldErrors.name))} placeholder="Ex: Revisão geral 10.000 km" />{planFieldErrors.name ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.name}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Tipo</label><select value={planForm.planType} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, planType: undefined })); setPlanForm((prev) => ({ ...prev, planType: event.target.value as PlanFormState["planType"] })); }} className={getFieldClass(Boolean(planFieldErrors.planType))}><option value="">Selecione o tipo</option><option value="PREVENTIVE">Preventivo</option><option value="PERIODIC">Periódico</option></select>{planFieldErrors.planType ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.planType}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={planForm.active === "" ? "" : planForm.active ? "ACTIVE" : "INACTIVE"} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, active: undefined })); setPlanForm((prev) => ({ ...prev, active: event.target.value === "" ? "" : event.target.value === "ACTIVE" })); }} className={getFieldClass(Boolean(planFieldErrors.active))}><option value="">Selecione o status</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select>{planFieldErrors.active ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.active}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Unidade do intervalo</label><select value={planForm.intervalUnit} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, intervalUnit: undefined })); setPlanForm((prev) => ({ ...prev, intervalUnit: event.target.value as PlanFormState["intervalUnit"] })); }} className={getFieldClass(Boolean(planFieldErrors.intervalUnit))}><option value="">Selecione a unidade do intervalo</option><option value="KM">KM</option><option value="DAY">Dia(s)</option><option value="MONTH">Mês(es)</option></select>{planFieldErrors.intervalUnit ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.intervalUnit}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Valor do intervalo</label><input type="number" min={1} value={planForm.intervalValue} onChange={(event) => { setPlanFieldErrors((prev) => ({ ...prev, intervalValue: undefined })); setPlanForm((prev) => ({ ...prev, intervalValue: event.target.value })); }} className={getFieldClass(Boolean(planFieldErrors.intervalValue))} placeholder="Ex: 10000" />{planFieldErrors.intervalValue ? <p className="mt-1 text-xs text-red-600">{planFieldErrors.intervalValue}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Alerta antes (dias)</label><input type="number" min={0} value={planForm.alertBeforeDays} onChange={(event) => setPlanForm((prev) => ({ ...prev, alertBeforeDays: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 5" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Alerta antes (KM)</label><input type="number" min={0} value={planForm.alertBeforeKm} onChange={(event) => setPlanForm((prev) => ({ ...prev, alertBeforeKm: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 500" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Próxima data</label><input type="date" value={planForm.nextDueDate} onChange={(event) => setPlanForm((prev) => ({ ...prev, nextDueDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Próximo KM</label><input type="number" min={0} value={planForm.nextDueKm} onChange={(event) => setPlanForm((prev) => ({ ...prev, nextDueKm: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 120000" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Observações</label><textarea rows={3} value={planForm.notes} onChange={(event) => setPlanForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Detalhes adicionais do plano" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setPlanModalOpen(false)} className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={planSaving} className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{planSaving ? "Salvando..." : editingPlan ? "Salvar alterações" : "Salvar plano"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tireModalOpen ? (
        <div className="fixed inset-0 z-[62] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div><h2 className="text-xl font-bold text-slate-900">{editingTire ? "Editar pneu" : "Cadastrar pneu"}</h2><p className="text-sm text-slate-500">Gestão técnica e operacional dos pneus da frota.</p></div>
              <button type="button" onClick={() => setTireModalOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100">Fechar</button>
            </div>
            <form onSubmit={saveTire} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {editingTire ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">DOT/TIN</label>
                    <input
                      value={tireForm.serialNumber}
                      onChange={(event) => {
                        setTireFieldErrors((prev) => ({ ...prev, serialNumber: undefined }));
                        setTireForm((prev) => ({ ...prev, serialNumber: event.target.value }));
                      }}
                      className={getFieldClass(Boolean(tireFieldErrors.serialNumber))}
                      placeholder="Ex: 4B08 A3R 2219"
                    />
                    {tireFieldErrors.serialNumber ? (
                      <p className="mt-1 text-xs text-red-600">{tireFieldErrors.serialNumber}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">DOT/TIN (lote)</label>
                    <div
                      className={`mt-1 rounded-xl border px-3 py-3 ${
                        tireFieldErrors.serialNumber ? "border-red-400 bg-red-50" : "border-slate-300"
                      }`}
                    >
                      {tireSerialBatch.length ? (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {tireSerialBatch.map((serial) => (
                            <span
                              key={serial}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {serial}
                              <button
                                type="button"
                                onClick={() => removeTireSerial(serial)}
                                className="cursor-pointer text-slate-500 hover:text-slate-700"
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <input
                        value={tireSerialInput}
                        onChange={(event) => {
                          setTireFieldErrors((prev) => ({ ...prev, serialNumber: undefined }));
                          setTireSerialInput(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "," || event.key === ".") {
                            event.preventDefault();
                            const chunks = tireSerialInput.split(/[,.]/).map((item) => item.trim());
                            addTireSerials(chunks);
                            setTireSerialInput("");
                          }
                        }}
                        onBlur={() => {
                          if (tireSerialInput.trim()) {
                            addTireSerials([tireSerialInput]);
                            setTireSerialInput("");
                          }
                        }}
                        className="w-full border-none bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        placeholder="Digite o DOT/TIN e pressione Enter, vírgula ou ponto"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Cadastre vários pneus de uma vez com mesma marca/modelo/medida.
                    </p>
                    {tireFieldErrors.serialNumber ? (
                      <p className="mt-1 text-xs text-red-600">{tireFieldErrors.serialNumber}</p>
                    ) : null}
                  </div>
                )}
                <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={tireForm.status} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, status: undefined })); setTireForm((prev) => ({ ...prev, status: event.target.value as TireStatus | "" })); }} className={getFieldClass(Boolean(tireFieldErrors.status))}><option value="">Selecione o status</option><option value="IN_STOCK">Estoque</option><option value="INSTALLED">Instalado</option><option value="MAINTENANCE">Manutenção</option><option value="RETREADED">Recapado</option><option value="SCRAPPED">Descartado</option></select>{tireFieldErrors.status ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.status}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Marca</label><input value={tireForm.brand} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, brand: undefined })); setTireForm((prev) => ({ ...prev, brand: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.brand))} placeholder="Ex: Michelin" />{tireFieldErrors.brand ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.brand}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Modelo</label><input value={tireForm.model} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, model: undefined })); setTireForm((prev) => ({ ...prev, model: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.model))} placeholder="Ex: X Multi D" />{tireFieldErrors.model ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.model}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Medida</label><input value={tireForm.size} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, size: undefined })); setTireForm((prev) => ({ ...prev, size: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.size))} placeholder="Ex: 295/80R22.5" />{tireFieldErrors.size ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.size}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Veículo</label><select value={tireForm.vehicleId} onChange={(event) => setTireForm((prev) => { const vehicleId = event.target.value; if (editingTire) return { ...prev, vehicleId }; const latestKm = latestKmByVehicle.get(vehicleId); return { ...prev, vehicleId, currentKm: typeof latestKm === "number" ? String(latestKm) : "" }; })} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"><option value="">Selecione um veículo</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700">Posição do eixo</label><input value={tireForm.axlePosition} onChange={(event) => setTireForm((prev) => ({ ...prev, axlePosition: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: Traseiro" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Posição da roda</label><input value={tireForm.wheelPosition} onChange={(event) => setTireForm((prev) => ({ ...prev, wheelPosition: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: Dianteira direita" /></div>
                <div><label className="block text-sm font-medium text-slate-700">KM atual</label><input type="number" min={0} value={tireForm.currentKm} onChange={(event) => setTireForm((prev) => ({ ...prev, currentKm: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 128500" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Pressão recomendada (PSI)</label><input value={tireForm.targetPressurePsi} onChange={(event) => setTireForm((prev) => ({ ...prev, targetPressurePsi: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 100" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Data de compra</label><input type="date" value={tireForm.purchaseDate} onChange={(event) => setTireForm((prev) => ({ ...prev, purchaseDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Custo de compra (R$)</label><input value={tireForm.purchaseCost} onChange={(event) => setTireForm((prev) => ({ ...prev, purchaseCost: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: 1850,00" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Data de instalação</label><input type="date" value={tireForm.installedAt} onChange={(event) => setTireForm((prev) => ({ ...prev, installedAt: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Observações</label><textarea rows={3} value={tireForm.notes} onChange={(event) => setTireForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Detalhes técnicos do pneu" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setTireModalOpen(false)} className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={tireSaving} className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{tireSaving ? "Salvando..." : editingTire ? "Salvar alterações" : "Cadastrar pneu"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {readingModalOpen && selectedTire ? (
        <div className="fixed inset-0 z-[63] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div><h2 className="text-xl font-bold text-slate-900">Leituras técnicas</h2><p className="text-sm text-slate-500">{selectedTire.serialNumber} - {selectedTire.brand} {selectedTire.model}</p></div>
              <button type="button" onClick={() => setReadingModalOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100">Fechar</button>
            </div>
            <div className="space-y-4 p-6">
              <form onSubmit={saveReading} className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Registrar nova leitura</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><label className="block text-sm font-medium text-slate-700">Data</label><input type="date" value={readingForm.readingDate} onChange={(event) => { setReadingFieldErrors((prev) => ({ ...prev, readingDate: undefined })); setReadingForm((prev) => ({ ...prev, readingDate: event.target.value })); }} className={getFieldClass(Boolean(readingFieldErrors.readingDate))} />{readingFieldErrors.readingDate ? <p className="mt-1 text-xs text-red-600">{readingFieldErrors.readingDate}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">KM</label><input type="number" min={0} value={readingForm.km} onChange={(event) => { setReadingFieldErrors((prev) => ({ ...prev, km: undefined })); setReadingForm((prev) => ({ ...prev, km: event.target.value })); }} className={getFieldClass(Boolean(readingFieldErrors.km))} />{readingFieldErrors.km ? <p className="mt-1 text-xs text-red-600">{readingFieldErrors.km}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Sulco (mm)</label><input value={readingForm.treadDepthMm} onChange={(event) => { setReadingFieldErrors((prev) => ({ ...prev, treadDepthMm: undefined })); setReadingForm((prev) => ({ ...prev, treadDepthMm: event.target.value })); }} className={getFieldClass(Boolean(readingFieldErrors.treadDepthMm))} />{readingFieldErrors.treadDepthMm ? <p className="mt-1 text-xs text-red-600">{readingFieldErrors.treadDepthMm}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Pressão (PSI)</label><input value={readingForm.pressurePsi} onChange={(event) => { setReadingFieldErrors((prev) => ({ ...prev, pressurePsi: undefined })); setReadingForm((prev) => ({ ...prev, pressurePsi: event.target.value })); }} className={getFieldClass(Boolean(readingFieldErrors.pressurePsi))} />{readingFieldErrors.pressurePsi ? <p className="mt-1 text-xs text-red-600">{readingFieldErrors.pressurePsi}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Condição</label><input value={readingForm.condition} onChange={(event) => setReadingForm((prev) => ({ ...prev, condition: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: desgaste irregular" /></div>
                  <div className="md:col-span-3"><label className="block text-sm font-medium text-slate-700">Observações</label><textarea rows={2} value={readingForm.notes} onChange={(event) => setReadingForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" /></div>
                </div>
                <div className="flex justify-end"><button type="submit" disabled={readingSaving} className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{readingSaving ? "Salvando..." : "Registrar leitura"}</button></div>
              </form>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">Histórico de leituras</h3></div>
                <div className="max-h-[340px] overflow-y-auto">
                  {tireReadings.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma leitura registrada.</p> : (
                    <table className="min-w-full">
                      <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Data</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">KM</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Sulco</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Pressão</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Condição</th></tr></thead>
                      <tbody>{tireReadings.map((reading) => <tr key={reading.id} className="border-t border-slate-200"><td className="px-4 py-3 text-sm text-slate-700">{toDateBR(reading.readingDate)}</td><td className="px-4 py-3 text-sm text-slate-700">{reading.km.toLocaleString("pt-BR")}</td><td className="px-4 py-3 text-sm text-slate-700">{reading.treadDepthMm} mm</td><td className="px-4 py-3 text-sm text-slate-700">{reading.pressurePsi} PSI</td><td className="px-4 py-3 text-sm text-slate-700">{reading.condition || "-"}</td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir manutenção"
        description="Deseja excluir esta manutenção?"
        onCancel={() => setRecordToDelete(null)}
        onConfirm={confirmRemoveRecord}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(planToDelete)}
        title="Excluir plano de manutenção"
        description="Deseja excluir este plano de manutenção?"
        onCancel={() => setPlanToDelete(null)}
        onConfirm={confirmRemovePlan}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(tireToDelete)}
        title="Excluir pneu"
        description="Deseja excluir este pneu?"
        onCancel={() => setTireToDelete(null)}
        onConfirm={confirmRemoveTire}
      />

    </div>
  );
}
