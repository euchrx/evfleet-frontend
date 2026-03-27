import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { LayoutGrid, Table2 } from "lucide-react";
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
import { resolveApiMediaUrl } from "../../utils/mediaUrl";

type Tab = "records" | "plans" | "tires";
type SortDirection = "asc" | "desc";

type RecordSortBy = "date" | "vehicle" | "type" | "km" | "cost" | "status";
type PlanSortBy = "name" | "vehicle" | "interval" | "due" | "status";
type TireViewMode = "cards" | "table";
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

function formatAxleLabel(axle: string) {
  const normalized = axle.trim().toLowerCase();
  return normalized.startsWith("eixo") ? axle : `Eixo ${axle}`;
}

function normalizeWheelToMasculine(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "direita") return "Direito";
  if (normalized === "esquerda") return "Esquerdo";
  if (normalized === "interna esquerda") return "Interno esquerdo";
  if (normalized === "interna direita") return "Interno direito";
  if (normalized === "externa esquerda") return "Externo esquerdo";
  if (normalized === "externa direita") return "Externo direito";
  return value;
}

function formatPositionLabel(axle: string, wheel: string) {
  return `${formatAxleLabel(axle)} | Lado ${normalizeWheelToMasculine(wheel)}`;
}

function parsePositionLabel(label: string) {
  const [leftRaw, rightRaw] = label.split("|").map((item) => item.trim());
  if (!leftRaw || !rightRaw) return null;
  const axle = leftRaw.replace(/^eixo\s+/i, "").trim();
  const wheel = normalizeWheelToMasculine(rightRaw.replace(/^lado\s+/i, "").trim());
  if (!axle || !wheel) return null;
  return { axlePosition: axle, wheelPosition: wheel };
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

type TireVisualSlot = {
  id: string;
  label: string;
  axleGroup: string;
  axleValue: string;
  wheelValue: string;
  axleKeys: string[];
  wheelKeys: string[];
  extraKeys?: string[];
};

const TIRE_VISUAL_SLOTS_CAR: TireVisualSlot[] = [
  {
    id: "front-left",
    label: "Dianteiro esquerdo",
    axleGroup: "Eixo 1",
    axleValue: "Dianteiro",
    wheelValue: "Esquerda",
    axleKeys: ["dianteir"],
    wheelKeys: ["esquerd"],
  },
  {
    id: "front-right",
    label: "Dianteiro direito",
    axleGroup: "Eixo 1",
    axleValue: "Dianteiro",
    wheelValue: "Direita",
    axleKeys: ["dianteir"],
    wheelKeys: ["direit"],
  },
  {
    id: "rear-left",
    label: "Traseiro esquerdo",
    axleGroup: "Eixo 2",
    axleValue: "Traseiro",
    wheelValue: "Esquerda",
    axleKeys: ["traseir"],
    wheelKeys: ["esquerd"],
  },
  {
    id: "rear-right",
    label: "Traseiro direito",
    axleGroup: "Eixo 2",
    axleValue: "Traseiro",
    wheelValue: "Direita",
    axleKeys: ["traseir"],
    wheelKeys: ["direit"],
  },
  {
    id: "spare",
    label: "Estepe",
    axleGroup: "Reserva",
    axleValue: "Reserva",
    wheelValue: "Estepe",
    axleKeys: ["reserv", "step", "estepe"],
    wheelKeys: ["reserv", "step", "estepe"],
  },
];

function createHeavyTireSlots(axles = 9): TireVisualSlot[] {
  const slots: TireVisualSlot[] = [
    {
      id: "axle-1-left",
      label: "Eixo 1 - Dianteiro esquerdo",
      axleGroup: "Eixo 1",
      axleValue: "Eixo 1",
      wheelValue: "Esquerda",
      axleKeys: ["eixo 1", "eixo1", "dianteir", "frente"],
      wheelKeys: ["esquerd"],
    },
    {
      id: "axle-1-right",
      label: "Eixo 1 - Dianteiro direito",
      axleGroup: "Eixo 1",
      axleValue: "Eixo 1",
      wheelValue: "Direita",
      axleKeys: ["eixo 1", "eixo1", "dianteir", "frente"],
      wheelKeys: ["direit"],
    },
  ];

  for (let axle = 2; axle <= axles; axle += 1) {
    const axisLabel = `Eixo ${axle}`;
    const axisKeys = [`eixo ${axle}`, `eixo${axle}`];
    slots.push(
      {
        id: `axle-${axle}-inner-left`,
        label: `${axisLabel} - Interno esquerdo`,
        axleGroup: axisLabel,
        axleValue: axisLabel,
        wheelValue: "Interna esquerda",
        axleKeys: axisKeys,
        wheelKeys: ["esquerd"],
        extraKeys: ["intern"],
      },
      {
        id: `axle-${axle}-outer-left`,
        label: `${axisLabel} - Externo esquerdo`,
        axleGroup: axisLabel,
        axleValue: axisLabel,
        wheelValue: "Externa esquerda",
        axleKeys: axisKeys,
        wheelKeys: ["esquerd"],
        extraKeys: ["extern"],
      },
      {
        id: `axle-${axle}-inner-right`,
        label: `${axisLabel} - Interno direito`,
        axleGroup: axisLabel,
        axleValue: axisLabel,
        wheelValue: "Interna direita",
        axleKeys: axisKeys,
        wheelKeys: ["direit"],
        extraKeys: ["intern"],
      },
      {
        id: `axle-${axle}-outer-right`,
        label: `${axisLabel} - Externo direito`,
        axleGroup: axisLabel,
        axleValue: axisLabel,
        wheelValue: "Externa direita",
        axleKeys: axisKeys,
        wheelKeys: ["direit"],
        extraKeys: ["extern"],
      },
    );
  }

  return slots;
}

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
  const [tireViewMode, setTireViewMode] = useState<TireViewMode>("cards");
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
  const [tireAxleInput, setTireAxleInput] = useState("");
  const [tireAxleBatch, setTireAxleBatch] = useState<string[]>([]);
  const [tireWheelInput, setTireWheelInput] = useState("");
  const [tireWheelBatch, setTireWheelBatch] = useState<string[]>([]);
  const [tireAxleOpen, setTireAxleOpen] = useState(false);
  const [tireWheelOpen, setTireWheelOpen] = useState(false);
  const [tireVisualModalOpen, setTireVisualModalOpen] = useState(false);
  const [selectedTireVehicle, setSelectedTireVehicle] = useState<Vehicle | null>(null);

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

    return [...filtered].sort((a, b) => {
      const va = a.vehicleId ? a.vehicle || vehicleMap.get(a.vehicleId) : undefined;
      const vb = b.vehicleId ? b.vehicle || vehicleMap.get(b.vehicleId) : undefined;
      const sa = va ? `${va.brand} ${va.model}` : "";
      const sb = vb ? `${vb.brand} ${vb.model}` : "";
      const byVehicle = sa.localeCompare(sb, "pt-BR", { sensitivity: "base" });
      if (byVehicle !== 0) return byVehicle;
      return a.serialNumber.localeCompare(b.serialNumber, "pt-BR");
    });
  }, [tires, selectedBranchId, vehicleMap, search]);

  const tireCardVehicles = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const vehicle of scopedVehicles) {
      map.set(vehicle.id, vehicle);
    }
    for (const tire of scopedTires) {
      const vehicle = tire.vehicleId ? vehicleMap.get(tire.vehicleId) : undefined;
      if (!vehicle) continue;
      if (selectedBranchId && vehicle.branchId !== selectedBranchId) continue;
      map.set(vehicle.id, vehicle);
    }
    return Array.from(map.values());
  }, [scopedVehicles, scopedTires, vehicleMap, selectedBranchId]);

  const tireCardsByVehicle = useMemo(() => {
    const tiresMap = new Map<string, Tire[]>();
    const searchTerm = search.trim().toLowerCase();
    for (const tire of scopedTires) {
      if (!tire.vehicleId) continue;
      const list = tiresMap.get(tire.vehicleId) || [];
      list.push(tire);
      tiresMap.set(tire.vehicleId, list);
    }

    return tireCardVehicles
      .map((vehicle) => {
        const list = tiresMap.get(vehicle.id) || [];
        return {
          vehicle,
          tires: list,
          total: list.length,
          installed: list.filter((item) => item.status === "INSTALLED").length,
          maintenance: list.filter((item) => item.status === "MAINTENANCE").length,
        };
      })
      .filter((item) => {
        if (!searchTerm) return true;
        const vehicleText = `${item.vehicle.plate} ${formatVehicleLabel(item.vehicle)}`.toLowerCase();
        return item.total > 0 || vehicleText.includes(searchTerm);
      })
      .sort((a, b) => a.vehicle.plate.localeCompare(b.vehicle.plate, "pt-BR", { sensitivity: "base" }));
  }, [scopedTires, tireCardVehicles, search]);

  const tireCardsByCategory = useMemo(() => {
    const light: typeof tireCardsByVehicle = [];
    const heavy: typeof tireCardsByVehicle = [];

    for (const item of tireCardsByVehicle) {
      const isHeavy = item.vehicle.vehicleType === "HEAVY" || item.vehicle.category === "TRUCK";
      if (isHeavy) {
        heavy.push(item);
      } else {
        light.push(item);
      }
    }

    return { light, heavy };
  }, [tireCardsByVehicle]);

  const selectedTireVehicleItems = useMemo(() => {
    if (!selectedTireVehicle) return [];
    return scopedTires.filter((item) => item.vehicleId === selectedTireVehicle.id);
  }, [scopedTires, selectedTireVehicle]);

  const selectedTireVehicleSlots = useMemo(() => {
    if (!selectedTireVehicle) return createHeavyTireSlots(9);
    if (selectedTireVehicle.category === "CAR") return TIRE_VISUAL_SLOTS_CAR;
    if (selectedTireVehicle.vehicleType === "HEAVY" || selectedTireVehicle.category === "TRUCK") {
      return createHeavyTireSlots(9);
    }
    return TIRE_VISUAL_SLOTS_CAR;
  }, [selectedTireVehicle]);

  const selectedTireSlotGroups = useMemo(() => {
    const grouped = new Map<string, TireVisualSlot[]>();
    for (const slot of selectedTireVehicleSlots) {
      const list = grouped.get(slot.axleGroup) || [];
      list.push(slot);
      grouped.set(slot.axleGroup, list);
    }
    return Array.from(grouped.entries()).map(([axleGroup, slots]) => ({
      axleGroup,
      slots,
      filled: slots.filter((slot) =>
        selectedTireVehicleItems.some((item) => tireMatchesSlot(item, slot)),
      ).length,
    }));
  }, [selectedTireVehicleSlots, selectedTireVehicleItems]);

  const tireFormVehicle = useMemo(
    () => (tireForm.vehicleId ? scopedVehicles.find((vehicle) => vehicle.id === tireForm.vehicleId) || null : null),
    [scopedVehicles, tireForm.vehicleId],
  );

  const tireFormVehicleSlots = useMemo(() => {
    if (!tireFormVehicle) return [];
    if (tireFormVehicle.category === "CAR") return TIRE_VISUAL_SLOTS_CAR;
    if (tireFormVehicle.vehicleType === "HEAVY" || tireFormVehicle.category === "TRUCK") {
      return createHeavyTireSlots(9);
    }
    return TIRE_VISUAL_SLOTS_CAR;
  }, [tireFormVehicle]);

  const tireFormMissingSlots = useMemo(() => {
    if (!tireFormVehicle) return [];
    const vehicleTires = scopedTires.filter((item) => item.vehicleId === tireFormVehicle.id);
    return tireFormVehicleSlots.filter((slot) => !vehicleTires.some((item) => tireMatchesSlot(item, slot)));
  }, [tireFormVehicle, tireFormVehicleSlots, scopedTires]);

  const tireFormAllowedAxles = useMemo(
    () =>
      Array.from(new Set(tireFormVehicleSlots.map((slot) => slot.axleValue))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [tireFormVehicleSlots],
  );

  const tireFormAllowedPositionLabels = useMemo(() => {
    const selectedAxles = new Set(tireAxleBatch.map((value) => normalizeSearchText(value)));
    const hasSelectedAxles = selectedAxles.size > 0;
    return tireFormVehicleSlots
      .filter((slot) => !hasSelectedAxles || selectedAxles.has(normalizeSearchText(slot.axleValue)))
      .map((slot) => formatPositionLabel(slot.axleValue, slot.wheelValue))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tireFormVehicleSlots, tireAxleBatch]);

  const filteredTireAxleSuggestions = useMemo(() => {
    const query = normalizeSearchText(tireAxleInput);
    return tireFormAllowedAxles
      .filter((item) => !tireAxleBatch.some((selected) => selected.toLowerCase() === item.toLowerCase()))
      .filter((item) => (query ? normalizeSearchText(item).includes(query) : true))
      .slice(0, 12);
  }, [tireFormAllowedAxles, tireAxleBatch, tireAxleInput]);

  const filteredTireWheelSuggestions = useMemo(() => {
    const query = normalizeSearchText(tireWheelInput);
    return tireFormAllowedPositionLabels
      .filter((item) => !tireWheelBatch.some((selected) => selected.toLowerCase() === item.toLowerCase()))
      .filter((item) => (query ? normalizeSearchText(item).includes(query) : true))
      .slice(0, 12);
  }, [tireFormAllowedPositionLabels, tireWheelBatch, tireWheelInput]);

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
  }, [search, selectedBranchId, tireViewMode]);
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

  function normalizeTirePositionLabel(value: string) {
    return value.replace(/[.,;]+$/g, "").trim();
  }

  function generateAutoTireSerial(index: number) {
    const base = Date.now().toString(36).toUpperCase();
    const suffix = String(index + 1).padStart(2, "0");
    return `AUTO-${base}-${suffix}`;
  }

  function normalizeSearchText(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function tireMatchesSlot(tire: Tire, slot: TireVisualSlot) {
    const axle = normalizeSearchText(tire.axlePosition || "");
    const wheel = normalizeSearchText(tire.wheelPosition || "");
    const matchesAxle = slot.axleKeys.some((key) => axle.includes(key));
    const matchesWheel = slot.wheelKeys.some((key) => wheel.includes(key));
    if (!matchesAxle || !matchesWheel) return false;
    if (slot.extraKeys && !slot.extraKeys.some((key) => wheel.includes(key) || axle.includes(key))) return false;
    return true;
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

  function addTireAxles(values: string[]) {
    const normalized = values.map(normalizeTirePositionLabel).filter(Boolean);
    if (!normalized.length) return;
    const allowedMap = new Map(
      tireFormAllowedAxles.map((value) => [normalizeSearchText(value), value]),
    );
    setTireAxleBatch((prev) => {
      const next = [...prev];
      for (const value of normalized) {
        const canonical = allowedMap.get(normalizeSearchText(value));
        if (!canonical) continue;
        if (!next.some((item) => item.toLowerCase() === canonical.toLowerCase())) {
          next.push(canonical);
        }
      }
      return next;
    });
  }

  function removeTireAxle(valueToRemove: string) {
    setTireAxleBatch((prev) => {
      const next = prev.filter((value) => value !== valueToRemove);
      setTireWheelBatch((currentPairs) =>
        currentPairs.filter((label) => {
          const parsed = parsePositionLabel(label);
          if (!parsed) return false;
          return next.some((axle) => normalizeSearchText(axle) === normalizeSearchText(parsed.axlePosition));
        }),
      );
      return next;
    });
  }

  function addTireWheels(values: string[]) {
    const normalized = values.map(normalizeTirePositionLabel).filter(Boolean);
    if (!normalized.length) return;
    const allowedMap = new Map(
      tireFormAllowedPositionLabels.map((value) => [normalizeSearchText(value), value]),
    );
    setTireWheelBatch((prev) => {
      const next = [...prev];
      for (const value of normalized) {
        const canonical = allowedMap.get(normalizeSearchText(value));
        if (!canonical) continue;
        if (!next.some((item) => item.toLowerCase() === canonical.toLowerCase())) {
          next.push(canonical);
        }
      }
      return next;
    });
  }

  function removeTireWheel(valueToRemove: string) {
    setTireWheelBatch((prev) => prev.filter((value) => value !== valueToRemove));
  }

  function addSuggestedSlot(slot: TireVisualSlot) {
    addTireAxles([slot.axleValue]);
    addTireWheels([formatPositionLabel(slot.axleValue, slot.wheelValue)]);
  }

  function buildPositionPairs(axles: string[], wheels: string[]) {
    if (!axles.length && !wheels.length) {
      return [{ axlePosition: undefined, wheelPosition: undefined }];
    }
    if (!axles.length) {
      return wheels.map((wheelPosition) => ({ axlePosition: undefined, wheelPosition }));
    }
    if (!wheels.length) {
      return axles.map((axlePosition) => ({ axlePosition, wheelPosition: undefined }));
    }
    if (axles.length === wheels.length) {
      return axles.map((axlePosition, index) => ({
        axlePosition,
        wheelPosition: wheels[index],
      }));
    }
    const pairs: Array<{ axlePosition: string; wheelPosition: string }> = [];
    for (const axlePosition of axles) {
      for (const wheelPosition of wheels) {
        pairs.push({ axlePosition, wheelPosition });
      }
    }
    return pairs;
  }

  function buildPositionPairsFromSlots(axles: string[], wheels: string[], slots: TireVisualSlot[]) {
    const normalizedAxles = new Set(axles.map((value) => normalizeSearchText(value)));
    const normalizedWheels = new Set(wheels.map((value) => normalizeSearchText(value)));
    const hasAxles = normalizedAxles.size > 0;
    const hasWheels = normalizedWheels.size > 0;

    const slotPairs = slots
      .filter((slot) => {
        const slotAxle = normalizeSearchText(slot.axleValue);
        const slotWheel = normalizeSearchText(slot.wheelValue);
        const axleOk = !hasAxles || normalizedAxles.has(slotAxle);
        const wheelOk = !hasWheels || normalizedWheels.has(slotWheel);
        return axleOk && wheelOk;
      })
      .map((slot) => ({
        axlePosition: slot.axleValue,
        wheelPosition: slot.wheelValue,
      }));

    const deduped = Array.from(
      new Map(slotPairs.map((pair) => [`${pair.axlePosition}|${pair.wheelPosition}`, pair])).values(),
    );

    if (deduped.length > 0) return deduped;
    return buildPositionPairs(axles, wheels);
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
    setTireAxleBatch([]);
    setTireAxleInput("");
    setTireWheelBatch([]);
    setTireWheelInput("");
    setTireAxleOpen(false);
    setTireWheelOpen(false);
    const defaultVehicleId = "";
    const latestKm = undefined;
    setTireForm({
      ...initialTireForm,
      vehicleId: defaultVehicleId,
      currentKm: typeof latestKm === "number" ? String(latestKm) : "",
    });
    setTireModalOpen(true);
  }

  function openCreateTireForSlot(vehicle: Vehicle, slot: TireVisualSlot) {
    setEditingTire(null);
    setTireFieldErrors({});
    setTireAxleBatch([slot.axleValue]);
    setTireAxleInput("");
    setTireWheelBatch([formatPositionLabel(slot.axleValue, slot.wheelValue)]);
    setTireWheelInput("");
    setTireAxleOpen(false);
    setTireWheelOpen(false);
    const latestKm = latestKmByVehicle.get(vehicle.id);
    setTireForm({
      ...initialTireForm,
      vehicleId: vehicle.id,
      axlePosition: slot.axleValue,
      wheelPosition: slot.wheelValue,
      currentKm: typeof latestKm === "number" ? String(latestKm) : "",
    });
    setTireModalOpen(true);
  }

  function openTireVisualModal(vehicle: Vehicle) {
    setSelectedTireVehicle(vehicle);
    setTireVisualModalOpen(true);
  }

  function openEditTire(tire: Tire) {
    setEditingTire(tire);
    setTireFieldErrors({});
    setTireAxleBatch(tire.axlePosition ? [tire.axlePosition] : []);
    setTireAxleInput("");
    setTireWheelBatch(
      tire.axlePosition && tire.wheelPosition
        ? [formatPositionLabel(tire.axlePosition, tire.wheelPosition)]
        : [],
    );
    setTireWheelInput("");
    setTireAxleOpen(false);
    setTireWheelOpen(false);
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
    const mergedAxles = [...tireAxleBatch];
    const mergedPairs = tireWheelBatch
      .map((label) => parsePositionLabel(label))
      .filter((item): item is { axlePosition: string; wheelPosition: string } => Boolean(item));
    const nextErrors: Partial<Record<TireFieldKey, string>> = {};
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
      axlePosition: mergedPairs[0]?.axlePosition || mergedAxles[0] || tireForm.axlePosition.trim() || undefined,
      wheelPosition: mergedPairs[0]?.wheelPosition || tireForm.wheelPosition.trim() || undefined,
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
          serialNumber: tireForm.serialNumber.trim(),
        });
      } else {
        const pairs =
          mergedPairs.length > 0
            ? mergedPairs
            : buildPositionPairsFromSlots(mergedAxles, [], tireFormVehicleSlots);
        const failures: number[] = [];
        for (let index = 0; index < pairs.length; index += 1) {
          const pair = pairs[index];
          try {
            await createTire({
              ...payloadBase,
              serialNumber: generateAutoTireSerial(index),
              axlePosition: pair.axlePosition || payloadBase.axlePosition,
              wheelPosition: pair.wheelPosition || payloadBase.wheelPosition,
            });
          } catch {
            failures.push(index + 1);
          }
        }

        if (failures.length) {
          setTireFieldErrors((prev) => ({
            ...prev,
            brand:
              failures.length === pairs.length
                ? "Não foi possível cadastrar os pneus nas posições selecionadas."
                : `Algumas posições não foram cadastradas: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? "..." : ""}`,
          }));
          return;
        }
      }
      setTireModalOpen(false);
      setTireAxleBatch([]);
      setTireAxleInput("");
      setTireWheelBatch([]);
      setTireWheelInput("");
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
          {tab === "tires" ? (
            <div className="inline-flex w-fit items-center rounded-xl border border-slate-300 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTireViewMode("cards")}
                title="Visualizar em cards"
                className={`cursor-pointer rounded-lg p-2 transition ${tireViewMode === "cards" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setTireViewMode("table")}
                title="Visualizar em tabela"
                className={`cursor-pointer rounded-lg p-2 transition ${tireViewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
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

      {!loading && tab === "tires" && tireViewMode === "cards" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {tireCardsByVehicle.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum veículo encontrado.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Categoria Leve</p>
                  {tireCardsByCategory.light.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Nenhum veículo leve encontrado.</p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      {tireCardsByCategory.light.map((item) => (
                        <button
                          key={`light-${item.vehicle.id}`}
                          type="button"
                          onClick={() => openTireVisualModal(item.vehicle)}
                          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
                        >
                          <div className="flex items-center gap-3">
                            {(item.vehicle.profilePhotoUrl || item.vehicle.photoUrls?.[0]) ? (
                              <img
                                src={resolveApiMediaUrl(item.vehicle.profilePhotoUrl || item.vehicle.photoUrls?.[0])}
                                alt={formatVehicleLabel(item.vehicle)}
                                className="h-11 w-11 rounded-xl border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 text-xs font-semibold text-slate-500">
                                {item.vehicle.plate?.slice(0, 2) || "SV"}
                              </div>
                            )}
                            <p className="text-sm font-semibold text-slate-900">{formatVehicleLabel(item.vehicle)}</p>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {item.vehicle.status === "ACTIVE"
                              ? "Ativo"
                              : item.vehicle.status === "MAINTENANCE"
                              ? "Em manutenção"
                              : "Vendido"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="status-pill status-active">Pneus: {item.total}</span>
                            <span className="status-pill status-pending">Instalados: {item.installed}</span>
                            <span className="status-pill status-anomaly">Em manutenção: {item.maintenance}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Categoria Pesado</p>
                  {tireCardsByCategory.heavy.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Nenhum veículo pesado encontrado.</p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      {tireCardsByCategory.heavy.map((item) => (
                        <button
                          key={`heavy-${item.vehicle.id}`}
                          type="button"
                          onClick={() => openTireVisualModal(item.vehicle)}
                          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
                        >
                          <div className="flex items-center gap-3">
                            {(item.vehicle.profilePhotoUrl || item.vehicle.photoUrls?.[0]) ? (
                              <img
                                src={resolveApiMediaUrl(item.vehicle.profilePhotoUrl || item.vehicle.photoUrls?.[0])}
                                alt={formatVehicleLabel(item.vehicle)}
                                className="h-11 w-11 rounded-xl border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 text-xs font-semibold text-slate-500">
                                {item.vehicle.plate?.slice(0, 2) || "SV"}
                              </div>
                            )}
                            <p className="text-sm font-semibold text-slate-900">{formatVehicleLabel(item.vehicle)}</p>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {item.vehicle.status === "ACTIVE"
                              ? "Ativo"
                              : item.vehicle.status === "MAINTENANCE"
                              ? "Em manutenção"
                              : "Vendido"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="status-pill status-active">Pneus: {item.total}</span>
                            <span className="status-pill status-pending">Instalados: {item.installed}</span>
                            <span className="status-pill status-anomaly">Em manutenção: {item.maintenance}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="hidden grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tireCardsByVehicle.map((item) => (
                <button
                  key={item.vehicle.id}
                  type="button"
                  onClick={() => openTireVisualModal(item.vehicle)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
                >
                  <p className="text-sm font-semibold text-slate-900">{formatVehicleLabel(item.vehicle)}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.vehicle.status === "ACTIVE"
                      ? "Ativo"
                      : item.vehicle.status === "MAINTENANCE"
                      ? "Em manutenção"
                      : "Vendido"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="status-pill status-active">Pneus: {item.total}</span>
                    <span className="status-pill status-pending">Instalados: {item.installed}</span>
                    <span className="status-pill status-anomaly">Em manutenção: {item.maintenance}</span>
                  </div>
                </button>
              ))}
            </div>
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "tires" && tireViewMode === "table" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">DOT/TIN</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Pneu</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Veículo / posição</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Leitura</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTires.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Nenhum pneu encontrado.</td>
                  </tr>
                ) : (
                  paginatedTires.map((item) => {
                    const vehicle = item.vehicleId ? item.vehicle || vehicleMap.get(item.vehicleId) : undefined;
                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 text-sm text-slate-700">{item.serialNumber}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">
                          <p className="font-medium">{item.brand} {item.model}</p>
                          <p className="text-xs text-slate-500">{item.size}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <p>{vehicle ? formatVehicleLabel(vehicle) : "Sem vínculo"}</p>
                          <p className="text-xs text-slate-500">{item.axlePosition || "-"} / {item.wheelPosition || "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <p>KM: {(item.currentKm || 0).toLocaleString("pt-BR")}</p>
                          <p className="text-xs text-slate-500">Pressão recomendada: {item.targetPressurePsi || 0} PSI</p>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`status-pill ${item.status === "INSTALLED" ? "status-active" : item.status === "MAINTENANCE" ? "status-pending" : "status-inactive"}`}>
                            {tireStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openReadingModal(item)} className="btn-ui btn-ui-neutral">Leituras</button>
                            <button type="button" onClick={() => openEditTire(item)} className="btn-ui btn-ui-neutral">Editar</button>
                            <button type="button" onClick={() => removeTire(item)} className="btn-ui btn-ui-danger">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
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

      {tireVisualModalOpen && selectedTireVehicle ? (
        <div className="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Posições dos pneus</h2>
                <p className="text-sm text-slate-500">{formatVehicleLabel(selectedTireVehicle)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTireVisualModalOpen(false);
                  setSelectedTireVehicle(null);
                }}
                className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="space-y-4">
                {selectedTireSlotGroups.map((group) => (
                  <section key={group.axleGroup} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">{group.axleGroup}</h3>
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {group.filled}/{group.slots.length} posições
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {group.slots.map((slot) => {
                        const tire = selectedTireVehicleItems.find((item) => tireMatchesSlot(item, slot));
                        return (
                          <div key={`${group.axleGroup}-${slot.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                            {tire ? (
                              <div className="mt-2 space-y-2">
                                <p className="text-xs text-slate-600">{tire.serialNumber}</p>
                                <p className="text-xs text-slate-500">{tire.brand} {tire.model} • {tire.size}</p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button type="button" onClick={() => openReadingModal(tire)} className="btn-ui btn-ui-neutral">Leituras</button>
                                  <button type="button" onClick={() => openEditTire(tire)} className="btn-ui btn-ui-neutral">Editar</button>
                                  <button type="button" onClick={() => removeTire(tire)} className="btn-ui btn-ui-danger">Excluir</button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2">
                                <p className="text-xs text-slate-500">Sem pneu vinculado nesta posição.</p>
                                <button type="button" onClick={() => openCreateTireForSlot(selectedTireVehicle, slot)} className="btn-ui btn-ui-neutral mt-3">+ Adicionar pneu</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="hidden grid gap-3 md:grid-cols-2">
                {selectedTireVehicleSlots.map((slot) => {
                  const tire = selectedTireVehicleItems.find((item) => tireMatchesSlot(item, slot));

                  return (
                    <div key={slot.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                      {tire ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-slate-600">{tire.serialNumber}</p>
                          <p className="text-xs text-slate-500">
                            {tire.brand} {tire.model} • {tire.size}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button type="button" onClick={() => openReadingModal(tire)} className="btn-ui btn-ui-neutral">
                              Leituras
                            </button>
                            <button type="button" onClick={() => openEditTire(tire)} className="btn-ui btn-ui-neutral">
                              Editar
                            </button>
                            <button type="button" onClick={() => removeTire(tire)} className="btn-ui btn-ui-danger">
                              Excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <p className="text-xs text-slate-500">Sem pneu vinculado nesta posição.</p>
                          <button
                            type="button"
                            onClick={() => openCreateTireForSlot(selectedTireVehicle, slot)}
                            className="btn-ui btn-ui-neutral mt-3"
                          >
                            + Adicionar pneu
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

                {selectedTireVehicleItems.filter(
                (item) => !selectedTireVehicleSlots.some((slot) => tireMatchesSlot(item, slot)),
              ).length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Pneus sem posição mapeada</p>
                  <div className="mt-3 space-y-2">
                    {selectedTireVehicleItems
                      .filter((item) => !selectedTireVehicleSlots.some((slot) => tireMatchesSlot(item, slot)))
                      .map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-sm text-slate-700">
                            {item.serialNumber} • {item.brand} {item.model} ({item.size})
                          </p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditTire(item)} className="btn-ui btn-ui-neutral">
                              Editar
                            </button>
                            <button type="button" onClick={() => removeTire(item)} className="btn-ui btn-ui-danger">
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
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
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700">Tipo</label>
                  <select value={recordForm.type} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, type: undefined })); setRecordForm((prev) => ({ ...prev, type: event.target.value as RecordFormState["type"] })); }} className={getFieldClass(Boolean(recordFieldErrors.type))}>
                    <option value="">Selecione o tipo</option>
                    <option value="PREVENTIVE">Preventiva</option>
                    <option value="PERIODIC">Periódica</option>
                    <option value="CORRECTIVE">Corretiva</option>
                  </select>
                  {recordFieldErrors.type ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.type}</p> : null}
                </div>
                <div className="relative">
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
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700">Data</label>
                  <input type="date" value={recordForm.maintenanceDate} onChange={(event) => { setRecordFieldErrors((prev) => ({ ...prev, maintenanceDate: undefined })); setRecordForm((prev) => ({ ...prev, maintenanceDate: event.target.value })); }} className={getFieldClass(Boolean(recordFieldErrors.maintenanceDate))} />
                  {recordFieldErrors.maintenanceDate ? <p className="mt-1 text-xs text-red-600">{recordFieldErrors.maintenanceDate}</p> : null}
                </div>
                <div className="relative">
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
                <div><label className="block text-sm font-medium text-slate-700">Marca</label><input value={tireForm.brand} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, brand: undefined })); setTireForm((prev) => ({ ...prev, brand: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.brand))} placeholder="Ex: Michelin" />{tireFieldErrors.brand ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.brand}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Modelo</label><input value={tireForm.model} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, model: undefined })); setTireForm((prev) => ({ ...prev, model: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.model))} placeholder="Ex: X Multi D" />{tireFieldErrors.model ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.model}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Medida</label><input value={tireForm.size} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, size: undefined })); setTireForm((prev) => ({ ...prev, size: event.target.value })); }} className={getFieldClass(Boolean(tireFieldErrors.size))} placeholder="Ex: 295/80R22.5" />{tireFieldErrors.size ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.size}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={tireForm.status} onChange={(event) => { setTireFieldErrors((prev) => ({ ...prev, status: undefined })); setTireForm((prev) => ({ ...prev, status: event.target.value as TireStatus | "" })); }} className={getFieldClass(Boolean(tireFieldErrors.status))}><option value="">Selecione o status</option><option value="IN_STOCK">Estoque</option><option value="INSTALLED">Instalado</option><option value="MAINTENANCE">Manutenção</option><option value="RETREADED">Recapado</option><option value="SCRAPPED">Descartado</option></select>{tireFieldErrors.status ? <p className="mt-1 text-xs text-red-600">{tireFieldErrors.status}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Veículo</label><select value={tireForm.vehicleId} onChange={(event) => { const vehicleId = event.target.value; setTireAxleBatch([]); setTireAxleInput(""); setTireWheelBatch([]); setTireWheelInput(""); setTireAxleOpen(false); setTireWheelOpen(false); setTireForm((prev) => { if (editingTire) return { ...prev, vehicleId }; const latestKm = latestKmByVehicle.get(vehicleId); return { ...prev, vehicleId, currentKm: typeof latestKm === "number" ? String(latestKm) : "" }; }); }} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"><option value="">Selecione um veículo</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}</select></div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700">Posição do eixo</label>
                  <div className="mt-1 rounded-xl border border-slate-300 px-3 py-3">
                    {tireAxleBatch.length ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {tireAxleBatch.map((axle) => (
                          <span key={axle} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {axle}
                            <button type="button" onClick={() => removeTireAxle(axle)} className="cursor-pointer text-slate-500 hover:text-slate-700">x</button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <input
                      value={tireAxleInput}
                      disabled={!tireForm.vehicleId}
                      onChange={(event) => {
                        setTireAxleInput(event.target.value);
                        setTireAxleOpen(true);
                      }}
                      onFocus={() => setTireAxleOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "," || event.key === ".") {
                          event.preventDefault();
                          const chunks = tireAxleInput.split(/[,.]/).map((item) => item.trim());
                          addTireAxles(chunks);
                          setTireAxleInput("");
                        }
                      }}
                      onBlur={() => {
                        if (tireAxleInput.trim()) {
                          addTireAxles([tireAxleInput]);
                          setTireAxleInput("");
                        }
                        setTimeout(() => setTireAxleOpen(false), 120);
                      }}
                      className="w-full border-none bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      placeholder={tireForm.vehicleId ? "Digite uma posição do eixo e pressione Enter" : "Selecione um veículo"}
                    />
                  </div>
                  {tireAxleOpen && filteredTireAxleSuggestions.length > 0 ? (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredTireAxleSuggestions.map((value) => (
                        <button
                          key={`axle-suggestion-${value}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            addTireAxles([value]);
                            setTireAxleInput("");
                            setTireAxleOpen(false);
                          }}
                          className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700">Posição da roda (eixo + lado)</label>
                  <div className="mt-1 rounded-xl border border-slate-300 px-3 py-3">
                    {tireWheelBatch.length ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {tireWheelBatch.map((wheel) => (
                          <span key={wheel} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {wheel}
                            <button type="button" onClick={() => removeTireWheel(wheel)} className="cursor-pointer text-slate-500 hover:text-slate-700">x</button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <input
                      value={tireWheelInput}
                      disabled={!tireForm.vehicleId || tireAxleBatch.length === 0}
                      onChange={(event) => {
                        setTireWheelInput(event.target.value);
                        setTireWheelOpen(true);
                      }}
                      onFocus={() => setTireWheelOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "," || event.key === ".") {
                          event.preventDefault();
                          const chunks = tireWheelInput.split(/[,.]/).map((item) => item.trim());
                          addTireWheels(chunks);
                          setTireWheelInput("");
                        }
                      }}
                      onBlur={() => {
                        if (tireWheelInput.trim()) {
                          addTireWheels([tireWheelInput]);
                          setTireWheelInput("");
                        }
                        setTimeout(() => setTireWheelOpen(false), 120);
                      }}
                      className="w-full border-none bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      placeholder={!tireForm.vehicleId ? "Selecione um veículo" : tireAxleBatch.length === 0 ? "Selecione o eixo primeiro" : "Selecione a combinação eixo + lado"}
                    />
                  </div>
                  {tireWheelOpen && filteredTireWheelSuggestions.length > 0 ? (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredTireWheelSuggestions.map((value) => (
                        <button
                          key={`wheel-suggestion-${value}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            addTireWheels([value]);
                            setTireWheelInput("");
                            setTireWheelOpen(false);
                          }}
                          className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {false && !editingTire && tireForm.vehicleId ? (
                  <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Sugestões sem pneu vinculado
                    </p>
                    {tireFormMissingSlots.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tireFormMissingSlots.map((slot) => (
                          <button
                            key={`missing-slot-${slot.id}`}
                            type="button"
                            onClick={() => addSuggestedSlot(slot)}
                            className="cursor-pointer rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-700">
                        Todas as posições desse veículo já possuem pneu cadastrado.
                      </p>
                    )}
                  </div>
                ) : null}
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
