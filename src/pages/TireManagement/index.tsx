import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createTire,
  createTireReading,
  deleteTire,
  getTireAlerts,
  getTires,
  updateTire,
} from "../../services/tires";
import type { Tire, TireAlert, TireStatus } from "../../types/tire";
import {
  BulkEditTiresModal,
  type BulkEditTiresForm,
} from "./components/BulkEditTiresModal";
import { CreateTireModal } from "./components/CreateTireModal";
import { EditTireModal } from "./components/EditTireModal";
import { TireDetailsModal } from "./components/TireDetailsModal";
import { TireFiltersCard } from "./components/TireFiltersCard";
import {
  TireInspectionModal,
  type TireInspectionForm,
} from "./components/TireInspectionModal";
import { TireTable } from "./components/TireTable";
import { TireVehicleCards } from "./components/TireVehicleCards";
import {
  compareValues,
  INITIAL_CREATE_FORM,
  parseOptionalNumber,
  parseSerialNumbers,
  tireConditionLabel,
  tireVehicleLabel,
  type CreateTireForm,
  type EditTireForm,
  type SortDirection,
  type SortField,
} from "./helpers";

export type LinkFilter = "ALL" | "LINKED" | "UNLINKED";

export type TireSearchFilters = {
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  status: "" | TireStatus;
  condition: string;
  vehicle: string;
  branch: string;
  purchaseDateStart: string;
  purchaseDateEnd: string;
  linkFilter: LinkFilter;
  alertFilter: "ALL" | "ONLY_ALERTS" | "WITHOUT_ALERTS";
};

const emptyBulkForm: BulkEditTiresForm = {
  brand: "",
  model: "",
  size: "",
  purchaseCost: "",
  currentKm: "",
  targetPressurePsi: "",
  status: "",
};

const emptyInspectionForm: TireInspectionForm = {
  vehicleId: "",
  tireIds: [],
  readingDate: new Date().toISOString().slice(0, 10),
  km: "",
  treadDepthMm: "",
  pressurePsi: "",
  condition: "",
  notes: "",
};

const initialSearchFilters: TireSearchFilters = {
  serialNumber: "",
  brand: "",
  model: "",
  size: "",
  status: "",
  condition: "",
  vehicle: "",
  branch: "",
  purchaseDateStart: "",
  purchaseDateEnd: "",
  linkFilter: "ALL",
  alertFilter: "ALL",
};

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dateToComparable(value?: string | null) {
  return String(value || "").slice(0, 10);
}

export function TireManagementPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [tires, setTires] = useState<Tire[]>([]);
  const [alerts, setAlerts] = useState<TireAlert[]>([]);

  const [selectedTireId, setSelectedTireId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [draftFilters, setDraftFilters] =
    useState<TireSearchFilters>(initialSearchFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<TireSearchFilters>(initialSearchFilters);

  const [sortField] = useState<SortField>("serialNumber");
  const [sortDirection] = useState<SortDirection>("asc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creatingTire, setCreatingTire] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateTireForm>(INITIAL_CREATE_FORM);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTire, setEditingTire] = useState(false);
  const [editForm, setEditForm] = useState<EditTireForm | null>(null);

  const [, setDeletingBulk] = useState(false);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkEditTiresForm>(emptyBulkForm);

  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [savingInspection, setSavingInspection] = useState(false);
  const [inspectionForm, setInspectionForm] =
    useState<TireInspectionForm>(emptyInspectionForm);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [tiresData, alertsData] = await Promise.all([
        getTires(),
        getTireAlerts(),
      ]);

      const normalizedTires = Array.isArray(tiresData)
        ? tiresData
        : Array.isArray((tiresData as any)?.items)
          ? (tiresData as any).items
          : Array.isArray((tiresData as any)?.data)
            ? (tiresData as any).data
            : [];

      setTires(normalizedTires);
      setAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts : []);
    } catch (error) {
      console.error("Erro ao carregar Gestão de Pneus:", error);
      setErrorMessage("Não foi possível carregar a Gestão de Pneus.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, appliedFilters]);

  const alertsBySerial = useMemo(() => {
    const map = new Map<string, TireAlert[]>();

    for (const alert of alerts) {
      const current = map.get(alert.serialNumber) || [];
      current.push(alert);
      map.set(alert.serialNumber, current);
    }

    return map;
  }, [alerts]);

  function getAlertsForTire(tireIdOrTire: string | Tire) {
    const serial =
      typeof tireIdOrTire === "string"
        ? tires.find((item) => item.id === tireIdOrTire)?.serialNumber || ""
        : tireIdOrTire.serialNumber;

    return alertsBySerial.get(serial) || [];
  }

  function hasAlertForTire(tire: Tire) {
    return getAlertsForTire(tire).length > 0;
  }

  function matchesAppliedFilters(tire: Tire) {
    const serialNumber = normalizeText(tire.serialNumber);
    const brand = normalizeText(tire.brand);
    const model = normalizeText(tire.model);
    const size = normalizeText(tire.size);
    const status = tire.status || "";
    const condition = normalizeText(tireConditionLabel(tire));
    const vehicle = normalizeText(tireVehicleLabel(tire));
    const branch = normalizeText(tire.vehicle?.branch?.name);
    const purchaseDate = dateToComparable(tire.purchaseDate);
    const hasAlert = hasAlertForTire(tire);
    const isLinked = Boolean(tire.vehicleId);

    if (
      normalizeText(appliedFilters.serialNumber) &&
      !serialNumber.includes(normalizeText(appliedFilters.serialNumber))
    ) {
      return false;
    }

    if (
      normalizeText(appliedFilters.brand) &&
      !brand.includes(normalizeText(appliedFilters.brand))
    ) {
      return false;
    }

    if (
      normalizeText(appliedFilters.model) &&
      !model.includes(normalizeText(appliedFilters.model))
    ) {
      return false;
    }

    if (
      normalizeText(appliedFilters.size) &&
      !size.includes(normalizeText(appliedFilters.size))
    ) {
      return false;
    }

    if (appliedFilters.status && status !== appliedFilters.status) {
      return false;
    }

    if (
      normalizeText(appliedFilters.condition) &&
      !condition.includes(normalizeText(appliedFilters.condition))
    ) {
      return false;
    }

    if (
      normalizeText(appliedFilters.vehicle) &&
      !vehicle.includes(normalizeText(appliedFilters.vehicle))
    ) {
      return false;
    }

    if (
      normalizeText(appliedFilters.branch) &&
      !branch.includes(normalizeText(appliedFilters.branch))
    ) {
      return false;
    }

    if (
      appliedFilters.purchaseDateStart &&
      (!purchaseDate || purchaseDate < appliedFilters.purchaseDateStart)
    ) {
      return false;
    }

    if (
      appliedFilters.purchaseDateEnd &&
      (!purchaseDate || purchaseDate > appliedFilters.purchaseDateEnd)
    ) {
      return false;
    }

    if (appliedFilters.linkFilter === "LINKED" && !isLinked) return false;
    if (appliedFilters.linkFilter === "UNLINKED" && isLinked) return false;

    if (appliedFilters.alertFilter === "ONLY_ALERTS" && !hasAlert) return false;
    if (appliedFilters.alertFilter === "WITHOUT_ALERTS" && hasAlert) return false;

    return true;
  }

  const filteredTires = useMemo(() => {
    return tires.filter((tire) => matchesAppliedFilters(tire));
  }, [tires, appliedFilters, alertsBySerial]);

  const sortedTires = useMemo(() => {
    const items = [...filteredTires];

    items.sort((a, b) => {
      let result = 0;

      if (sortField === "brand") {
        result = compareValues(a.brand, b.brand);
      } else if (sortField === "model") {
        result = compareValues(a.model, b.model);
      } else if (sortField === "size") {
        result = compareValues(a.size, b.size);
      } else if (sortField === "status") {
        result = compareValues(a.status, b.status);
      } else if (sortField === "condition") {
        result = compareValues(tireConditionLabel(a), tireConditionLabel(b));
      } else if (sortField === "vehicle") {
        result = compareValues(tireVehicleLabel(a), tireVehicleLabel(b));
      } else if (sortField === "currentKm") {
        result = compareValues(Number(a.currentKm || 0), Number(b.currentKm || 0));
      } else if (sortField === "axlePosition") {
        result = compareValues(
          `${a.axlePosition || ""} ${a.wheelPosition || ""}`,
          `${b.axlePosition || ""} ${b.wheelPosition || ""}`,
        );
      } else {
        result = compareValues(a.serialNumber, b.serialNumber);
      }

      return sortDirection === "asc" ? result : -result;
    });

    return items;
  }, [filteredTires, sortField, sortDirection]);

  const vehicleCards = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        plate: string;
        label: string;
        branchName: string;
        tireCount: number;
        installedCount: number;
        maintenanceCount: number;
        alertCount: number;
      }
    >();

    for (const tire of sortedTires) {
      const vehicle = tire.vehicle;
      if (!vehicle?.id) continue;

      const current = grouped.get(vehicle.id) ?? {
        id: vehicle.id,
        plate: vehicle.plate || "Sem placa",
        label:
          [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim() ||
          "Veículo",
        branchName: vehicle.branch?.name || "",
        tireCount: 0,
        installedCount: 0,
        maintenanceCount: 0,
        alertCount: 0,
      };

      current.tireCount += 1;

      if (tire.status === "INSTALLED") current.installedCount += 1;
      if (tire.status === "MAINTENANCE") current.maintenanceCount += 1;
      current.alertCount += getAlertsForTire(tire).length;

      grouped.set(vehicle.id, current);
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.tireCount !== a.tireCount) return b.tireCount - a.tireCount;
      return a.plate.localeCompare(b.plate, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [sortedTires, alertsBySerial]);

  const totalInvestment = useMemo(() => {
    return filteredTires.reduce(
      (sum, tire) => sum + Number(tire.purchaseCost || 0),
      0,
    );
  }, [filteredTires]);

  const selectedTire = useMemo(() => {
    return tires.find((item) => item.id === selectedTireId) || null;
  }, [tires, selectedTireId]);

  const totalPages = Math.max(1, Math.ceil(sortedTires.length / pageSize));

  const paginatedTires = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTires.slice(start, start + pageSize);
  }, [sortedTires, currentPage, pageSize]);

  function updateDraftFilter<K extends keyof TireSearchFilters>(
    field: K,
    value: TireSearchFilters[K],
  ) {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  }

  function handleSearch() {
    setAppliedFilters(draftFilters);
    setSelectedIds(new Set());
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setDraftFilters(initialSearchFilters);
    setAppliedFilters(initialSearchFilters);
    setSelectedIds(new Set());
    setCurrentPage(1);
  }

  function openDetailsModal(tire: Tire) {
    setSelectedTireId(tire.id);
    setIsDetailsModalOpen(true);
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllPage() {
    const allSelected =
      paginatedTires.length > 0 &&
      paginatedTires.every((tire) => selectedIds.has(tire.id));

    setSelectedIds((current) => {
      const next = new Set(current);

      if (allSelected) {
        paginatedTires.forEach((tire) => next.delete(tire.id));
      } else {
        paginatedTires.forEach((tire) => next.add(tire.id));
      }

      return next;
    });
  }

  function openEditModal(tire: Tire) {
    setEditForm({
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
    });
    setSelectedTireId(tire.id);
    setIsEditModalOpen(true);
  }

  async function handleCreateTire() {
    const serialNumbers = parseSerialNumbers(createForm.serialNumber);

    if (serialNumbers.length === 0) {
      setErrorMessage("Informe pelo menos um número de série.");
      return;
    }

    try {
      setCreatingTire(true);
      setErrorMessage("");

      await Promise.all(
        serialNumbers.map((serialNumber) =>
          createTire({
            serialNumber,
            brand: createForm.brand.trim(),
            model: createForm.model.trim(),
            size: createForm.size.trim(),
            rim: parseOptionalNumber(createForm.rim),
            purchaseDate: createForm.purchaseDate || undefined,
            purchaseCost: parseOptionalNumber(createForm.purchaseCost),
            status: createForm.status,
            currentKm: parseOptionalNumber(createForm.currentKm),
            currentTreadDepthMm: parseOptionalNumber(
              createForm.currentTreadDepthMm,
            ),
            currentPressurePsi: parseOptionalNumber(
              createForm.currentPressurePsi,
            ),
            targetPressurePsi: parseOptionalNumber(
              createForm.targetPressurePsi,
            ),
            minTreadDepthMm: parseOptionalNumber(createForm.minTreadDepthMm),
            installedAt: createForm.installedAt || undefined,
            notes: createForm.notes.trim() || undefined,
            axlePosition:
              createForm.status === "IN_STOCK" ? "Estoque" : undefined,
            wheelPosition:
              createForm.status === "IN_STOCK" ? "Estoque" : undefined,
          }),
        ),
      );

      setIsCreateModalOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      await loadData();
    } catch (error) {
      console.error("Erro ao cadastrar pneu:", error);
      setErrorMessage("Não foi possível cadastrar os pneus.");
    } finally {
      setCreatingTire(false);
    }
  }

  async function handleSaveEdit() {
    if (!editForm || !selectedTireId) return;

    try {
      setEditingTire(true);
      setErrorMessage("");

      await updateTire(selectedTireId, {
        serialNumber: editForm.serialNumber.trim(),
        brand: editForm.brand.trim(),
        model: editForm.model.trim(),
        size: editForm.size.trim(),
        rim: parseOptionalNumber(editForm.rim),
        purchaseDate: editForm.purchaseDate || undefined,
        purchaseCost: parseOptionalNumber(editForm.purchaseCost),
        status: editForm.status,
        currentKm: parseOptionalNumber(editForm.currentKm),
        currentTreadDepthMm: parseOptionalNumber(editForm.currentTreadDepthMm),
        currentPressurePsi: parseOptionalNumber(editForm.currentPressurePsi),
        targetPressurePsi: parseOptionalNumber(editForm.targetPressurePsi),
        minTreadDepthMm: parseOptionalNumber(editForm.minTreadDepthMm),
        installedAt: editForm.installedAt || undefined,
        notes: editForm.notes.trim() || undefined,
      });

      setIsEditModalOpen(false);
      setEditForm(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao editar pneu:", error);
      setErrorMessage("Não foi possível salvar a edição do pneu.");
    } finally {
      setEditingTire(false);
    }
  }

  async function handleBulkEdit() {
    if (selectedIds.size === 0) return;

    const hasAnyField = Object.values(bulkForm).some(
      (value) => String(value).trim() !== "",
    );

    if (!hasAnyField) {
      setErrorMessage("Preencha pelo menos um campo para edição em lote.");
      return;
    }

    try {
      setBulkSaving(true);
      setErrorMessage("");

      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateTire(id, {
            ...(bulkForm.brand.trim() ? { brand: bulkForm.brand.trim() } : {}),
            ...(bulkForm.model.trim() ? { model: bulkForm.model.trim() } : {}),
            ...(bulkForm.size.trim() ? { size: bulkForm.size.trim() } : {}),
            ...(bulkForm.purchaseCost.trim()
              ? { purchaseCost: parseOptionalNumber(bulkForm.purchaseCost) }
              : {}),
            ...(bulkForm.currentKm.trim()
              ? { currentKm: parseOptionalNumber(bulkForm.currentKm) }
              : {}),
            ...(bulkForm.targetPressurePsi.trim()
              ? {
                  targetPressurePsi: parseOptionalNumber(
                    bulkForm.targetPressurePsi,
                  ),
                }
              : {}),
            ...(bulkForm.status ? { status: bulkForm.status } : {}),
          }),
        ),
      );

      setBulkForm(emptyBulkForm);
      setIsBulkOpen(false);
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error("Erro ao editar pneus em lote:", error);
      setErrorMessage("Não foi possível editar os pneus selecionados.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Deseja excluir ${selectedIds.size} pneu(s) selecionado(s)?`,
    );

    if (!confirmed) return;

    try {
      setDeletingBulk(true);
      setErrorMessage("");

      await Promise.all(Array.from(selectedIds).map((id) => deleteTire(id)));

      setSelectedIds(new Set());
      if (selectedTireId && selectedIds.has(selectedTireId)) {
        setSelectedTireId("");
      }

      await loadData();
    } catch (error) {
      console.error("Erro ao excluir pneus em lote:", error);
      setErrorMessage("Não foi possível excluir os pneus selecionados.");
    } finally {
      setDeletingBulk(false);
    }
  }

  async function handleCreateInspection() {
    const selectedTires = tires.filter((tire) =>
      inspectionForm.tireIds.includes(tire.id),
    );

    if (selectedTires.length === 0) {
      setErrorMessage("Selecione ao menos um pneu para registrar a aferição.");
      return;
    }

    if (!inspectionForm.readingDate) {
      setErrorMessage("Informe a data da aferição.");
      return;
    }

    if (!inspectionForm.km.trim()) {
      setErrorMessage("Informe o KM atual.");
      return;
    }

    if (!inspectionForm.treadDepthMm.trim()) {
      setErrorMessage("Informe o sulco atual em mm.");
      return;
    }

    if (!inspectionForm.pressurePsi.trim()) {
      setErrorMessage("Informe o PSI atual.");
      return;
    }

    try {
      setSavingInspection(true);
      setErrorMessage("");

      await Promise.all(
        selectedTires.map((selectedTire) =>
          createTireReading(selectedTire.id, {
            readingDate: new Date(
              `${inspectionForm.readingDate}T12:00:00`,
            ).toISOString(),
            km: Number(inspectionForm.km),
            treadDepthMm: Number(inspectionForm.treadDepthMm),
            pressurePsi: Number(inspectionForm.pressurePsi),
            condition: inspectionForm.condition.trim() || undefined,
            notes: inspectionForm.notes.trim() || undefined,
            vehicleId: selectedTire.vehicleId || undefined,
          }),
        ),
      );

      setInspectionForm(emptyInspectionForm);
      setIsInspectionModalOpen(false);
      await loadData();
    } catch (error) {
      console.error("Erro ao registrar aferição de pneu:", error);
      setErrorMessage("Não foi possível registrar a aferição dos pneus.");
    } finally {
      setSavingInspection(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Carregando Gestão de Pneus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Gestão de Pneus</h1>
          <p className="text-sm text-slate-500">
            Cadastre, visualize, edite e organize os pneus da frota.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => navigate("/tire-management/link")}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 sm:w-auto"
          >
            Vincular pneus
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setInspectionForm(emptyInspectionForm);
              setIsInspectionModalOpen(true);
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 sm:w-auto"
          >
            Aferir pneus
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
          >
            + Cadastrar pneu
          </button>
        </div>
      </div>

      {errorMessage ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </section>
      ) : null}

      <div className="space-y-4">
        <TireVehicleCards
          vehicles={vehicleCards}
          selectedVehicleId={null}
          onSelectVehicle={(vehicleId) => {
            navigate(`/tire-management/link?vehicleId=${vehicleId}`);
          }}
        />

        <TireFiltersCard
          totalTires={filteredTires.length}
          totalInvestment={totalInvestment}
        />

        <TireTable
          tires={paginatedTires}
          draftFilters={draftFilters}
          onDraftFilterChange={updateDraftFilter}
          onSearch={handleSearch}
          onClearFilters={handleClearFilters}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onPreviousPage={() =>
            setCurrentPage((current) => Math.max(1, current - 1))
          }
          onNextPage={() =>
            setCurrentPage((current) => Math.min(totalPages, current + 1))
          }
          selectedIds={selectedIds}
          onToggleAll={toggleSelectAllPage}
          onToggleOne={toggleSelectOne}
          onOpenDetails={openDetailsModal}
          onOpenEdit={openEditModal}
          onOpenBulkEdit={() => setIsBulkOpen(true)}
          onDeleteSelected={() => void handleBulkDelete()}
          getAlertsForTire={(tireId) => getAlertsForTire(tireId)}
        />
      </div>

      <TireDetailsModal
        open={isDetailsModalOpen}
        tire={selectedTire}
        alerts={selectedTire ? getAlertsForTire(selectedTire) : []}
        onClose={() => setIsDetailsModalOpen(false)}
      />

      <CreateTireModal
        open={isCreateModalOpen}
        form={createForm}
        creating={creatingTire}
        msgError={errorMessage || null}
        onClose={() => setIsCreateModalOpen(false)}
        onChange={(updater) => setCreateForm((current) => updater(current))}
        onSubmit={() => void handleCreateTire()}
      />

      <EditTireModal
        open={isEditModalOpen}
        form={editForm}
        editing={editingTire}
        msgError={errorMessage || null}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm(null);
        }}
        onChange={(updater) =>
          setEditForm((current) => (current ? updater(current) : current))
        }
        onSubmit={() => void handleSaveEdit()}
      />

      <BulkEditTiresModal
        open={isBulkOpen}
        selectedCount={selectedIds.size}
        form={bulkForm}
        saving={bulkSaving}
        onClose={() => setIsBulkOpen(false)}
        onChange={(updater) => setBulkForm((current) => updater(current))}
        onSubmit={() => void handleBulkEdit()}
      />

      <TireInspectionModal
        open={isInspectionModalOpen}
        tires={tires}
        form={inspectionForm}
        saving={savingInspection}
        errorMessage={errorMessage || null}
        onClose={() => {
          setIsInspectionModalOpen(false);
          setInspectionForm(emptyInspectionForm);
        }}
        onChange={(updater) => setInspectionForm((current) => updater(current))}
        onSubmit={() => void handleCreateInspection()}
      />
    </div>
  );
}