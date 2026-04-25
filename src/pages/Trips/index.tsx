import { useEffect, useMemo, useRef, useState } from "react";
import { createTrip, deleteTrip, getTrips, updateTrip } from "../../services/trips";
import { getVehicles } from "../../services/vehicles";
import { getDrivers } from "../../services/drivers";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import type { Trip, TripStatus } from "../../types/trip";
import type { Vehicle } from "../../types/vehicle";
import type { Driver } from "../../types/driver";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import { TripsTablesSection } from "./TripsTablesSection";

type TripFormData = {
  vehicleId: string;
  driverId: string;
  origin: string;
  destination: string;
  reason: string;
  departureKm: string;
  returnKm: string;
  departureAt: string;
  returnAt: string;
  status: TripStatus;
  notes: string;
};

type TripFieldErrors = Partial<Record<keyof TripFormData, string>>;

export type TripSortBy =
  | "vehicle"
  | "driver"
  | "origin"
  | "departureAt"
  | "returnAt"
  | "kmDriven"
  | "status";

type TripFilters = {
  vehicleId: string;
  driverId: string;
  status: string;
  text: string;
  startDate: string;
  endDate: string;
};

type SelectOption = {
  id: string;
  label: string;
};

const initialForm: TripFormData = {
  vehicleId: "",
  driverId: "",
  origin: "",
  destination: "",
  reason: "",
  departureKm: "",
  returnKm: "",
  departureAt: "",
  returnAt: "",
  status: "OPEN",
  notes: "",
};

const initialFilters: TripFilters = {
  vehicleId: "",
  driverId: "",
  status: "ALL",
  text: "",
  startDate: "",
  endDate: "",
};

const TABLE_PAGE_SIZE = 10;

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
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

function statusLabel(status: TripStatus) {
  if (status === "OPEN") return "Aberta";
  if (status === "COMPLETED") return "Concluída";
  return "Cancelada";
}

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  error,
  disabled = false,
  openOnClick = true,
  keepOpenOnSelect = true,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  openOnClick?: boolean;
  keepOpenOnSelect?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return options
      .filter((item) => {
        if (selectedIds.includes(item.id)) return false;
        if (!normalized && !openOnClick) return false;
        if (!normalized) return true;
        return item.label.toLowerCase().includes(normalized);
      })
      .slice(0, 10);
  }, [options, selectedIds, query, openOnClick]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;

    onChange([...selectedIds, id]);
    setQuery("");

    if (keepOpenOnSelect) {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setOpen(false);
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;

      const target = event.target as Node;
      if (!containerRef.current.contains(target)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>

      <div ref={containerRef} className="relative">
        <div
          className={`min-h-[44px] w-full rounded-xl border bg-white px-2.5 py-2 text-sm focus-within:ring-2 ${error
            ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-200"
            : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
            }`}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            if (openOnClick) setOpen(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex cursor-default items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                onClick={(event) => event.stopPropagation()}
              >
                {item.label}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    if (!disabled) {
                      onChange(selectedIds.filter((id) => id !== item.id));
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }
                  }}
                  className={`text-slate-500 ${disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:text-red-600"
                    }`}
                >
                  ×
                </button>
              </span>
            ))}

            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                if (disabled) return;

                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setOpen(Boolean(nextQuery.trim()) || openOnClick);
              }}
              onFocus={() => {
                if (disabled) return;
                if (openOnClick || query.trim()) setOpen(true);
              }}
              placeholder={
                selectedOptions.length === 0 ? placeholder : "Digite para buscar..."
              }
              disabled={disabled}
              className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {open && !disabled && filteredOptions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  addItem(option.id);
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
export function TripsPage() {
  const { selectedBranchId } = useBranch();
  const { currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TripFieldErrors>({});
  const [draftFilters, setDraftFilters] = useState<TripFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<TripFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<TripSortBy>("departureAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [form, setForm] = useState<TripFormData>(initialForm);
  const [quickStatusTripId, setQuickStatusTripId] = useState<string | null>(null);

  async function loadPageData() {
    try {
      setLoading(true);
      setPageErrorMessage("");

      const [vehiclesData, driversData, tripsData] = await Promise.all([
        getVehicles(),
        getDrivers(),
        getTrips(),
      ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      setPageErrorMessage("Não foi possível carregar as viagens.");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(nextFilters: TripFilters = draftFilters) {
    try {
      setSearchLoading(true);
      setPageErrorMessage("");

      const tripsData = await getTrips();

      setTrips(Array.isArray(tripsData) ? tripsData : []);
      setAppliedFilters({ ...nextFilters });
      setCurrentPage(1);
      setSelectedTripIds([]);
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      setTrips([]);
      setPageErrorMessage("Não foi possível consultar as viagens.");
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, []);

  const baseVehicles = useMemo(() => {
    let filtered = vehicles;

    if (selectedBranchId) {
      filtered = filtered.filter((item) => item.branchId === selectedBranchId);
    }

    filtered = filtered.filter((item) => item.category !== "IMPLEMENT");

    return [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );
  }, [vehicles, selectedBranchId]);

  const vehicleFilterOptions = useMemo<SelectOption[]>(
    () =>
      baseVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: formatVehicleLabel(vehicle),
      })),
    [baseVehicles],
  );

  const availableVehicles = useMemo(() => {
    return baseVehicles.filter(
      (item) => item.status === "ACTIVE" || item.id === form.vehicleId,
    );
  }, [baseVehicles, form.vehicleId]);

  const filterDriverOptions = useMemo(() => {
    let filtered = drivers;
    const selectedVehicleIds = splitCsv(draftFilters.vehicleId);

    if (selectedBranchId) {
      filtered = filtered.filter(
        (driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId,
      );
    }

    if (selectedVehicleIds.length) {
      filtered = filtered.filter(
        (driver) => driver.vehicleId && selectedVehicleIds.includes(driver.vehicleId),
      );
    }

    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [drivers, selectedBranchId, draftFilters.vehicleId]);

  const driverFilterOptions = useMemo<SelectOption[]>(
    () =>
      filterDriverOptions.map((driver) => ({
        id: driver.id,
        label: driver.name,
      })),
    [filterDriverOptions],
  );

  const statusFilterOptions: SelectOption[] = [
    { id: "OPEN", label: "Aberta" },
    { id: "COMPLETED", label: "Concluída" },
    { id: "CANCELLED", label: "Cancelada" },
  ];

  const availableDrivers = useMemo(() => {
    let filtered = drivers;

    if (selectedBranchId) {
      filtered = filtered.filter(
        (driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId,
      );
    }

    filtered = filtered.filter(
      (item) => item.status === "ACTIVE" || item.id === form.driverId,
    );

    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [drivers, selectedBranchId, form.driverId]);

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles, trips }),
    [vehicles, trips],
  );

  const filteredTrips = useMemo(() => {
    let filtered = trips;

    if (selectedBranchId) {
      filtered = filtered.filter((trip) => trip.vehicle?.branchId === selectedBranchId);
    }

    const vehicleIds = splitCsv(appliedFilters.vehicleId);
    const driverIds = splitCsv(appliedFilters.driverId);
    const statuses =
      appliedFilters.status === "ALL" ? [] : splitCsv(appliedFilters.status);

    if (vehicleIds.length) {
      filtered = filtered.filter((trip) => vehicleIds.includes(trip.vehicleId));
    }

    if (driverIds.length) {
      filtered = filtered.filter(
        (trip) => trip.driverId && driverIds.includes(trip.driverId),
      );
    }

    if (statuses.length) {
      filtered = filtered.filter((trip) => statuses.includes(trip.status));
    }

    if (appliedFilters.startDate) {
      const start = parseLocalDate(appliedFilters.startDate)?.getTime() || 0;

      filtered = filtered.filter(
        (trip) => (parseLocalDate(trip.departureAt)?.getTime() || 0) >= start,
      );
    }

    if (appliedFilters.endDate) {
      const endDate = parseLocalDate(appliedFilters.endDate);
      const end = endDate
        ? new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          23,
          59,
          59,
          999,
        ).getTime()
        : 0;

      filtered = filtered.filter(
        (trip) => (parseLocalDate(trip.departureAt)?.getTime() || 0) <= end,
      );
    }

    if (appliedFilters.text.trim()) {
      const term = appliedFilters.text.trim().toLowerCase();

      filtered = filtered.filter((trip) =>
        [
          trip.vehicle ? formatVehicleLabel(trip.vehicle) : "",
          trip.vehicle?.plate || "",
          trip.driver?.name || "",
          trip.origin,
          trip.destination,
          trip.reason || "",
          statusLabel(trip.status),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === "vehicle") {
        const av = a.vehicle ? formatVehicleLabel(a.vehicle) : "";
        const bv = b.vehicle ? formatVehicleLabel(b.vehicle) : "";

        return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * direction;
      }

      if (sortBy === "driver") {
        return (
          (a.driver?.name || "").localeCompare(b.driver?.name || "", "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }

      if (sortBy === "origin") {
        return (
          `${a.origin} ${a.destination}`.localeCompare(
            `${b.origin} ${b.destination}`,
            "pt-BR",
            { sensitivity: "base" },
          ) * direction
        );
      }

      if (sortBy === "departureAt") {
        return (
          ((parseLocalDate(a.departureAt)?.getTime() || 0) -
            (parseLocalDate(b.departureAt)?.getTime() || 0)) *
          direction
        );
      }

      if (sortBy === "returnAt") {
        return (
          ((parseLocalDate(a.returnAt)?.getTime() || 0) -
            (parseLocalDate(b.returnAt)?.getTime() || 0)) *
          direction
        );
      }

      if (sortBy === "status") {
        return (
          statusLabel(a.status).localeCompare(statusLabel(b.status), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }

      const aKmDriven = Math.max((a.returnKm || 0) - (a.departureKm || 0), 0);
      const bKmDriven = Math.max((b.returnKm || 0) - (b.departureKm || 0), 0);

      return (aKmDriven - bKmDriven) * direction;
    });
  }, [trips, selectedBranchId, appliedFilters, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTrips.length / TABLE_PAGE_SIZE)),
    [filteredTrips.length],
  );

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredTrips.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTrips, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, sortBy, sortDirection, selectedBranchId]);

  useEffect(() => {
    setSelectedTripIds([]);
  }, [appliedFilters, sortBy, sortDirection, selectedBranchId, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const total = filteredTrips.length;
    const open = filteredTrips.filter((trip) => trip.status === "OPEN").length;
    const completed = filteredTrips.filter(
      (trip) => trip.status === "COMPLETED",
    ).length;
    const cancelled = filteredTrips.filter(
      (trip) => trip.status === "CANCELLED",
    ).length;
    const totalKm = filteredTrips.reduce(
      (sum, trip) => sum + Math.max((trip.returnKm || 0) - trip.departureKm, 0),
      0,
    );

    return { total, open, completed, cancelled, totalKm };
  }, [filteredTrips]);

  function getSortArrow(column: TripSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function handleSort(column: TripSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection(column === "departureAt" ? "desc" : "asc");
  }

  function updateDraftFilter<K extends keyof TripFilters>(
    field: K,
    value: TripFilters[K],
  ) {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleSearchClick() {
    void runSearch(draftFilters);
  }

  function handleClearFilters() {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setCurrentPage(1);
    setSelectedTripIds([]);
  }

  function openCreateModal() {
    setEditingTrip(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(trip: Trip) {
    setEditingTrip(trip);
    setForm({
      vehicleId: trip.vehicleId,
      driverId: trip.driverId || "",
      origin: trip.origin,
      destination: trip.destination,
      reason: trip.reason || "",
      departureKm: String(trip.departureKm || ""),
      returnKm:
        trip.returnKm !== null && trip.returnKm !== undefined
          ? String(trip.returnKm)
          : "",
      departureAt: String(trip.departureAt).slice(0, 10),
      returnAt: trip.returnAt ? String(trip.returnAt).slice(0, 10) : "",
      status: trip.status,
      notes: trip.notes || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEditSelectedTrip() {
    if (selectedTripIds.length !== 1) return;

    const selectedTrip = trips.find((trip) => trip.id === selectedTripIds[0]);
    if (!selectedTrip) return;

    openEditModal(selectedTrip);
  }

  function closeModal() {
    setEditingTrip(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof TripFormData>(
    field: K,
    value: TripFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof TripFormData) {
    if (fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }

    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  function handleVehicleChange(vehicleId: string) {
    if (editingTrip) {
      handleChange("vehicleId", vehicleId);
      return;
    }

    const latestKm = latestKmByVehicle.get(vehicleId);
    const suggestedDriver = drivers.find(
      (driver) =>
        driver.vehicleId === vehicleId &&
        (driver.status === "ACTIVE" || driver.id === form.driverId),
    );

    setForm((prev) => ({
      ...prev,
      vehicleId,
      driverId: suggestedDriver?.id || "",
      departureKm: typeof latestKm === "number" ? String(latestKm) : "",
      returnKm: "",
    }));
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFieldErrors({});

      const payload = {
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        reason: form.reason.trim() || undefined,
        departureKm: Number(form.departureKm),
        returnKm: form.returnKm ? Number(form.returnKm) : undefined,
        departureAt: form.departureAt,
        returnAt: form.returnAt || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };

      const nextErrors: TripFieldErrors = {};

      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
      if (!payload.origin) nextErrors.origin = "Informe a origem.";
      if (!payload.destination) nextErrors.destination = "Informe o destino.";
      if (!payload.departureAt) {
        nextErrors.departureAt = "Informe a data de saída.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      if (Number.isNaN(payload.departureKm) || payload.departureKm < 0) {
        setFieldErrors((prev) => ({
          ...prev,
          departureKm: "KM de saída inválido.",
        }));
        return;
      }

      if (
        payload.returnKm !== undefined &&
        (Number.isNaN(payload.returnKm) || payload.returnKm < payload.departureKm)
      ) {
        setFieldErrors((prev) => ({
          ...prev,
          returnKm: "KM de retorno deve ser maior ou igual ao KM de saída.",
        }));
        return;
      }

      if (editingTrip) {
        await updateTrip(editingTrip.id, payload);
      } else {
        await createTrip(payload);
      }

      closeModal();
      await loadPageData();
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      const apiText = Array.isArray(apiMessage)
        ? apiMessage.join(", ")
        : String(apiMessage || "Não foi possível salvar a viagem.");

      setFieldErrors((prev) => ({ ...prev, origin: apiText }));
    } finally {
      setSaving(false);
    }
  }

  async function confirmBulkDeleteTrips() {
    if (selectedTripIds.length === 0) return;

    try {
      setDeletingTrip(true);

      const results = await Promise.allSettled(
        selectedTripIds.map((id) => deleteTrip(id)),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === selectedTripIds.length
            ? "Não foi possível excluir as viagens selecionadas."
            : `${failedCount} viagem(ns) não puderam ser excluídas.`,
        );
      } else {
        setPageErrorMessage("");
      }

      setBulkDeleteOpen(false);
      setSelectedTripIds([]);
      await loadPageData();
    } catch (error) {
      console.error("Erro ao excluir viagens em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote das viagens.");
    } finally {
      setDeletingTrip(false);
    }
  }

  async function handleQuickTripStatusChange(trip: Trip, status: TripStatus) {
    try {
      setQuickStatusTripId(trip.id);

      await updateTrip(trip.id, {
        vehicleId: trip.vehicleId,
        driverId: trip.driverId || null,
        origin: trip.origin,
        destination: trip.destination,
        reason: trip.reason || undefined,
        departureKm: trip.departureKm,
        returnKm: trip.returnKm || undefined,
        departureAt: String(trip.departureAt).slice(0, 10),
        returnAt: trip.returnAt ? String(trip.returnAt).slice(0, 10) : undefined,
        status,
        notes: trip.notes || undefined,
      });

      await runSearch(appliedFilters);
    } catch (error) {
      console.error("Erro ao atualizar status da viagem:", error);
      setPageErrorMessage("Não foi possível atualizar o status da viagem.");
    } finally {
      setQuickStatusTripId(null);
    }
  }

  const allTripsOnPageSelected =
    paginatedTrips.length > 0 &&
    paginatedTrips.every((item) => selectedTripIds.includes(item.id));

  useEffect(() => {
    if (!pageErrorMessage) return;

    const normalized = pageErrorMessage
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const tone = /sucesso|concluid|excluid/.test(normalized) ? "success" : "error";

    showToast({
      tone,
      title: tone === "success" ? "Operação concluída" : "Atenção",
      message: pageErrorMessage,
    });

    setPageErrorMessage("");
  }, [pageErrorMessage, showToast]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Viagens</h1>
          <p className="text-sm text-slate-500">
            Controle completo de uso da frota por veículo e motorista.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
        >
          + Registrar viagem
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totais
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Abertas
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.open}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Concluídas
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {summary.completed}
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Canceladas
          </p>
          <p className="mt-1 text-2xl font-bold text-red-800">
            {summary.cancelled}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            KM Rodados
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {summary.totalKm.toLocaleString("pt-BR")} km
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm text-slate-700">
            <span className="font-medium text-slate-700">Empresa</span>
            <input
              value={currentCompany?.name || "Empresa não selecionada"}
              disabled
              className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
            />
          </label>

          <MultiSelectField
            label="Veículo"
            options={vehicleFilterOptions}
            selectedIds={splitCsv(draftFilters.vehicleId)}
            onChange={(value) => updateDraftFilter("vehicleId", joinCsv(value))}
            placeholder="Selecione um ou mais veículos"
          />

          <MultiSelectField
            label="Motorista"
            options={driverFilterOptions}
            selectedIds={splitCsv(draftFilters.driverId)}
            onChange={(value) => updateDraftFilter("driverId", joinCsv(value))}
            placeholder="Selecione um ou mais motoristas"
          />

          <MultiSelectField
            label="Status"
            options={statusFilterOptions}
            selectedIds={
              draftFilters.status === "ALL" ? [] : splitCsv(draftFilters.status)
            }
            onChange={(value) =>
              updateDraftFilter("status", value.length > 0 ? joinCsv(value) : "ALL")
            }
            placeholder="Selecione um ou mais status"
          />

          <label className="text-sm text-slate-700">
            <span className="font-medium text-slate-700">Busca</span>
            <input
              type="text"
              value={draftFilters.text}
              onChange={(event) => updateDraftFilter("text", event.target.value)}
              placeholder="Origem, destino, motivo..."
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="font-medium text-slate-700">Data inicial</span>
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) => updateDraftFilter("startDate", event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="font-medium text-slate-700">Data final</span>
            <input
              type="date"
              value={draftFilters.endDate}
              onChange={(event) => updateDraftFilter("endDate", event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Limpar filtros
          </button>

          <button
            type="button"
            onClick={handleSearchClick}
            disabled={searchLoading}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {searchLoading ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      <TripsTablesSection
        loading={loading}
        searchLoading={searchLoading}
        trips={paginatedTrips}
        filteredTripsCount={filteredTrips.length}
        currentPage={currentPage}
        totalPages={totalPages}
        quickStatusTripId={quickStatusTripId}
        onQuickTripStatusChange={handleQuickTripStatusChange}
        pageSize={TABLE_PAGE_SIZE}
        selectedTripIds={selectedTripIds}
        allTripsOnPageSelected={allTripsOnPageSelected}
        onToggleTrip={(id) =>
          setSelectedTripIds((prev) =>
            prev.includes(id)
              ? prev.filter((item) => item !== id)
              : [...prev, id],
          )
        }
        onToggleAllTrips={() => {
          const pageIds = paginatedTrips.map((item) => item.id);
          const allSelected =
            pageIds.length > 0 &&
            pageIds.every((id) => selectedTripIds.includes(id));

          setSelectedTripIds((prev) =>
            allSelected
              ? prev.filter((id) => !pageIds.includes(id))
              : [...new Set([...prev, ...pageIds])],
          );
        }}
        onOpenEditSelected={handleOpenEditSelectedTrip}
        onOpenBulkDelete={() => setBulkDeleteOpen(true)}
        onSort={handleSort}
        getSortArrow={getSortArrow}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      />

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingTrip ? "Editar viagem" : "Registrar viagem"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha os dados operacionais da viagem.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="btn-ui btn-ui-neutral"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planejamento
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Veículo
                    </label>
                    <select
                      value={form.vehicleId}
                      onChange={(event) => handleVehicleChange(event.target.value)}
                      className={inputClass("vehicleId")}
                    >
                      <option value="">Selecione um veículo</option>
                      {availableVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {formatVehicleLabel(vehicle)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.vehicleId ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.vehicleId}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Motorista
                    </label>
                    <select
                      value={form.driverId}
                      onChange={(event) => handleChange("driverId", event.target.value)}
                      className={inputClass("driverId")}
                    >
                      <option value="">Selecione um motorista</option>
                      {availableDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.driverId ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.driverId}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Origem
                    </label>
                    <input
                      value={form.origin}
                      onChange={(event) => handleChange("origin", event.target.value)}
                      className={inputClass("origin")}
                      placeholder="Cidade/filial de saída"
                    />
                    {fieldErrors.origin ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.origin}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Destino
                    </label>
                    <input
                      value={form.destination}
                      onChange={(event) =>
                        handleChange("destination", event.target.value)
                      }
                      className={inputClass("destination")}
                      placeholder="Cidade/filial de destino"
                    />
                    {fieldErrors.destination ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.destination}
                      </p>
                    ) : null}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Motivo da viagem
                    </label>
                    <input
                      value={form.reason}
                      onChange={(event) => handleChange("reason", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      placeholder="Ex: Entrega regional"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Execução
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Data de saída
                    </label>
                    <input
                      type="date"
                      value={form.departureAt}
                      onChange={(event) =>
                        handleChange("departureAt", event.target.value)
                      }
                      className={inputClass("departureAt")}
                    />
                    {fieldErrors.departureAt ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.departureAt}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Data de retorno
                    </label>
                    <input
                      type="date"
                      value={form.returnAt}
                      onChange={(event) => handleChange("returnAt", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      KM saída
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.departureKm}
                      onChange={(event) =>
                        handleChange("departureKm", event.target.value)
                      }
                      className={inputClass("departureKm")}
                    />
                    {fieldErrors.departureKm ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.departureKm}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      KM retorno
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.returnKm}
                      onChange={(event) => handleChange("returnKm", event.target.value)}
                      className={inputClass("returnKm")}
                    />
                    {fieldErrors.returnKm ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.returnKm}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        handleChange("status", event.target.value as TripStatus)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="OPEN">Aberta</option>
                      <option value="COMPLETED">Concluída</option>
                      <option value="CANCELLED">Cancelada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Observações
                    </label>
                    <input
                      value={form.notes}
                      onChange={(event) => handleChange("notes", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
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
                  className="btn-ui btn-ui-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving
                    ? "Salvando..."
                    : editingTrip
                      ? "Salvar alterações"
                      : "Registrar viagem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={bulkDeleteOpen}
        title="Excluir viagens selecionadas"
        description={`Deseja excluir ${selectedTripIds.length} viagem(ns) selecionada(s)?`}
        loading={deletingTrip}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDeleteTrips}
      />
    </div>
  );
}