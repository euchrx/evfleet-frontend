import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Branch } from "../../types/branch";
import type { Vehicle, VehicleHistoryItem } from "../../types/vehicle";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import { getBranches } from "../../services/branches";
import { getCachedMenuVisibilityMap } from "../../services/menuVisibility";
import {
  createVehicle,
  deleteVehicle,
  getVehicleHistory,
  getVehicles,
  updateVehicle,
  uploadVehicleFiles,
  uploadVehicleProfilePhoto,
} from "../../services/vehicles";
import { VehiclesTablesSection } from "./VehiclesTablesSection";
import { VehicleFormModal } from "./VehicleFormModal";
import { VehicleImplementsSection } from "./VehicleImplementsSection";
import { VehicleHistoryModal } from "./VehicleHistoryModal";
import useVehiclesTables, {
  initialVehicleFilters,
  type VehicleFilters,
} from "./useVehiclesTables";
import {
  type AxleConfiguration,
  type VehicleFieldErrors,
  type VehicleFormData,
  initialForm,
  isFuelAllowedForCategory,
  isUuid,
  normalizeChassis,
  normalizePlate,
  normalizeRenavam,
  readConsumptionRules,
  saveConsumptionRules,
  sanitizeUrlList,
  syncVehicleRules,
  getCategoryLabel,
  getVehicleTypeLabel,
  getStatusLabel,
  getVehicleAxleCount,
  getVehicleAxleConfiguration,
  TABLE_PAGE_SIZE,
} from "./helpers";

type VehiclesTab = "vehicles" | "implements";

function parseCurrencyToNumber(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function VehiclesPage() {
  useBranch();
  const { selectedCompanyId, currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();
  const { pathname } = useLocation();

  const [branchFieldsEnabled, setBranchFieldsEnabled] = useState(
    () => getCachedMenuVisibilityMap()["/branches"] !== false,
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<VehicleFilters>(initialVehicleFilters);
  const [appliedFilters, setAppliedFilters] = useState<VehicleFilters>(initialVehicleFilters);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<VehiclesTab>("vehicles");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [linkingVehicle, setLinkingVehicle] = useState<Vehicle | null>(null);

  const [form, setForm] = useState<VehicleFormData>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>({});
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");

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

  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [deletingSelectedVehicles, setDeletingSelectedVehicles] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const {
    sortBy,
    sortDirection,
    toggleSort,
    getSortArrow,
    currentVehiclesPage,
    setCurrentVehiclesPage,
    currentImplementsPage,
    setCurrentImplementsPage,
    filteredVehicles,
    filteredImplements,
    paginatedVehicles,
    paginatedImplements,
    vehiclesTotalPages,
    implementsTotalPages,
    allSelectedIds,
    clearSelections,
    allTopVehiclesOnPageSelected,
    allImplementsOnPageSelected,
    toggleTopVehicleSelection,
    toggleImplementSelection,
    toggleSelectAllTopVehiclesOnPage,
    toggleSelectAllImplementsOnPage,
  } = useVehiclesTables({
    vehicles,
    activeTab,
    hasSearched,
    filters: appliedFilters,
  });

  async function loadFilterOptions() {
    try {
      const visibility = getCachedMenuVisibilityMap();
      const branchesEnabled = visibility["/branches"] !== false;
      setBranchFieldsEnabled(branchesEnabled);

      if (!branchesEnabled) {
        setBranches([]);
        return;
      }

      const branchesData = await getBranches();
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch {
      setPageErrorMessage("Não foi possível carregar as opções de filtro.");
    }
  }

  async function loadData(nextFilters: VehicleFilters = appliedFilters) {
    try {
      setLoading(true);
      setPageErrorMessage("");

      const visibility = getCachedMenuVisibilityMap();
      const branchesEnabled = visibility["/branches"] !== false;
      setBranchFieldsEnabled(branchesEnabled);

      const vehiclesData = await getVehicles();
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setAppliedFilters(nextFilters);
      setHasSearched(true);
    } catch {
      setPageErrorMessage("Não foi possível carregar os dados de veículos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilterOptions();
    void loadData(initialVehicleFilters);
  }, [selectedCompanyId]);

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
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen, isLinkModalOpen]);

  useEffect(() => {
    if (pathname.includes("/vehicles")) {
      // Mantido apenas para preservar comportamento da rota.
    }
  }, [pathname]);

  const selectedProfilePhotoPreview = useMemo(
    () => (photoFiles[0] ? URL.createObjectURL(photoFiles[0]) : ""),
    [photoFiles],
  );

  useEffect(() => {
    return () => {
      if (selectedProfilePhotoPreview) {
        URL.revokeObjectURL(selectedProfilePhotoPreview);
      }
    };
  }, [selectedProfilePhotoPreview]);

  const summary = useMemo(() => {
    if (!hasSearched) {
      return {
        total: 0,
        active: 0,
        maintenance: 0,
        linked: 0,
        light: 0,
        heavy: 0,
      };
    }

    const scoped = activeTab === "implements" ? filteredImplements : filteredVehicles;

    const vehiclesOnly = scoped.filter((vehicle) => vehicle.category !== "IMPLEMENT");
    const implementsOnly = scoped.filter((vehicle) => vehicle.category === "IMPLEMENT");

    if (activeTab === "implements") {
      return {
        total: implementsOnly.length,
        active: implementsOnly.filter((vehicle) => vehicle.status === "ACTIVE").length,
        maintenance: implementsOnly.filter(
          (vehicle) => vehicle.status === "MAINTENANCE",
        ).length,
        linked: 0,
        light: 0,
        heavy: 0,
      };
    }

    return {
      total: vehiclesOnly.length,
      active: vehiclesOnly.filter((vehicle) => vehicle.status === "ACTIVE").length,
      maintenance: vehiclesOnly.filter(
        (vehicle) => vehicle.status === "MAINTENANCE",
      ).length,
      linked: 0,
      light: vehiclesOnly.filter((vehicle) => vehicle.vehicleType === "LIGHT").length,
      heavy: vehiclesOnly.filter((vehicle) => vehicle.vehicleType === "HEAVY").length,
    };
  }, [activeTab, filteredImplements, filteredVehicles, hasSearched]);

  const pageTitle = activeTab === "vehicles" ? "Veículos" : "Implementos";
  const pageSubtitle =
    activeTab === "vehicles"
      ? "Consulte e gerencie os veículos cadastrados no sistema."
      : "Consulte e gerencie os implementos cadastrados no sistema.";

  function updateFilterDraft(field: keyof VehicleFilters, value: string) {
    setFiltersDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleConsult() {
    void loadData({ ...filtersDraft });
  }

  async function handleClearFilters() {
    clearSelections();
    setFiltersDraft(initialVehicleFilters);
    await loadData(initialVehicleFilters);
  }

  function applyFiltersAndSearch(nextFilters: VehicleFilters, nextTab?: VehiclesTab) {
    if (nextTab) {
      setActiveTab(nextTab);
    }
    setFiltersDraft(nextFilters);
    void loadData(nextFilters);
  }

  function clearFieldError(field: keyof VehicleFormData) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function getFieldClass(field: keyof VehicleFormData, extra = "") {
    const base = "w-full rounded-xl px-4 py-3 outline-none transition";
    if (fieldErrors[field]) {
      return `${base} border border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200 ${extra}`;
    }
    return `${base} border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 ${extra}`;
  }

  function openCreate() {
    setPageErrorMessage("");
    setEditingVehicle(null);
    setForm({ ...initialForm });
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

    const safeFuelType: VehicleFormData["fuelType"] =
      vehicle.fuelType === "GASOLINE" ||
      vehicle.fuelType === "ETHANOL" ||
      vehicle.fuelType === "DIESEL" ||
      vehicle.fuelType === "FLEX" ||
      vehicle.fuelType === "ELECTRIC" ||
      vehicle.fuelType === "HYBRID" ||
      vehicle.fuelType === "CNG"
        ? vehicle.fuelType
        : "";

    setEditingVehicle(vehicle);
    setForm(
      syncVehicleRules({
        plate: vehicle.plate,
        model: vehicle.model,
        brand: vehicle.brand,
        year: String(vehicle.year),
        fipeValue:
          typeof vehicle.fipeValue === "number" && Number.isFinite(vehicle.fipeValue)
            ? vehicle.fipeValue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
        vehicleType: vehicle.vehicleType,
        category: vehicle.category || "CAR",
        axleCount:
          typeof (vehicle as Vehicle & { axleCount?: number | null }).axleCount ===
            "number" && (vehicle as Vehicle & { axleCount?: number | null }).axleCount
            ? String((vehicle as Vehicle & { axleCount?: number | null }).axleCount)
            : vehicle.category === "IMPLEMENT"
              ? "2"
              : "2",
        axleConfiguration:
          ((vehicle as Vehicle & { axleConfiguration?: AxleConfiguration })
            .axleConfiguration as AxleConfiguration) || "",
        chassis: vehicle.chassis || "",
        renavam: vehicle.renavam || "",
        acquisitionDate: vehicle.acquisitionDate?.slice(0, 10) || "",
        noAcquisitionDate: !vehicle.acquisitionDate,
        fuelType: safeFuelType,
        tankCapacity: String(vehicle.tankCapacity || ""),
        status: vehicle.status || "ACTIVE",
        consumptionMinKmPerLiter: currentRule ? String(currentRule.min) : "",
        consumptionMaxKmPerLiter: currentRule ? String(currentRule.max) : "",
        photoUrls: vehicle.photoUrls || [],
        documentUrls: vehicle.documentUrls || [],
        branchId: vehicle.branchId || "",
      }),
    );

    setPhotoFiles([]);
    setDocumentFiles([]);
    setCurrentProfilePhotoUrl(vehicle.profilePhotoUrl || vehicle.photoUrls?.[0] || "");
    setIsModalOpen(true);
    setFormErrorMessage("");
    setFieldErrors({});
  }

  function openLinkModal(vehicle: Vehicle) {
    setPageErrorMessage("");
    setLinkingVehicle(vehicle);
    setIsLinkModalOpen(true);
  }

  function closeLinkModal() {
    setIsLinkModalOpen(false);
    setLinkingVehicle(null);
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormErrorMessage("");
    setFieldErrors({});
    setPhotoFiles([]);
    setDocumentFiles([]);
    setCurrentProfilePhotoUrl("");
    setEditingVehicle(null);
    setForm({ ...initialForm });
  }

  async function handleLinkModalSaved() {
    if (hasSearched) {
      await loadData(appliedFilters);
    }
    closeLinkModal();
  }

  function handleOpenLinkedVehicle(vehicle: Vehicle) {
    const linkedVehicleLabel = String(
      (vehicle as Vehicle & { linkedVehicleLabel?: string }).linkedVehicleLabel || "",
    ).trim();

    if (!linkedVehicleLabel || linkedVehicleLabel === "Não vinculado") return;

    const [plate] = linkedVehicleLabel.split("•");

    applyFiltersAndSearch(
      {
        ...initialVehicleFilters,
        plate: plate?.trim() || linkedVehicleLabel,
      },
      "vehicles",
    );
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

  function handleOpenCompositionImplements(vehicle: Vehicle) {
    const firstImplementPlate = (vehicle.implements ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((item) => item?.implement?.plate?.trim())
      .find(Boolean);

    if (!firstImplementPlate) return;

    applyFiltersAndSearch(
      {
        ...initialVehicleFilters,
        category: "IMPLEMENT",
        plate: firstImplementPlate,
      },
      "implements",
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormErrorMessage("");
      setFieldErrors({});

      const uploadedDocumentUrls = await uploadVehicleFiles("document", documentFiles);
      const safeExistingPhotoUrls = sanitizeUrlList(form.photoUrls);
      const safeExistingDocumentUrls = sanitizeUrlList(form.documentUrls);
      const safeUploadedDocumentUrls = sanitizeUrlList(uploadedDocumentUrls);

      const payload = {
        plate: normalizePlate(form.plate),
        model: form.model.trim(),
        brand: form.brand.trim(),
        year: Number(form.year),
        fipeValue: parseCurrencyToNumber(form.fipeValue),
        vehicleType: form.vehicleType as "LIGHT" | "HEAVY",
        category: form.category as "CAR" | "TRUCK" | "UTILITY" | "IMPLEMENT",
        axleCount: Number(form.axleCount),
        axleConfiguration:
          form.category === "TRUCK"
            ? (form.axleConfiguration as "SINGLE" | "DUAL")
            : undefined,
        chassis: normalizeChassis(form.chassis),
        renavam: normalizeRenavam(form.renavam),
        acquisitionDate: form.noAcquisitionDate
          ? undefined
          : form.acquisitionDate || undefined,
        fuelType:
          form.category === "IMPLEMENT"
            ? undefined
            : (form.fuelType as
                | "GASOLINE"
                | "ETHANOL"
                | "DIESEL"
                | "ARLA32"
                | "FLEX"
                | "ELECTRIC"
                | "HYBRID"
                | "CNG"),
        tankCapacity:
          form.category === "IMPLEMENT"
            ? undefined
            : Number(form.tankCapacity),
        status: form.status,
        photoUrls: safeExistingPhotoUrls,
        documentUrls: Array.from(
          new Set([...safeExistingDocumentUrls, ...safeUploadedDocumentUrls]),
        ),
        branchId: branchFieldsEnabled
          ? editingVehicle
            ? isUuid(form.branchId)
              ? form.branchId
              : null
            : isUuid(form.branchId)
              ? form.branchId
              : undefined
          : editingVehicle
            ? null
            : undefined,
      };

      const nextFieldErrors: VehicleFieldErrors = {};

      if (!payload.plate) nextFieldErrors.plate = "Informe a placa.";
      if (!payload.model) nextFieldErrors.model = "Informe o modelo.";
      if (!payload.brand) nextFieldErrors.brand = "Informe a marca.";
      if (!form.vehicleType) nextFieldErrors.vehicleType = "Selecione o tipo de peso.";
      if (!form.category) nextFieldErrors.category = "Selecione o tipo de veículo.";

      if (form.fipeValue.trim() && payload.fipeValue === null) {
        nextFieldErrors.fipeValue = "Informe um valor FIPE válido.";
      }

      if (form.category !== "IMPLEMENT" && !form.fuelType) {
        nextFieldErrors.fuelType = "Selecione o combustível.";
      }

      if (
        form.category !== "IMPLEMENT" &&
        form.category &&
        form.fuelType &&
        !isFuelAllowedForCategory(form.category, form.fuelType)
      ) {
        nextFieldErrors.fuelType =
          "Combustível não permitido para o tipo de veículo.";
      }

      if (Number.isNaN(payload.axleCount) || payload.axleCount <= 0) {
        nextFieldErrors.axleCount = "Informe uma quantidade válida de eixos.";
      }

      if (payload.category === "CAR" && payload.axleCount !== 2) {
        nextFieldErrors.axleCount = "Carro deve ter 2 eixos.";
      }

      if (payload.category === "UTILITY" && payload.axleCount !== 2) {
        nextFieldErrors.axleCount = "Utilitário deve ter 2 eixos.";
      }

      if (payload.category === "TRUCK" && ![2, 3].includes(payload.axleCount)) {
        nextFieldErrors.axleCount = "Caminhão deve ter 2 ou 3 eixos.";
      }

      if (payload.category === "TRUCK" && !form.axleConfiguration) {
        nextFieldErrors.axleConfiguration =
          "Selecione se a configuração do caminhão é simples ou dupla.";
      }

      if (payload.category === "IMPLEMENT" && ![2, 3, 4].includes(payload.axleCount)) {
        nextFieldErrors.axleCount = "Implemento deve ter 2, 3 ou 4 eixos.";
      }

      if (!payload.chassis) nextFieldErrors.chassis = "Informe o chassi.";
      if (!payload.renavam) nextFieldErrors.renavam = "Informe o renavam.";

      if (Number.isNaN(payload.year) || payload.year < 1900) {
        nextFieldErrors.year = "Informe um ano válido.";
      }

      if (
        form.category !== "IMPLEMENT" &&
        (Number.isNaN(Number(form.tankCapacity)) || Number(form.tankCapacity) <= 0)
      ) {
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
          consumptionMinKmPerLiter:
            "Preencha mínimo e máximo ou deixe ambos em branco.",
          consumptionMaxKmPerLiter:
            "Preencha mínimo e máximo ou deixe ambos em branco.",
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
        ? await updateVehicle(editingVehicle.id, payload as never)
        : await createVehicle(payload as never);

      if (photoFiles[0]) {
        await uploadVehicleProfilePhoto(savedVehicle.id, photoFiles[0]);
      }

      const savedVehicleId = savedVehicle.id;
      const currentRules = readConsumptionRules();

      if (needsConsumptionRule && hasConsumptionInput) {
        currentRules[savedVehicleId] = {
          min: minConsumption,
          max: maxConsumption,
        };
      } else if (currentRules[savedVehicleId]) {
        delete currentRules[savedVehicleId];
      }

      saveConsumptionRules(currentRules);
      closeModal();
      if (hasSearched) {
        await loadData(appliedFilters);
      }
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { message?: string | string[] } };
      };

      const msg = error?.response?.data?.message || "Não foi possível salvar o veículo.";
      const message = Array.isArray(msg) ? msg.join(", ") : String(msg);
      const duplicatedFieldErrors: VehicleFieldErrors = {};
      const isDuplicateMessage = /(ja existe|já existe|cadastrado)/i.test(message);

      if (isDuplicateMessage && /placa/i.test(message)) {
        duplicatedFieldErrors.plate = "Placa ja cadastrada.";
      }
      if (isDuplicateMessage && /chassi/i.test(message)) {
        duplicatedFieldErrors.chassis = "Chassi ja cadastrada.";
      }
      if (isDuplicateMessage && /renavam/i.test(message)) {
        duplicatedFieldErrors.renavam = "Renavam ja cadastrada.";
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
      clearSelections();
      setVehicleToDelete(null);
      if (hasSearched) {
        await loadData(appliedFilters);
      }
    } finally {
      setDeletingVehicle(false);
    }
  }

  async function confirmDeleteSelectedVehicles() {
    if (allSelectedIds.length === 0) return;

    try {
      setDeletingSelectedVehicles(true);
      setPageErrorMessage("");

      const results = await Promise.allSettled(
        allSelectedIds.map((id) => deleteVehicle(id)),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === allSelectedIds.length
            ? "Não foi possível excluir os veículos selecionados."
            : `${failedCount} veículo(s) não puderam ser excluídos.`,
        );
      }

      clearSelections();
      setIsBulkDeleteModalOpen(false);
      if (hasSearched) {
        await loadData(appliedFilters);
      }
    } catch (error) {
      console.error("Erro ao excluir em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote.");
    } finally {
      setDeletingSelectedVehicles(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (loading) return;
            openCreate();
          }}
          disabled={loading}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition sm:w-auto ${
            loading
              ? "cursor-not-allowed bg-slate-400"
              : "cursor-pointer bg-orange-500 hover:bg-orange-600"
          }`}
        >
          + Cadastrar
        </button>
      </div>

      <div
        className={`grid gap-3 sm:grid-cols-2 ${
          activeTab === "vehicles" ? "xl:grid-cols-5" : "xl:grid-cols-3"
        }`}
      >
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totais
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Ativos
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Manutenção
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800">
            {summary.maintenance}
          </p>
        </div>

        {activeTab === "vehicles" ? (
          <>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Leves
              </p>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {summary.light}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Pesados
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-800">
                {summary.heavy}
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("vehicles")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "vehicles"
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Veículos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("implements")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "implements"
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Implementos
          </button>
        </div>
      </div>

      <VehiclesTablesSection
        activeTab={activeTab}
        loading={loading}
        hasSearched={hasSearched}
        branches={branchFieldsEnabled ? branches : []}
        filtersDraft={filtersDraft}
        onFiltersDraftChange={updateFilterDraft}
        onConsult={handleConsult}
        onClearFilters={handleClearFilters}
        sortBy={sortBy}
        sortDirection={sortDirection}
        toggleSort={toggleSort}
        getSortArrow={getSortArrow}
        filteredVehiclesOnlyLength={filteredVehicles.length}
        filteredImplementsOnlyLength={filteredImplements.length}
        paginatedVehiclesOnly={paginatedVehicles}
        paginatedImplementsOnly={paginatedImplements}
        currentVehiclesPage={currentVehiclesPage}
        vehiclesTotalPages={vehiclesTotalPages}
        setCurrentVehiclesPage={setCurrentVehiclesPage}
        currentImplementsPage={currentImplementsPage}
        implementsTotalPages={implementsTotalPages}
        setCurrentImplementsPage={setCurrentImplementsPage}
        tablePageSize={TABLE_PAGE_SIZE}
        selectedVehicleIds={allSelectedIds}
        selectedCount={allSelectedIds.length}
        onOpenBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        onOpenCompositionImplements={handleOpenCompositionImplements}
        onOpenLinkedVehicle={handleOpenLinkedVehicle}
        onOpenLinkModal={openLinkModal}
        allMainVehiclesOnPageSelected={allTopVehiclesOnPageSelected}
        allImplementsOnPageSelected={allImplementsOnPageSelected}
        toggleVehicleSelection={(vehicleId) => {
          const isImplement = paginatedImplements.some((item) => item.id === vehicleId);
          if (isImplement) {
            toggleImplementSelection(vehicleId);
            return;
          }
          toggleTopVehicleSelection(vehicleId);
        }}
        toggleSelectAllMainVehiclesOnPage={toggleSelectAllTopVehiclesOnPage}
        toggleSelectAllImplementsOnPage={toggleSelectAllImplementsOnPage}
        openEdit={openEdit}
        openHistory={openHistory}
        onDelete={onDelete}
        getCategoryLabel={getCategoryLabel}
        getVehicleTypeLabel={getVehicleTypeLabel}
        getStatusLabel={getStatusLabel}
        getVehicleAxleCount={getVehicleAxleCount}
        getVehicleAxleConfiguration={getVehicleAxleConfiguration}
      />

      <VehicleFormModal
        isOpen={isModalOpen}
        editingVehicleId={editingVehicle?.id}
        currentCompanyName={currentCompany?.name}
        branchFieldsEnabled={branchFieldsEnabled}
        branches={branches}
        form={form}
        setForm={setForm}
        fieldErrors={fieldErrors}
        clearFieldError={clearFieldError}
        getFieldClass={getFieldClass}
        formErrorMessage={formErrorMessage}
        saving={saving}
        onClose={closeModal}
        onSubmit={onSubmit}
        photoFiles={photoFiles}
        setPhotoFiles={setPhotoFiles}
        selectedProfilePhotoPreview={selectedProfilePhotoPreview}
        currentProfilePhotoUrl={currentProfilePhotoUrl}
        setFormErrorMessage={setFormErrorMessage}
      />

      {isLinkModalOpen && linkingVehicle ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <div className="relative mx-auto my-4 flex h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl md:my-6 md:h-auto md:max-h-[calc(100dvh-3rem)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Vincular implementos</h2>
                <p className="text-sm text-slate-500">
                  Gerencie os implementos vinculados ao veículo {linkingVehicle.plate}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLinkModal}
                className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <VehicleImplementsSection
                vehicle={linkingVehicle}
                onSaved={handleLinkModalSaved}
              />
            </div>
          </div>
        </div>
      ) : null}

      <VehicleHistoryModal
        isOpen={historyOpen}
        vehicle={historyVehicle}
        historyItems={historyItems}
        historyLoading={historyLoading}
        historyPage={historyPage}
        historyTotalPages={historyTotalPages}
        historyTotal={historyTotal}
        onClose={closeHistory}
        onPrevious={() => {
          if (historyVehicle && historyPage > 1) {
            void loadHistoryPage(historyVehicle.id, historyPage - 1);
          }
        }}
        onNext={() => {
          if (historyVehicle && historyPage < historyTotalPages) {
            void loadHistoryPage(historyVehicle.id, historyPage + 1);
          }
        }}
      />

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
        onConfirm={() => void confirmDeleteVehicle()}
      />

      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        title="Excluir veículos selecionados"
        description={`Deseja excluir ${allSelectedIds.length} veículo(s) selecionado(s)?`}
        loading={deletingSelectedVehicles}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={() => void confirmDeleteSelectedVehicles()}
      />
    </div>
  );
}

export default VehiclesPage;