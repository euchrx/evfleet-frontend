import { useEffect, useMemo, useState } from "react";
import type { Vehicle } from "../../types/vehicle";
import { TABLE_PAGE_SIZE } from "./helpers";

type SortBy = "plate" | "vehicle" | "type" | "status";
type SortDirection = "asc" | "desc";
type ActiveTab = "vehicles" | "implements";

type VehicleFilters = {
  branchId: string; // CSV
  plate: string;
  brand: string;
  model: string;
  vehicleType: string; // CSV
  category: string; // CSV
  status: string; // CSV
  acquisitionDateStart: string;
  acquisitionDateEnd: string;
};

type UseVehiclesTablesParams = {
  vehicles: Vehicle[];
  activeTab: ActiveTab;
  hasSearched: boolean;
  filters: VehicleFilters;
};

function splitCsv(value: string) {
  if (!value || value === "ALL") return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesNormalized(source: string | null | undefined, search: string) {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) return true;
  return normalizeText(source).includes(normalizedSearch);
}

function normalizeDate(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isDateWithinRange(value: string | undefined | null, start: string, end: string) {
  const normalizedValue = normalizeDate(value);
  if (!normalizedValue) return !start && !end;
  if (start && normalizedValue < start) return false;
  if (end && normalizedValue > end) return false;
  return true;
}

function buildLinkedVehicleLabel(vehicle: Vehicle, vehicles: Vehicle[]) {
  const linkedVehicle = vehicles.find((candidate) =>
    (candidate.implements || []).some((item) => item.implementId === vehicle.id),
  );

  if (!linkedVehicle) return "Não vinculado";
  return `${linkedVehicle.plate} • ${linkedVehicle.brand} ${linkedVehicle.model}`;
}

export type { VehicleFilters, SortBy };

export const initialVehicleFilters: VehicleFilters = {
  branchId: "",
  plate: "",
  brand: "",
  model: "",
  vehicleType: "",
  category: "",
  status: "",
  acquisitionDateStart: "",
  acquisitionDateEnd: "",
};

export default function useVehiclesTables({
  vehicles,
  activeTab,
  hasSearched,
  filters,
}: UseVehiclesTablesParams) {
  const [sortBy, setSortBy] = useState<SortBy>("plate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentVehiclesPage, setCurrentVehiclesPage] = useState(1);
  const [currentImplementsPage, setCurrentImplementsPage] = useState(1);
  const [selectedTopVehicleIds, setSelectedTopVehicleIds] = useState<string[]>([]);
  const [selectedImplementIds, setSelectedImplementIds] = useState<string[]>([]);

  const vehiclesWithLinkedMeta = useMemo(() => {
    return vehicles.map((vehicle) =>
      vehicle.category === "IMPLEMENT"
        ? { ...vehicle, linkedVehicleLabel: buildLinkedVehicleLabel(vehicle, vehicles) }
        : vehicle,
    );
  }, [vehicles]);

  const filtered = useMemo(() => {
    if (!hasSearched) return [];

    let list = vehiclesWithLinkedMeta;

    const branchIds = splitCsv(filters.branchId);
    const vehicleTypes = splitCsv(filters.vehicleType);
    const categories = splitCsv(filters.category);
    const statuses = splitCsv(filters.status);

    if (branchIds.length) {
      list = list.filter((v) => branchIds.includes(v.branchId || ""));
    }

    if (vehicleTypes.length) {
      list = list.filter((v) => vehicleTypes.includes(v.vehicleType));
    }

    if (categories.length) {
      list = list.filter((v) => categories.includes(v.category || "CAR"));
    }

    if (statuses.length) {
      list = list.filter((v) => statuses.includes(v.status || "ACTIVE"));
    }

    if (filters.plate.trim()) {
      list = list.filter((v) => includesNormalized(v.plate, filters.plate));
    }

    if (filters.brand.trim()) {
      list = list.filter((v) => includesNormalized(v.brand, filters.brand));
    }

    if (filters.model.trim()) {
      list = list.filter((v) => includesNormalized(v.model, filters.model));
    }

    if (filters.acquisitionDateStart || filters.acquisitionDateEnd) {
      list = list.filter((v) =>
        isDateWithinRange(
          v.acquisitionDate,
          filters.acquisitionDateStart,
          filters.acquisitionDateEnd,
        ),
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    return [...list].sort((a, b) => {
      if (sortBy === "plate") {
        return a.plate.localeCompare(b.plate, "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }) * direction;
      }

      if (sortBy === "vehicle") {
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }) * direction;
      }

      if (sortBy === "status") {
        const order = { ACTIVE: 0, MAINTENANCE: 1, SOLD: 2 };
        return (
          ((order[a.status || "ACTIVE"] ?? 0) - (order[b.status || "ACTIVE"] ?? 0)) *
          direction
        );
      }

      const weight = { LIGHT: 0, HEAVY: 1 };
      return ((weight[a.vehicleType] ?? 0) - (weight[b.vehicleType] ?? 0)) * direction;
    });
  }, [vehiclesWithLinkedMeta, filters, hasSearched, sortBy, sortDirection]);

  const filteredVehicles = useMemo(
    () => filtered.filter((v) => v.category !== "IMPLEMENT"),
    [filtered],
  );

  const filteredImplements = useMemo(
    () => filtered.filter((v) => v.category === "IMPLEMENT"),
    [filtered],
  );

  const vehiclesTotalPages = Math.max(1, Math.ceil(filteredVehicles.length / TABLE_PAGE_SIZE));
  const implementsTotalPages = Math.max(
    1,
    Math.ceil(filteredImplements.length / TABLE_PAGE_SIZE),
  );

  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentVehiclesPage - 1) * TABLE_PAGE_SIZE,
      currentVehiclesPage * TABLE_PAGE_SIZE,
    );
  }, [filteredVehicles, currentVehiclesPage]);

  const paginatedImplements = useMemo(() => {
    return filteredImplements.slice(
      (currentImplementsPage - 1) * TABLE_PAGE_SIZE,
      currentImplementsPage * TABLE_PAGE_SIZE,
    );
  }, [filteredImplements, currentImplementsPage]);

  const paginatedVehicleIds = useMemo(
    () => paginatedVehicles.map((vehicle) => vehicle.id),
    [paginatedVehicles],
  );

  const paginatedImplementIds = useMemo(
    () => paginatedImplements.map((implement) => implement.id),
    [paginatedImplements],
  );

  const allTopVehiclesOnPageSelected =
    paginatedVehicleIds.length > 0 &&
    paginatedVehicleIds.every((id) => selectedTopVehicleIds.includes(id));

  const allImplementsOnPageSelected =
    paginatedImplementIds.length > 0 &&
    paginatedImplementIds.every((id) => selectedImplementIds.includes(id));

  const allSelectedIds = useMemo(
    () => [...selectedTopVehicleIds, ...selectedImplementIds],
    [selectedTopVehicleIds, selectedImplementIds],
  );

  useEffect(() => {
    setCurrentVehiclesPage(1);
    setCurrentImplementsPage(1);
    setSelectedTopVehicleIds([]);
    setSelectedImplementIds([]);
  }, [filters, sortBy, sortDirection, activeTab, hasSearched]);

  useEffect(() => {
    setCurrentVehiclesPage((prev) => Math.min(prev, vehiclesTotalPages));
  }, [vehiclesTotalPages]);

  useEffect(() => {
    setCurrentImplementsPage((prev) => Math.min(prev, implementsTotalPages));
  }, [implementsTotalPages]);

  useEffect(() => {
    const validIds = new Set(filteredVehicles.map((vehicle) => vehicle.id));
    setSelectedTopVehicleIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredVehicles]);

  useEffect(() => {
    const validIds = new Set(filteredImplements.map((implement) => implement.id));
    setSelectedImplementIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredImplements]);

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: SortBy): "↕" | "↑" | "↓" {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function clearSelections() {
    setSelectedTopVehicleIds([]);
    setSelectedImplementIds([]);
  }

  function toggleTopVehicleSelection(vehicleId: string) {
    setSelectedTopVehicleIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId],
    );
  }

  function toggleImplementSelection(vehicleId: string) {
    setSelectedImplementIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId],
    );
  }

  function toggleSelectAllTopVehiclesOnPage() {
    setSelectedTopVehicleIds((prev) => {
      if (allTopVehiclesOnPageSelected) {
        return prev.filter((id) => !paginatedVehicleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...paginatedVehicleIds]));
    });
  }

  function toggleSelectAllImplementsOnPage() {
    setSelectedImplementIds((prev) => {
      if (allImplementsOnPageSelected) {
        return prev.filter((id) => !paginatedImplementIds.includes(id));
      }

      return Array.from(new Set([...prev, ...paginatedImplementIds]));
    });
  }

  return {
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
  };
}