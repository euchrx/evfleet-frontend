import { useEffect, useMemo, useState } from "react";
import type { Branch } from "../../types/branch";
import type { Vehicle, VehicleHistoryItem } from "../../types/vehicle";
import {
  createVehicle,
  deleteVehicle,
  getVehicleHistory,
  getVehicles,
  uploadVehicleProfilePhoto,
  uploadVehicleFiles,
  updateVehicle,
} from "../../services/vehicles";
import { getBranches } from "../../services/branches";
import { readSoftwareSettings } from "../../services/adminSettings";
import { useBranch } from "../../contexts/BranchContext";
import { useLocation } from "react-router-dom";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { resolveApiMediaUrl } from "../../utils/mediaUrl";

type VehicleFormData = {
  plate: string;
  model: string;
  brand: string;
  year: string;
  vehicleType: "LIGHT" | "HEAVY" | "";
  category: "CAR" | "TRUCK" | "UTILITY" | "";
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

type VehicleCategory = VehicleFormData["category"];
type FuelType = Exclude<VehicleFormData["fuelType"], "">;

type ConsumptionRule = { min: number; max: number };
const CONSUMPTION_RULES_KEY = "evfleet_consumption_rules_v1";
const FUEL_OPTIONS: Array<{ value: FuelType; label: string }> = [
  { value: "GASOLINE", label: "Gasolina" },
  { value: "ETHANOL", label: "Etanol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "FLEX", label: "Flex" },
  { value: "ELECTRIC", label: "Elétrico" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "CNG", label: "GNV" },
];
const FUEL_BY_CATEGORY: Record<Exclude<VehicleCategory, "">, FuelType[]> = {
  CAR: ["GASOLINE", "ETHANOL", "FLEX", "ELECTRIC", "HYBRID", "CNG"],
  TRUCK: ["DIESEL", "CNG"],
  UTILITY: ["GASOLINE", "ETHANOL", "DIESEL", "FLEX", "CNG"],
};

function getAllowedFuelByCategory(category: VehicleCategory) {
  if (!category) return FUEL_OPTIONS;
  const allowed = FUEL_BY_CATEGORY[category];
  return FUEL_OPTIONS.filter((item) => allowed.includes(item.value));
}

function isFuelAllowedForCategory(category: VehicleCategory, fuelType: VehicleFormData["fuelType"]) {
  if (!category || !fuelType) return true;
  return FUEL_BY_CATEGORY[category].includes(fuelType as FuelType);
}

function isSupportedVehicleProfileImage(file: File) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  const byMime = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type);
  const byExt = [".jpg", ".jpeg", ".png", ".webp"].some((ext) => name.endsWith(ext));
  return byMime || byExt;
}

function isValidHttpUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeUrlList(values: string[] | undefined) {
  return (values || []).map((item) => String(item || "").trim()).filter(isValidHttpUrl);
}

const initialForm: VehicleFormData = {
  plate: "",
  model: "",
  brand: "",
  year: "",
  vehicleType: "",
  category: "",
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
const TABLE_PAGE_SIZE = 10;

function readConsumptionRules() {
  try {
    const raw = localStorage.getItem(CONSUMPTION_RULES_KEY);
    if (!raw) return {} as Record<string, ConsumptionRule>;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {} as Record<string, ConsumptionRule>;
    return parsed as Record<string, ConsumptionRule>;
  } catch {
    return {} as Record<string, ConsumptionRule>;
  }
}

function saveConsumptionRules(rules: Record<string, ConsumptionRule>) {
  localStorage.setItem(CONSUMPTION_RULES_KEY, JSON.stringify(rules));
}
const normalizePlate = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
const normalizeRenavam = (v: string) => v.replace(/\D/g, "").slice(0, 11);
const normalizeChassis = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
const getCategoryLabel = (value?: "CAR" | "TRUCK" | "UTILITY") => {
  if (value === "TRUCK") return "Caminháo";
  if (value === "UTILITY") return "Utilitário";
  return "Carro";
};
const getVehicleTypeLabel = (value?: "LIGHT" | "HEAVY") =>
  value === "HEAVY" ? "Pesado" : "Leve";
const getStatusLabel = (value?: "ACTIVE" | "MAINTENANCE" | "SOLD") => {
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "SOLD") return "Vendido";
  return "Ativo";
};
const getHistoryTypeLabel = (value?: string) => {
  if (value === "VEHICLE_CREATED") return "Cadastro";
  if (value === "VEHICLE_EDIT") return "Edicao";
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "FUEL") return "Abastecimento";
  if (value === "FINE") return "Multa";
  if (value === "MAINTENANCE_PLAN") return "Plano de manutenção";
  return value || "";
};
const translateHistoryText = (value: string) => {
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
    TRUCK: "Caminháo",
    UTILITY: "Utilitário",
    GASOLINE: "Gasolina",
    ETHANOL: "Etanol",
    DIESEL: "Diesel",
    FLEX: "Flex",
    ELECTRIC: "Elétrico",
    HYBRID: "Híbrido",
    CNG: "GNV",
  };

  let translated = value;
  for (const [key, label] of Object.entries(replacements)) {
    translated = translated.replaceAll(key, label);
  }
  return translated;
};

function formatHistoryDate(value: string) {
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

export function VehiclesPage() {
  type VehicleFieldErrors = Partial<Record<keyof VehicleFormData, string>>;

  const { selectedBranchId } = useBranch();
  const { pathname } = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "LIGHT" | "HEAVY">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "MAINTENANCE" | "SOLD">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleFormData>(initialForm);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [historyItems, setHistoryItems] = useState<VehicleHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [currentProfilePhotoUrl, setCurrentProfilePhotoUrl] = useState("");
  const [sortBy, setSortBy] = useState<"plate" | "vehicle" | "type" | "status">("plate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [maxVehiclesAllowed, setMaxVehiclesAllowed] = useState(() =>
    Number(readSoftwareSettings().maxVehiclesAllowed || 0)
  );
  const [isBranchLocked, setIsBranchLocked] = useState(() => {
    const settings = readSoftwareSettings();
    return Boolean(settings.lockDefaultBranch && settings.defaultBranchId);
  });

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const [v, b] = await Promise.all([getVehicles(), getBranches()]);
      setVehicles(v);
      setBranches(b);
    } catch {
      setPageErrorMessage("Não foi possível carregar os dados de veículos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  useEffect(() => {
    const settings = readSoftwareSettings();
    setMaxVehiclesAllowed(Number(settings.maxVehiclesAllowed || 0));
    function refreshBranchLock() {
      const settings = readSoftwareSettings();
      setIsBranchLocked(Boolean(settings.lockDefaultBranch && settings.defaultBranchId));
    }
    window.addEventListener("evfleet-default-branch-updated", refreshBranchLock);
    return () =>
      window.removeEventListener("evfleet-default-branch-updated", refreshBranchLock);
  }, []);

  const allowedFuelOptions = useMemo(
    () => getAllowedFuelByCategory(form.category),
    [form.category]
  );

  const selectedProfilePhotoPreview = useMemo(
    () => (photoFiles[0] ? URL.createObjectURL(photoFiles[0]) : ""),
    [photoFiles]
  );

  useEffect(() => {
    return () => {
      if (selectedProfilePhotoPreview) URL.revokeObjectURL(selectedProfilePhotoPreview);
    };
  }, [selectedProfilePhotoPreview]);

  useEffect(() => {
    function refreshMaxVehiclesAllowed() {
      const settings = readSoftwareSettings();
      setMaxVehiclesAllowed(Number(settings.maxVehiclesAllowed || 0));
    }
    window.addEventListener("evfleet-settings-updated", refreshMaxVehiclesAllowed);
    return () => window.removeEventListener("evfleet-settings-updated", refreshMaxVehiclesAllowed);
  }, []);

  function clearFieldError(field: keyof VehicleFormData) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function getFieldClass(field: keyof VehicleFormData, extra = "") {
    const base =
      "w-full rounded-xl px-4 py-3 outline-none transition";
    if (fieldErrors[field]) {
      return `${base} border border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200 ${extra}`;
    }
    return `${base} border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 ${extra}`;
  }

  useEffect(() => {
    if (pathname.includes("/vehicles")) {
      setSortBy("plate");
      setSortDirection("asc");
    }
  }, [pathname]);

  function openCreate() {
    const settings = readSoftwareSettings();
    const maxVehiclesAllowed = Number(settings.maxVehiclesAllowed || 0);
    if (maxVehiclesAllowed >= 0 && vehicles.length >= maxVehiclesAllowed) {
      setPageErrorMessage("Limite máximo atingido para cadastro de veículos. Entre em contato com o suporte.");
      return;
    }
    setPageErrorMessage("");
    setEditingVehicle(null);
    setForm({ ...initialForm, branchId: selectedBranchId });
    setPhotoFiles([]);
    setDocumentFiles([]);
    setCurrentProfilePhotoUrl("");
    setIsModalOpen(true);
    setFormErrorMessage("");
    setFieldErrors({});
  }

  function openEdit(vehicle: Vehicle) {
    const rules = readConsumptionRules();
    const currentRule = rules[vehicle.id];
    setEditingVehicle(vehicle);
    setForm({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      year: String(vehicle.year),
      vehicleType: vehicle.vehicleType,
      category: vehicle.category || "CAR",
      chassis: vehicle.chassis || "",
      renavam: vehicle.renavam || "",
      acquisitionDate: vehicle.acquisitionDate?.slice(0, 10) || "",
      noAcquisitionDate: !vehicle.acquisitionDate,
      fuelType: vehicle.fuelType || "DIESEL",
      tankCapacity: String(vehicle.tankCapacity || ""),
      status: vehicle.status || "ACTIVE",
      consumptionMinKmPerLiter: currentRule ? String(currentRule.min) : "",
      consumptionMaxKmPerLiter: currentRule ? String(currentRule.max) : "",
      photoUrls: vehicle.photoUrls || [],
      documentUrls: vehicle.documentUrls || [],
      branchId: vehicle.branchId,
    });
    setPhotoFiles([]);
    setDocumentFiles([]);
    setCurrentProfilePhotoUrl(vehicle.profilePhotoUrl || vehicle.photoUrls?.[0] || "");
    setIsModalOpen(true);
    setFormErrorMessage("");
    setFieldErrors({});
  }

  async function loadHistoryPage(vehicleId: string, page: number) {
    try {
      setHistoryLoading(true);
      const res = await getVehicleHistory(vehicleId, page, 10);
      setHistoryItems(res.history || []);
      setHistoryPage(res.page || page);
      setHistoryTotalPages(res.totalPages || 1);
      setHistoryTotal(res.total || 0);
    } catch {
      setPageErrorMessage("Não foi possível carregar o histórico do veículo.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistory(vehicle: Vehicle) {
    setHistoryVehicle(vehicle);
    setHistoryOpen(true);
    await loadHistoryPage(vehicle.id, 1);
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistoryVehicle(null);
    setHistoryItems([]);
    setHistoryPage(1);
    setHistoryTotalPages(1);
    setHistoryTotal(0);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFormErrorMessage("");
      setFieldErrors({});

      if (!editingVehicle) {
        const settings = readSoftwareSettings();
        const maxVehiclesAllowed = Number(settings.maxVehiclesAllowed || 0);
        if (maxVehiclesAllowed >= 0 && vehicles.length >= maxVehiclesAllowed) {
          setFormErrorMessage("Limite máximo atingido para cadastro de veículos. Entre em contato com o suporte.");
          return;
        }
      }

      const uploadedDocumentUrls = await uploadVehicleFiles("document", documentFiles);
      const safeExistingPhotoUrls = sanitizeUrlList(form.photoUrls);
      const safeExistingDocumentUrls = sanitizeUrlList(form.documentUrls);
      const safeUploadedDocumentUrls = sanitizeUrlList(uploadedDocumentUrls);

      const payload = {
        plate: normalizePlate(form.plate),
        model: form.model.trim(),
        brand: form.brand.trim(),
        year: Number(form.year),
        vehicleType: form.vehicleType as "LIGHT" | "HEAVY",
        category: form.category as "CAR" | "TRUCK" | "UTILITY",
        chassis: normalizeChassis(form.chassis),
        renavam: normalizeRenavam(form.renavam),
        acquisitionDate: form.noAcquisitionDate ? undefined : form.acquisitionDate || undefined,
        fuelType: form.fuelType as
          | "GASOLINE"
          | "ETHANOL"
          | "DIESEL"
          | "FLEX"
          | "ELECTRIC"
          | "HYBRID"
          | "CNG",
        tankCapacity: Number(form.tankCapacity),
        status: form.status,
        photoUrls: safeExistingPhotoUrls,
        documentUrls: Array.from(new Set([...safeExistingDocumentUrls, ...safeUploadedDocumentUrls])),
        branchId: form.branchId,
      };

      const nextFieldErrors: VehicleFieldErrors = {};
      if (!payload.plate) nextFieldErrors.plate = "Informe a placa.";
      if (!payload.model) nextFieldErrors.model = "Informe o modelo.";
      if (!payload.brand) nextFieldErrors.brand = "Informe a marca.";
      if (!payload.branchId) nextFieldErrors.branchId = "Selecione a filial.";
      if (!form.vehicleType) nextFieldErrors.vehicleType = "Selecione o tipo de peso.";
      if (!form.category) nextFieldErrors.category = "Selecione o tipo de veículo.";
      if (!form.fuelType) nextFieldErrors.fuelType = "Selecione o combustível.";
      if (form.category && form.fuelType && !isFuelAllowedForCategory(form.category, form.fuelType)) {
        nextFieldErrors.fuelType = "Combustível não permitido para o tipo de veículo.";
      }
      if (!payload.chassis) nextFieldErrors.chassis = "Informe o chassi.";
      if (!payload.renavam) nextFieldErrors.renavam = "Informe o renavam.";
      if (Number.isNaN(payload.year) || payload.year < 1900) {
        nextFieldErrors.year = "Informe um ano válido.";
      }
      if (Number.isNaN(payload.tankCapacity) || payload.tankCapacity <= 0) {
        nextFieldErrors.tankCapacity = "Informe capacidade de tanque valida.";
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        return;
      }

      const needsConsumptionRule =
        form.vehicleType === "LIGHT" || form.category === "UTILITY";
      const minRaw = form.consumptionMinKmPerLiter.trim();
      const maxRaw = form.consumptionMaxKmPerLiter.trim();
      const hasConsumptionInput = Boolean(minRaw || maxRaw);
      const minConsumption = Number(minRaw.replace(",", "."));
      const maxConsumption = Number(maxRaw.replace(",", "."));

      if (hasConsumptionInput && (!minRaw || !maxRaw)) {
        setFieldErrors((prev) => ({
          ...prev,
          consumptionMinKmPerLiter: "Preencha mínimo e máximo ou deixe ambos em branco.",
          consumptionMaxKmPerLiter: "Preencha mínimo e máximo ou deixe ambos em branco.",
        }));
        return;
      }

      if (hasConsumptionInput) {
        if (
          Number.isNaN(minConsumption) ||
          Number.isNaN(maxConsumption) ||
          minConsumption <= 0 ||
          maxConsumption <= 0 ||
          minConsumption >= maxConsumption
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            consumptionMinKmPerLiter: "Faixa invalida.",
            consumptionMaxKmPerLiter: "Faixa invalida.",
          }));
          return;
        }
      }

      const savedVehicle = editingVehicle
        ? await updateVehicle(editingVehicle.id, payload)
        : await createVehicle(payload);

      if (photoFiles[0]) {
        await uploadVehicleProfilePhoto(savedVehicle.id, photoFiles[0]);
      }

      const savedVehicleId = savedVehicle.id;
      const currentRules = readConsumptionRules();

      if (needsConsumptionRule && hasConsumptionInput) {
        currentRules[savedVehicleId] = { min: minConsumption, max: maxConsumption };
      } else if (currentRules[savedVehicleId]) {
        delete currentRules[savedVehicleId];
      }
      saveConsumptionRules(currentRules);
      setIsModalOpen(false);
      setForm(initialForm);
      setPhotoFiles([]);
      setDocumentFiles([]);
      setCurrentProfilePhotoUrl("");
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Não foi possível salvar o veículo.";
      const message = Array.isArray(msg) ? msg.join(", ") : String(msg);
      const duplicatedFieldErrors: VehicleFieldErrors = {};
      const isDuplicateMessage = /(ja existe|já existe|cadastrado)/i.test(message);

      if (isDuplicateMessage && /placa/i.test(message)) {
        duplicatedFieldErrors.plate = "Placa ja cadastrada.";
      }
      if (isDuplicateMessage && /chassi/i.test(message)) {
        duplicatedFieldErrors.chassis = "Chassi ja cadastrado.";
      }
      if (isDuplicateMessage && /renavam/i.test(message)) {
        duplicatedFieldErrors.renavam = "Renavam ja cadastrado.";
      }
      if (/branch|filial/i.test(message)) {
        duplicatedFieldErrors.branchId = "Filial invalida.";
      }
      if (
        /chassi.+mínimo|mínimo.+chassi|chassi.+minimo|minimo.+chassi|chassis.+longer than or equal to/i.test(
          message,
        )
      ) {
        duplicatedFieldErrors.chassis = "Chassi deve ter no mínimo 8 caracteres.";
      }

      if (Object.keys(duplicatedFieldErrors).length > 0) {
        setFormErrorMessage("");
        setFieldErrors((prev) => ({ ...prev, ...duplicatedFieldErrors }));
      } else {
        setFormErrorMessage(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(vehicle: Vehicle) {
    setVehicleToDelete(vehicle);
  }

  async function confirmDeleteVehicle() {
    if (!vehicleToDelete) return;
    try {
      setDeletingVehicle(true);
      await deleteVehicle(vehicleToDelete.id);
      setVehicleToDelete(null);
      await loadData();
    } finally {
      setDeletingVehicle(false);
    }
  }

  function toggleSort(column: "plate" | "vehicle" | "type" | "status") {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: "plate" | "vehicle" | "type" | "status") {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  const filtered = useMemo(() => {
    let list = vehicles;
    if (selectedBranchId) list = list.filter((v) => v.branchId === selectedBranchId);
    if (categoryFilter !== "ALL") list = list.filter((v) => v.vehicleType === categoryFilter);
    if (statusFilter !== "ALL") list = list.filter((v) => (v.status || "ACTIVE") === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => {
        const branch = branches.find((b) => b.id === v.branchId);
        const haystack = [
          v.plate,
          v.model,
          v.brand,
          String(v.year || ""),
          v.vehicleType === "HEAVY" ? "pesado" : "leve",
          getCategoryLabel(v.category).toLowerCase(),
          getStatusLabel(v.status).toLowerCase(),
          v.fuelType || "",
          String(v.tankCapacity || ""),
          v.chassis || "",
          v.renavam || "",
          branch?.name || "",
          branch?.city || "",
          branch?.state || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...list].sort((a, b) => {
      if (sortBy === "plate") {
        return a.plate.localeCompare(b.plate, "pt-BR") * direction;
      }

      if (sortBy === "vehicle") {
        const aVehicle = `${a.brand} ${a.model}`;
        const bVehicle = `${b.brand} ${b.model}`;
        return aVehicle.localeCompare(bVehicle, "pt-BR") * direction;
      }

      if (sortBy === "status") {
        const statusOrder: Record<string, number> = { ACTIVE: 0, MAINTENANCE: 1, SOLD: 2 };
        return ((statusOrder[a.status || "ACTIVE"] ?? 0) - (statusOrder[b.status || "ACTIVE"] ?? 0)) * direction;
      }

      const weightOrder: Record<string, number> = { LIGHT: 0, HEAVY: 1 };
      return ((weightOrder[a.vehicleType] ?? 0) - (weightOrder[b.vehicleType] ?? 0)) * direction;
    });
  }, [vehicles, selectedBranchId, categoryFilter, statusFilter, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE)),
    [filtered.length]
  );

  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filtered.slice(start, start + TABLE_PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchId, categoryFilter, statusFilter, sortBy, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const scoped = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;

    return {
      total: scoped.length,
      active: scoped.filter((vehicle) => vehicle.status === "ACTIVE").length,
      maintenance: scoped.filter((vehicle) => vehicle.status === "MAINTENANCE").length,
      light: scoped.filter((vehicle) => vehicle.vehicleType === "LIGHT").length,
      heavy: scoped.filter((vehicle) => vehicle.vehicleType === "HEAVY").length,
    };
  }, [vehicles, selectedBranchId]);

  const isVehicleLimitReached = useMemo(
    () => maxVehiclesAllowed >= 0 && vehicles.length >= maxVehiclesAllowed,
    [maxVehiclesAllowed, vehicles.length]
  );
  const isCreateButtonBlockedVisual = loading || isVehicleLimitReached;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Veículos</h1>
          <p className="text-sm text-slate-500">Cadastro completo da frota.</p>
        </div>
        <button
          onClick={() => {
            if (loading) return;
            openCreate();
          }}
          style={{ cursor: isCreateButtonBlockedVisual ? "not-allowed" : "pointer" }}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition sm:w-auto ${
            isCreateButtonBlockedVisual
              ? "cursor-not-allowed bg-slate-400"
              : "cursor-pointer bg-orange-500 hover:bg-orange-600"
          }`}
        >
          + Cadastrar veículo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Manutenção</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.maintenance}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Leves</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{summary.light}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Pesados</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">{summary.heavy}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, modelo ou marca" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "ALL" | "LIGHT" | "HEAVY")} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Todas as categorias</option>
            <option value="LIGHT">Leves</option>
            <option value="HEAVY">Pesados</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "MAINTENANCE" | "SOLD")} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="MAINTENANCE">Manutenção</option>
            <option value="SOLD">Vendido</option>
          </select>
        </div>
      </div>

      {pageErrorMessage && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageErrorMessage}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("plate")}
                    className="cursor-pointer inline-flex items-center gap-1 transition hover:text-slate-900"
                  >
                    Placa <span className="text-xs">{getSortArrow("plate")}</span>
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("vehicle")}
                    className="cursor-pointer inline-flex items-center gap-1 transition hover:text-slate-900"
                  >
                    Veículo <span className="text-xs">{getSortArrow("vehicle")}</span>
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("type")}
                    className="cursor-pointer inline-flex items-center gap-1 transition hover:text-slate-900"
                  >
                    Tipo <span className="text-xs">{getSortArrow("type")}</span>
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="cursor-pointer inline-flex items-center gap-1 transition hover:text-slate-900"
                  >
                    Status <span className="text-xs">{getSortArrow("status")}</span>
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum veículo encontrado.
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((v) => (
                  <tr key={v.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{v.plate}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{v.brand} {v.model}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getCategoryLabel(v.category)} | {getVehicleTypeLabel(v.vehicleType)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`status-pill ${
                          v.status === "ACTIVE"
                            ? "status-active"
                            : v.status === "MAINTENANCE"
                            ? "status-pending"
                            : "status-inactive"
                        }`}
                      >
                        {getStatusLabel(v.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button onClick={() => openHistory(v)} className="btn-ui btn-ui-neutral">Histórico</button><button onClick={() => openEdit(v)} className="btn-ui btn-ui-neutral">Editar</button><button onClick={() => onDelete(v)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="veículos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <div className="relative mx-auto my-4 flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl md:my-6 md:h-[calc(100dvh-3rem)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingVehicle ? "Editar veículo" : "Cadastrar veículo"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha os dados operacionais e documentais do veículo.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormErrorMessage("");
                }}
                className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex-1 space-y-5 overflow-y-auto px-6 pt-6 pb-0">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Identificacao
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Placa</span>
                    <input value={form.plate} onChange={(e) => { setForm({ ...form, plate: normalizePlate(e.target.value) }); clearFieldError("plate"); }} className={getFieldClass("plate", "uppercase")} placeholder="ABC1234" />
                    {fieldErrors.plate ? <p className="text-xs text-red-600">{fieldErrors.plate}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Filial</span>
                    <select value={form.branchId} disabled={isBranchLocked} onChange={(e) => { setForm({ ...form, branchId: e.target.value }); clearFieldError("branchId"); }} className={`${getFieldClass("branchId")} disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`}><option value="">Selecione uma filial</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                    {fieldErrors.branchId ? <p className="text-xs text-red-600">{fieldErrors.branchId}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Marca</span>
                    <input value={form.brand} onChange={(e) => { setForm({ ...form, brand: e.target.value }); clearFieldError("brand"); }} className={getFieldClass("brand")} placeholder="Volvo" />
                    {fieldErrors.brand ? <p className="text-xs text-red-600">{fieldErrors.brand}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Modelo</span>
                    <input value={form.model} onChange={(e) => { setForm({ ...form, model: e.target.value }); clearFieldError("model"); }} className={getFieldClass("model")} placeholder="FH 540" />
                    {fieldErrors.model ? <p className="text-xs text-red-600">{fieldErrors.model}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Ano</span>
                    <input value={form.year} onChange={(e) => { setForm({ ...form, year: e.target.value }); clearFieldError("year"); }} className={getFieldClass("year")} placeholder="2024" />
                    {fieldErrors.year ? <p className="text-xs text-red-600">{fieldErrors.year}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Data de aquisicao</span>
                    <input type="date" value={form.acquisitionDate} disabled={form.noAcquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.noAcquisitionDate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            noAcquisitionDate: e.target.checked,
                            acquisitionDate: e.target.checked ? "" : prev.acquisitionDate,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                      />
                      Sem data de aquisicao
                    </label>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Chassi</span>
                    <input value={form.chassis} onChange={(e) => { setForm({ ...form, chassis: normalizeChassis(e.target.value) }); clearFieldError("chassis"); }} className={getFieldClass("chassis", "uppercase")} placeholder="9BWZZZ..." />
                    {fieldErrors.chassis ? <p className="text-xs text-red-600">{fieldErrors.chassis}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Renavam</span>
                    <input value={form.renavam} onChange={(e) => { setForm({ ...form, renavam: normalizeRenavam(e.target.value) }); clearFieldError("renavam"); }} className={getFieldClass("renavam")} placeholder="11 dígitos" />
                    {fieldErrors.renavam ? <p className="text-xs text-red-600">{fieldErrors.renavam}</p> : null}
                  </label>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Foto de perfil do veículo</span>
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {(selectedProfilePhotoPreview || currentProfilePhotoUrl || form.photoUrls[0]) ? (
                          <img
                            src={selectedProfilePhotoPreview || resolveApiMediaUrl(currentProfilePhotoUrl || form.photoUrls[0])}
                            alt="Foto de perfil do veículo"
                            className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-400">
                            Sem foto
                          </div>
                        )}
                        <p className="text-xs text-slate-500">Essa foto será usada na identificação visual dos cards.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                          Selecionar foto
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) {
                                setPhotoFiles([]);
                                e.currentTarget.value = "";
                                return;
                              }
                              if (!isSupportedVehicleProfileImage(file)) {
                                setPhotoFiles([]);
                                setFormErrorMessage("Formato não suportado para foto de perfil. Use JPG, PNG ou WEBP.");
                                e.currentTarget.value = "";
                                return;
                              }
                              setFormErrorMessage("");
                              setPhotoFiles([file]);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {photoFiles.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setPhotoFiles([])}
                            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Operação
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Tipo de categoria</span>
                    <select
                      value={form.vehicleType}
                      onChange={(e) => {
                        setForm({ ...form, vehicleType: e.target.value as VehicleFormData["vehicleType"] });
                        clearFieldError("vehicleType");
                      }}
                      className={getFieldClass("vehicleType")}
                    >
                      <option value="">Seleciona a categoria</option>
                      <option value="LIGHT">Leve</option>
                      <option value="HEAVY">Pesado</option>
                    </select>
                    {fieldErrors.vehicleType ? <p className="text-xs text-red-600">{fieldErrors.vehicleType}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Tipo de veículo</span>
                    <select
                      value={form.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value as "CAR" | "TRUCK" | "UTILITY" | "";
                        setForm((prev) => {
                          const allowed = getAllowedFuelByCategory(nextCategory).map((item) => item.value);
                          const nextFuelType =
                            prev.fuelType && allowed.includes(prev.fuelType as FuelType) ? prev.fuelType : "";
                          return { ...prev, category: nextCategory, fuelType: nextFuelType };
                        });
                        clearFieldError("category");
                        clearFieldError("fuelType");
                      }}
                      className={getFieldClass("category")}
                    >
                      <option value="">Selecione o tipo de veículo</option>
                      <option value="CAR">Carro</option>
                      <option value="TRUCK">Caminhão</option>
                      <option value="UTILITY">Utilitário</option>
                    </select>
                    {fieldErrors.category ? <p className="text-xs text-red-600">{fieldErrors.category}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Combustível</span>
                    <select
                      value={form.fuelType}
                      onChange={(e) => {
                        setForm({ ...form, fuelType: e.target.value as VehicleFormData["fuelType"] });
                        clearFieldError("fuelType");
                      }}
                      className={getFieldClass("fuelType")}
                    >
                      <option value="">Selecione o combustível</option>
                      {allowedFuelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.fuelType ? <p className="text-xs text-red-600">{fieldErrors.fuelType}</p> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Capacidade do tanque (L)</span>
                    <input type="number" value={form.tankCapacity} onChange={(e) => { setForm({ ...form, tankCapacity: e.target.value }); clearFieldError("tankCapacity"); }} className={getFieldClass("tankCapacity")} placeholder="120" />
                    {fieldErrors.tankCapacity ? <p className="text-xs text-red-600">{fieldErrors.tankCapacity}</p> : null}
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Status</span>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VehicleFormData["status"] })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"><option value="ACTIVE">Ativo</option><option value="MAINTENANCE">Manutenção</option><option value="SOLD">Vendido</option></select>
                  </label>
                  {(form.vehicleType === "LIGHT" || form.category === "UTILITY") ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-700">Consumo minimo (km/L)</span>
                        <input
                          value={form.consumptionMinKmPerLiter}
                          onChange={(e) => {
                            setForm({ ...form, consumptionMinKmPerLiter: e.target.value });
                            clearFieldError("consumptionMinKmPerLiter");
                          }}
                          className={getFieldClass("consumptionMinKmPerLiter")}
                          placeholder="Ex: 6.0"
                        />
                        {fieldErrors.consumptionMinKmPerLiter ? (
                          <p className="text-xs text-red-600">{fieldErrors.consumptionMinKmPerLiter}</p>
                        ) : null}
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-700">Consumo maximo (km/L)</span>
                        <input
                          value={form.consumptionMaxKmPerLiter}
                          onChange={(e) => {
                            setForm({ ...form, consumptionMaxKmPerLiter: e.target.value });
                            clearFieldError("consumptionMaxKmPerLiter");
                          }}
                          className={getFieldClass("consumptionMaxKmPerLiter")}
                          placeholder="Ex: 10.0"
                        />
                        {fieldErrors.consumptionMaxKmPerLiter ? (
                          <p className="text-xs text-red-600">{fieldErrors.consumptionMaxKmPerLiter}</p>
                        ) : null}
                      </label>
                    </>
                  ) : null}
                </div>
              </div>

              {formErrorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formErrorMessage}
                </div>
              )}

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white py-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{saving ? "Salvando..." : "Salvar veículo"}</button>
              </div>
            </form>

          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-xl font-bold text-slate-900">Histórico - {historyVehicle?.plate}</h2><button onClick={closeHistory} className="rounded-lg px-3 py-2 text-slate-500">Fechar</button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {historyLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-slate-500">Sem eventos.</p>
              ) : (
                historyItems.map((item, i) => <div key={`${item.type}-${i}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="font-semibold text-slate-900">{translateHistoryText(item.title)}</p><p className="text-xs text-slate-500">{formatHistoryDate(item.date)}</p></div><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{getHistoryTypeLabel(item.type)}</p><p className="mt-1 text-sm text-slate-600">{translateHistoryText(item.description)}</p></div>)
              )}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <p className="text-xs text-slate-500">
                Pagina {historyPage} de {historyTotalPages} • {historyTotal} evento(s)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => historyVehicle && loadHistoryPage(historyVehicle.id, historyPage - 1)}
                  disabled={historyPage <= 1 || historyLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => historyVehicle && loadHistoryPage(historyVehicle.id, historyPage + 1)}
                  disabled={historyPage >= historyTotalPages || historyLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(vehicleToDelete)}
        title="Excluir veículo"
        description={
          vehicleToDelete
            ? `Deseja excluir o veículo ${vehicleToDelete.brand} ${vehicleToDelete.model}?`
            : ""
        }
        loading={deletingVehicle}
        onCancel={() => setVehicleToDelete(null)}
        onConfirm={confirmDeleteVehicle}
      />
    </div>
  );
}
