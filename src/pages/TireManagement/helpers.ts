import type { CreateTireInput, UpdateTireInput } from "../../services/tires";
import type { Tire, TireAlert, TireStatus } from "../../types/tire";

export type TireFilter = "ALL" | "OPERATIONAL" | "STOCK" | "RESERVE" | "SPARE" | "ALERT";

export type SortField =
  | "serialNumber"
  | "brand"
  | "model"
  | "size"
  | "status"
  | "condition"
  | "vehicle"
  | "currentKm"
  | "axlePosition";

export type SortDirection = "asc" | "desc";

export type TireForm = {
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  rim: string;
  purchaseDate: string;
  purchaseCost: string;
  status: TireStatus;
  currentKm: string;
  currentTreadDepthMm: string;
  currentPressurePsi: string;
  targetPressurePsi: string;
  minTreadDepthMm: string;
  installedAt: string;
  notes: string;
};

export type CreateTireForm = TireForm;
export type EditTireForm = TireForm;

export const emptyTireForm: TireForm = {
  serialNumber: "",
  brand: "",
  model: "",
  size: "",
  rim: "",
  purchaseDate: "",
  purchaseCost: "",
  status: "IN_STOCK",
  currentKm: "",
  currentTreadDepthMm: "",
  currentPressurePsi: "",
  targetPressurePsi: "",
  minTreadDepthMm: "3",
  installedAt: "",
  notes: "",
};

export const INITIAL_CREATE_FORM = emptyTireForm;

export function createEditTireForm(tire: Tire): EditTireForm {
  return {
    serialNumber: tire.serialNumber || "",
    brand: tire.brand || "",
    model: tire.model || "",
    size: tire.size || "",
    rim: tire.rim != null ? String(tire.rim) : "",
    purchaseDate: (tire.purchaseDate || "").slice(0, 10),
    purchaseCost: tire.purchaseCost != null ? String(tire.purchaseCost) : "",
    status: tire.status,
    currentKm: tire.currentKm != null ? String(tire.currentKm) : "",
    currentTreadDepthMm:
      tire.currentTreadDepthMm != null ? String(tire.currentTreadDepthMm) : "",
    currentPressurePsi:
      tire.currentPressurePsi != null ? String(tire.currentPressurePsi) : "",
    targetPressurePsi:
      tire.targetPressurePsi != null ? String(tire.targetPressurePsi) : "",
    minTreadDepthMm:
      tire.minTreadDepthMm != null ? String(tire.minTreadDepthMm) : "3",
    installedAt: (tire.installedAt || "").slice(0, 10),
    notes: tire.notes || "",
  };
}

export function normalizeTireSize(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}/${digits.slice(3)}`;
}

export function normalizeDecimalInput(value: string) {
  const normalized = String(value || "").replace(/[^\d,\.]/g, "");
  if (!normalized) return "";

  const separatorIndex = normalized.search(/[,.]/);
  if (separatorIndex === -1) {
    return normalized;
  }

  const integerPart = normalized.slice(0, separatorIndex).replace(/[^\d]/g, "");
  const decimalPart = normalized.slice(separatorIndex + 1).replace(/[^\d]/g, "").slice(0, 2);

  return decimalPart ? `${integerPart},${decimalPart}` : `${integerPart},`;
}

export function parseNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalNumber(value: string) {
  return parseNumber(value);
}

export function parseSerialNumbers(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildCreateTirePayload(form: TireForm): CreateTireInput {
  return {
    serialNumber: form.serialNumber.trim(),
    brand: form.brand.trim(),
    model: form.model.trim(),
    size: form.size.trim(),
    rim: parseNumber(form.rim),
    purchaseDate: form.purchaseDate || undefined,
    purchaseCost: parseNumber(form.purchaseCost),
    status: form.status,
    currentKm: parseNumber(form.currentKm),
    currentTreadDepthMm: parseNumber(form.currentTreadDepthMm),
    currentPressurePsi: parseNumber(form.currentPressurePsi),
    targetPressurePsi: parseNumber(form.targetPressurePsi),
    minTreadDepthMm: parseNumber(form.minTreadDepthMm),
    installedAt: form.installedAt || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function buildUpdateTirePayload(form: TireForm): UpdateTireInput {
  return {
    serialNumber: form.serialNumber.trim(),
    brand: form.brand.trim(),
    model: form.model.trim(),
    size: form.size.trim(),
    rim: parseNumber(form.rim),
    purchaseDate: form.purchaseDate || undefined,
    purchaseCost: parseNumber(form.purchaseCost),
    status: form.status,
    currentKm: parseNumber(form.currentKm),
    currentTreadDepthMm: parseNumber(form.currentTreadDepthMm),
    currentPressurePsi: parseNumber(form.currentPressurePsi),
    targetPressurePsi: parseNumber(form.targetPressurePsi),
    minTreadDepthMm: parseNumber(form.minTreadDepthMm),
    installedAt: form.installedAt || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function normalizeSearchText(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formatDateLabel(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const normalized = String(value).trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return "-";
  }
  return date.toLocaleDateString("pt-BR");
}

export function formatCurrencyLabel(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatCurrencyCompact(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export function formatNumberLabel(value?: number | null, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR")}${suffix}`;
}

export function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function compareValues(a: unknown, b: unknown) {
  const aValue = a ?? "";
  const bValue = b ?? "";

  if (typeof aValue === "number" && typeof bValue === "number") {
    return aValue - bValue;
  }

  return String(aValue).localeCompare(String(bValue), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function tireStatusLabel(value?: TireStatus | null) {
  if (value === "INSTALLED") return "Instalado";
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "RETREADED") return "Recapado";
  if (value === "SCRAPPED") return "Descartado";
  return "Em estoque";
}

export function tireStatusClass(value?: TireStatus | null) {
  if (value === "INSTALLED") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === "MAINTENANCE") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  if (value === "RETREADED") {
    return "border border-blue-200 bg-blue-50 text-blue-700";
  }
  if (value === "SCRAPPED") {
    return "border border-red-200 bg-red-50 text-red-700";
  }
  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export function tireVehicleLabel(tire: Tire) {
  const vehicle = tire.vehicle;
  if (!vehicle) return "Sem veículo vinculado";

  const plate = String(vehicle.plate || "").trim();
  const brand = String(vehicle.brand || "").trim();
  const model = String(vehicle.model || "").trim();

  const mainLabel = [brand, model].filter(Boolean).join(" ").trim();

  if (plate && mainLabel) return `${plate} • ${mainLabel}`;
  if (plate) return plate;
  if (mainLabel) return mainLabel;

  return "Veículo vinculado";
}

export function formatAxleLabel(axle: string) {
  const normalized = axle.trim().toLowerCase();
  return normalized.startsWith("eixo") ? axle : `Eixo ${axle}`;
}

export function normalizeWheelToMasculine(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "direita") return "Direito";
  if (normalized === "esquerda") return "Esquerdo";
  if (normalized === "interna esquerda") return "Interno esquerdo";
  if (normalized === "interna direita") return "Interno direito";
  if (normalized === "externa esquerda") return "Externo esquerdo";
  if (normalized === "externa direita") return "Externo direito";
  return value;
}

export function formatPositionLabel(
  axlePosition?: string | null,
  wheelPosition?: string | null,
  hasVehicle = false,
) {
  if (!hasVehicle) return "-";

  const safeAxle = String(axlePosition || "").trim();
  const safeWheel = String(wheelPosition || "").trim();

  if (safeWheel.toLowerCase() === "estepe") {
    return "Estepe";
  }

  if (!safeAxle && !safeWheel) {
    return "-";
  }

  return `${formatAxleLabel(safeAxle)} | Lado ${normalizeWheelToMasculine(
    safeWheel,
  )}`;
}

export function brandModelLabel(tire: Tire) {
  const brand = String(tire.brand || "").trim();
  const model = String(tire.model || "").trim();
  return [brand, model].filter(Boolean).join(" / ").trim() || "Sem marca / modelo";
}

export function getTireFlags(tire: Tire) {
  const axle = normalizeSearchText(tire.axlePosition || "");
  const wheel = normalizeSearchText(tire.wheelPosition || "");

  const stockWords = ["estoque", "stock", "deposito", "depósito"];
  const reserveWords = ["reserva", "reserve"];
  const spareWords = ["estepe", "step", "spare"];

  return {
    isStock:
      stockWords.some((word) => axle.includes(word) || wheel.includes(word)) ||
      tire.status === "IN_STOCK",
    isReserve: reserveWords.some((word) => axle.includes(word) || wheel.includes(word)),
    isSpare: spareWords.some((word) => axle.includes(word) || wheel.includes(word)),
  };
}

export function getCurrentTreadDepth(tire: Tire) {
  return tire.currentTreadDepthMm ?? tire.readings?.[0]?.treadDepthMm ?? null;
}

export function getCurrentPressure(tire: Tire) {
  return tire.currentPressurePsi ?? tire.readings?.[0]?.pressurePsi ?? null;
}

export function getUsefulLifePercent(tire: Tire) {
  const current = getCurrentTreadDepth(tire);
  const minimum = tire.minTreadDepthMm ?? 3;
  const original = tire.originalTreadDepthMm ?? 14;
  if (current == null || original <= minimum) return null;
  const remaining = ((current - minimum) / (original - minimum)) * 100;
  return Math.max(0, Math.min(100, remaining));
}

export function getCurrentLifeKm(tire: Tire) {
  return tire.currentLifeKm ?? tire.currentKm ?? null;
}

export function getTotalCasingKm(tire: Tire) {
  return tire.totalCasingKm ?? tire.currentKm ?? null;
}

export function getTotalInvestment(tire: Tire) {
  const purchase = tire.purchaseCost ?? 0;
  const reform = tire.reformCost ?? 0;
  const total = purchase + reform;
  return total > 0 ? total : null;
}

export function getCostPerKm(tire: Tire) {
  const investment = getTotalInvestment(tire);
  const km = getTotalCasingKm(tire);
  if (!investment || !km) return null;
  return investment / km;
}

export function getLifeCount(tire: Tire) {
  return tire.numberOfLives ?? 1;
}

export function getWarrantyStatusLabel(tire: Tire) {
  if (!tire.warrantyStatus) return "Não informado";
  if (tire.warrantyStatus === "VALIDA") return "Válida";
  if (tire.warrantyStatus === "VENCIDA") return "Vencida";
  return tire.warrantyStatus;
}

export function getLoadSpeedIndexLabel(tire: Tire) {
  const parts = [tire.loadIndex, tire.speedIndex].filter(Boolean);
  return parts.length ? parts.join(" / ") : "-";
}

export function getCriticalTreadAlert(tire: Tire, alerts: TireAlert[]) {
  return alerts.find((alert) => alert.tireId === tire.id && alert.type === "TREAD") || null;
}

export function getLateInspectionAlert(tire: Tire) {
  const lastDate = tire.lastInspectionDate || tire.readings?.[0]?.readingDate || null;
  if (!lastDate) return "Sem aferição registrada";
  const base = new Date(lastDate);
  if (Number.isNaN(base.getTime())) return "Sem aferição registrada";
  const diffMs = Date.now() - base.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 30) return "Em dia";
  return `Aferição atrasada há ${diffDays} dia(s)`;
}

export function getOpportunityCostLabel(tire: Tire) {
  if (tire.status !== "IN_STOCK") return "-";

  const referenceDate = tire.purchaseDate || tire.createdAt || null;
  if (!referenceDate) return "Pneu parado em estoque";

  const date = new Date(referenceDate);
  if (Number.isNaN(date.getTime())) return "Pneu parado em estoque";

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return "Sem alerta";
  return `Parado no estoque há ${diffDays} dia(s)`;
}

export function tireConditionLabel(tire: Tire) {
  if (tire.status === "RETREADED") return "Recapado";
  if (tire.status === "SCRAPPED") return "Descartado";
  if (tire.status === "MAINTENANCE") return "Em manutenção";

  const current = getCurrentTreadDepth(tire);
  const minimum = tire.minTreadDepthMm ?? 3;

  if (current == null) return "Sem leitura";
  if (current <= minimum) return "Crítico";
  if (current <= minimum + 2) return "Seminovo";
  return "Novo";
}

export function tireSearchText(tire: Tire) {
  return normalizeSearchText(
    [
      tire.serialNumber,
      tire.brand,
      tire.model,
      tire.size,
      tire.axlePosition,
      tire.wheelPosition,
      tireStatusLabel(tire.status),
      tireConditionLabel(tire),
      tireVehicleLabel(tire),
      formatPositionLabel(tire.axlePosition, tire.wheelPosition, Boolean(tire.vehicle)),
      Number(tire.currentKm || 0).toLocaleString("pt-BR"),
      String(tire.currentKm || 0),
    ]
      .filter(Boolean)
      .join(" "),
  );
}