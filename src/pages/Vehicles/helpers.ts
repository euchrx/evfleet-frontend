import type { Vehicle } from "../../types/vehicle";

export type AxleConfiguration = "SINGLE" | "DUAL" | "";

export type VehicleFormData = {
  plate: string;
  model: string;
  brand: string;
  year: string;
  fipeValue: string;
  vehicleType: "LIGHT" | "HEAVY" | "";
  category: "CAR" | "TRUCK" | "UTILITY" | "IMPLEMENT" | "";
  axleCount: string;
  axleConfiguration: AxleConfiguration;
  chassis: string;
  renavam: string;
  acquisitionDate: string;
  noAcquisitionDate: boolean;
  fuelType:
    | "GASOLINE"
    | "ETHANOL"
    | "DIESEL"
    | "FLEX"
    | "ELECTRIC"
    | "HYBRID"
    | "CNG"
    | "";
  tankCapacity: string;
  status: "ACTIVE" | "MAINTENANCE" | "SOLD";
  consumptionMinKmPerLiter: string;
  consumptionMaxKmPerLiter: string;
  photoUrls: string[];
  documentUrls: string[];
  branchId: string;
};

export type VehicleCategory = VehicleFormData["category"];
export type FuelType = Exclude<VehicleFormData["fuelType"], "">;
export type ConsumptionRule = { min: number; max: number };
export type VehicleFieldErrors = Partial<Record<keyof VehicleFormData, string>>;

export const CONSUMPTION_RULES_KEY = "evfleet_consumption_rules_v1";
export const TABLE_PAGE_SIZE = 10;

export const FUEL_OPTIONS: Array<{ value: FuelType; label: string }> = [
  { value: "GASOLINE", label: "Gasolina" },
  { value: "ETHANOL", label: "Etanol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "FLEX", label: "Flex" },
  { value: "ELECTRIC", label: "Elétrico" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "CNG", label: "GNV" },
];

export const FUEL_BY_CATEGORY: Record<Exclude<VehicleCategory, "">, FuelType[]> = {
  CAR: ["GASOLINE", "ETHANOL", "FLEX", "ELECTRIC", "HYBRID", "CNG"],
  TRUCK: ["DIESEL", "CNG"],
  UTILITY: ["GASOLINE", "ETHANOL", "DIESEL", "FLEX", "CNG"],
  IMPLEMENT: [],
};

export const initialForm: VehicleFormData = {
  plate: "",
  model: "",
  brand: "",
  year: "",
  fipeValue: "",
  vehicleType: "",
  category: "",
  axleCount: "",
  axleConfiguration: "",
  chassis: "",
  renavam: "",
  acquisitionDate: "",
  noAcquisitionDate: false,
  fuelType: "",
  tankCapacity: "",
  status: "ACTIVE",
  consumptionMinKmPerLiter: "",
  consumptionMaxKmPerLiter: "",
  photoUrls: [],
  documentUrls: [],
  branchId: "",
};

export function getAllowedCategoriesByVehicleType(
  vehicleType: VehicleFormData["vehicleType"],
) {
  if (vehicleType === "LIGHT") {
    return [
      { value: "CAR" as const, label: "Carro" },
      { value: "UTILITY" as const, label: "Utilitário" },
    ];
  }

  if (vehicleType === "HEAVY") {
    return [
      { value: "TRUCK" as const, label: "Caminhão" },
      { value: "IMPLEMENT" as const, label: "Implemento" },
    ];
  }

  return [
    { value: "CAR" as const, label: "Carro" },
    { value: "UTILITY" as const, label: "Utilitário" },
    { value: "TRUCK" as const, label: "Caminhão" },
    { value: "IMPLEMENT" as const, label: "Implemento" },
  ];
}

export function getAllowedVehicleTypeByCategory(category: VehicleCategory) {
  if (category === "CAR") return "LIGHT";
  if (category === "UTILITY") return "LIGHT";
  if (category === "TRUCK") return "HEAVY";
  if (category === "IMPLEMENT") return "HEAVY";
  return "";
}

export function getAllowedFuelByCategory(category: VehicleCategory) {
  if (!category) return FUEL_OPTIONS;
  const allowed = FUEL_BY_CATEGORY[category] ?? [];
  return FUEL_OPTIONS.filter((item) => allowed.includes(item.value));
}

export function isFuelAllowedForCategory(
  category: VehicleCategory,
  fuelType: VehicleFormData["fuelType"],
) {
  if (!category || !fuelType) return true;
  return (FUEL_BY_CATEGORY[category] ?? []).includes(fuelType as FuelType);
}

export function isSupportedVehicleProfileImage(file: File) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  const byMime = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
    type,
  );

  const byExt = [".jpg", ".jpeg", ".png", ".webp"].some((ext) =>
    name.endsWith(ext),
  );

  return byMime || byExt;
}

export function isUuid(value: string | null | undefined) {
  const raw = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    raw,
  );
}

export function isValidHttpUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeUrlList(values: string[] | undefined) {
  return (values || []).map((item) => String(item || "").trim()).filter(isValidHttpUrl);
}

export function readConsumptionRules() {
  try {
    const raw = localStorage.getItem(CONSUMPTION_RULES_KEY);
    if (!raw) return {} as Record<string, ConsumptionRule>;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {} as Record<string, ConsumptionRule>;
    }

    return parsed as Record<string, ConsumptionRule>;
  } catch {
    return {} as Record<string, ConsumptionRule>;
  }
}

export function saveConsumptionRules(rules: Record<string, ConsumptionRule>) {
  localStorage.setItem(CONSUMPTION_RULES_KEY, JSON.stringify(rules));
}

export const normalizePlate = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

export const normalizeRenavam = (v: string) => v.replace(/\D/g, "").slice(0, 11);

export const normalizeChassis = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);

export const getCategoryLabel = (
  value?: "CAR" | "TRUCK" | "UTILITY" | "IMPLEMENT",
) => {
  if (value === "CAR") return "Carro";
  if (value === "TRUCK") return "Caminhão";
  if (value === "UTILITY") return "Utilitário";
  if (value === "IMPLEMENT") return "Implemento";
  return "-";
};

export const getVehicleTypeLabel = (value?: "LIGHT" | "HEAVY") => {
  if (value === "LIGHT") return "Leve";
  if (value === "HEAVY") return "Pesado";
  return "-";
};

export const getStatusLabel = (value?: "ACTIVE" | "MAINTENANCE" | "SOLD") => {
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "SOLD") return "Vendido";
  return "Ativo";
};

export const getHistoryTypeLabel = (value?: string) => {
  if (value === "VEHICLE_CREATED") return "Cadastro";
  if (value === "VEHICLE_EDIT") return "Edição";
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "FUEL") return "Abastecimento";
  if (value === "FINE") return "Multa";
  if (value === "DEBT") return "Débito";
  if (value === "MAINTENANCE_PLAN") return "Plano de manutenção";
  if (value === "IMPLEMENT_LINKED") return "Implemento vinculado";
  if (value === "IMPLEMENT_UNLINKED") return "Implemento desvinculado";
  if (value === "IMPLEMENT_POSITION_CHANGED") return "Alteração de posição";
  return value || "";
};

export const translateHistoryText = (value: string) => {
  const replacements: Record<string, string> = {
    PREVENTIVE: "Preventiva",
    CORRECTIVE: "Corretiva",
    PERIODIC: "Periódica",
    OPEN: "Aberta",
    DONE: "Concluída",
    ACTIVE: "Ativo",
    MAINTENANCE: "Manutenção",
    SOLD: "Vendido",
    LIGHT: "Leve",
    HEAVY: "Pesado",
    CAR: "Carro",
    TRUCK: "Caminhão",
    UTILITY: "Utilitário",
    IMPLEMENT: "Implemento",
    GASOLINE: "Gasolina",
    ETHANOL: "Etanol",
    DIESEL: "Diesel",
    ARLA32: "ARLA 32",
    FLEX: "Flex",
    ELECTRIC: "Elétrico",
    HYBRID: "Híbrido",
    CNG: "GNV",
    SINGLE: "Simples",
    DUAL: "Duplo",
    LINKED: "Vinculado",
    UNLINKED: "Desvinculado",
    POSITION_CHANGED: "Posição alterada",
  };

  let translated = value;

  for (const [key, label] of Object.entries(replacements)) {
    translated = translated.replaceAll(key, label);
  }

  return translated;
};

export function formatHistoryDate(value: string) {
  const raw = String(value || "").trim();
  const onlyDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (onlyDateMatch) {
    const year = Number(onlyDateMatch[1]);
    const month = Number(onlyDateMatch[2]);
    const day = Number(onlyDateMatch[3]);
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
  }

  const hasExplicitUtc = /z$/i.test(raw);
  const hasOffset = /[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return raw;

  if (hasExplicitUtc || hasOffset) {
    return parsed.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  return parsed.toLocaleDateString("pt-BR");
}

export function syncVehicleRules(form: VehicleFormData): VehicleFormData {
  const currentCategory = String(form.category || "");
  const currentAxleCount = String(form.axleCount || "");
  const currentAxleConfiguration = form.axleConfiguration;

  if (currentCategory === "CAR") {
    return {
      ...form,
      vehicleType: "LIGHT",
      category: "CAR",
      axleCount: "2",
      axleConfiguration: "",
    };
  }

  if (currentCategory === "UTILITY") {
    return {
      ...form,
      vehicleType: "LIGHT",
      category: "UTILITY",
      axleCount: "2",
      axleConfiguration: "",
    };
  }

  if (currentCategory === "TRUCK") {
    return {
      ...form,
      vehicleType: "HEAVY",
      category: "TRUCK",
      axleCount: currentAxleCount === "3" ? "3" : "2",
      axleConfiguration:
        currentAxleConfiguration === "DUAL" || currentAxleConfiguration === "SINGLE"
          ? currentAxleConfiguration
          : "",
    };
  }

  if (currentCategory === "IMPLEMENT") {
    return {
      ...form,
      vehicleType: "HEAVY",
      category: "IMPLEMENT",
      axleCount: ["2", "3", "4"].includes(currentAxleCount) ? currentAxleCount : "2",
      axleConfiguration: "",
      fuelType: "",
      tankCapacity: "",
    };
  }

  if (form.vehicleType === "LIGHT") {
    const allowedLightCategories = ["CAR", "UTILITY"];
    const nextCategory = allowedLightCategories.includes(currentCategory)
      ? (currentCategory as "CAR" | "UTILITY")
      : "";

    return {
      ...form,
      category: nextCategory,
      axleCount: nextCategory ? "2" : "",
      axleConfiguration: "",
    };
  }

  if (form.vehicleType === "HEAVY") {
    const allowedHeavyCategories = ["TRUCK", "IMPLEMENT"];
    const nextCategory = allowedHeavyCategories.includes(currentCategory)
      ? (currentCategory as "TRUCK" | "IMPLEMENT")
      : "";

    return {
      ...form,
      category: nextCategory,
      axleCount:
        nextCategory === "TRUCK"
          ? currentAxleCount === "3"
            ? "3"
            : "2"
          : nextCategory === "IMPLEMENT"
            ? ["2", "3", "4"].includes(currentAxleCount)
              ? currentAxleCount
              : "2"
            : "",
      axleConfiguration:
        nextCategory === "TRUCK"
          ? currentAxleConfiguration === "DUAL" || currentAxleConfiguration === "SINGLE"
            ? currentAxleConfiguration
            : ""
          : "",
      fuelType: nextCategory === "IMPLEMENT" ? "" : form.fuelType,
      tankCapacity: nextCategory === "IMPLEMENT" ? "" : form.tankCapacity,
    };
  }

  return {
    ...form,
    category: "",
    axleCount: "",
    axleConfiguration: "",
  };
}

export function getVehicleAxleCount(vehicle: Vehicle) {
  const value = (vehicle as Vehicle & { axleCount?: number | null }).axleCount;

  if (typeof value === "number" && value > 0) {
    return value;
  }

  if (vehicle.category === "IMPLEMENT") {
    return 2;
  }

  return 2;
}

export function getVehicleAxleConfiguration(vehicle: Vehicle) {
  const value = (vehicle as Vehicle & { axleConfiguration?: string | null })
    .axleConfiguration;

  if (value === "SINGLE") return "Simples";
  if (value === "DUAL") return "Duplo";
  return "-";
}

export function getVehicleCompositionLabels(vehicle: Vehicle) {
  const implementsList = (vehicle.implements ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((item) => item?.implement?.plate);

  return {
    implementsList,
    compositionLabel:
      implementsList.length > 0
        ? [vehicle.plate, ...implementsList.map((item) => item.implement.plate)].join(
            " + ",
          )
        : vehicle.plate,
  };
}

export function normalizeSearchTokens(search: string) {
  return String(search || "")
    .split(/[;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getLinkedVehicle(vehicle: Vehicle, vehicles: Vehicle[]) {
  if (vehicle.category !== "IMPLEMENT") return null;

  return (
    vehicles.find(
      (item) =>
        item.category !== "IMPLEMENT" &&
        (item.implements ?? []).some(
          (link) => link.implementId === vehicle.id || link.implement?.id === vehicle.id,
        ),
    ) ?? null
  );
}

export function buildLinkedVehicleLabel(vehicle: Vehicle, vehicles: Vehicle[]) {
  const linkedVehicle = getLinkedVehicle(vehicle, vehicles);

  if (!linkedVehicle) {
    return "Não vinculado";
  }

  return linkedVehicle.plate || "Não vinculado";
}

export function buildImplementSearchText(vehicle: Vehicle, vehicles: Vehicle[] = []) {
  const linkedVehicleLabel = buildLinkedVehicleLabel(vehicle, vehicles);

  return [
    vehicle.plate,
    vehicle.model,
    vehicle.brand,
    getStatusLabel(vehicle.status).toLowerCase(),
    linkedVehicleLabel,
  ]
    .join(" ")
    .toLowerCase();
}

export function buildVehicleSearchText(
  vehicle: Vehicle,
  branch?: {
    name?: string;
    city?: string;
    state?: string;
  },
) {
  const { implementsList, compositionLabel } = getVehicleCompositionLabels(vehicle);

  return [
    vehicle.plate,
    vehicle.model,
    vehicle.brand,
    String(vehicle.year || ""),
    vehicle.vehicleType === "HEAVY" ? "pesado" : "leve",
    getCategoryLabel(vehicle.category).toLowerCase(),
    getStatusLabel(vehicle.status).toLowerCase(),
    vehicle.fuelType || "",
    String(vehicle.tankCapacity || ""),
    String(getVehicleAxleCount(vehicle)),
    getVehicleAxleConfiguration(vehicle).toLowerCase(),
    vehicle.chassis || "",
    vehicle.renavam || "",
    compositionLabel,
    ...implementsList.map((item) => item.implement.plate),
    branch?.name || "",
    branch?.city || "",
    branch?.state || "",
  ]
    .join(" ")
    .toLowerCase();
}