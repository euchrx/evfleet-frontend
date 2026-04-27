import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { getDebts } from "../../services/debts";
import { getDrivers } from "../../services/drivers";
import { getFuelRecords, type FuelRecord } from "../../services/fuelRecords";
import { getMaintenanceRecords } from "../../services/maintenanceRecords";
import {
  getRetailProducts,
  type RetailProductCategory,
  type RetailProductItem,
} from "../../services/retailProducts";
import { getTires } from "../../services/tires";
import { getTrips } from "../../services/trips";
import { getVehicleDocuments } from "../../services/vehicleDocuments";
import { getVehicles } from "../../services/vehicles";
import type { Debt } from "../../types/debt";
import type { Driver } from "../../types/driver";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Tire } from "../../types/tire";
import type { Trip } from "../../types/trip";
import type { VehicleDocument } from "../../types/vehicle-document";
import type { Vehicle } from "../../types/vehicle";

type ReportModule =
  | "VEHICLES"
  | "DRIVERS"
  | "FUEL"
  | "PRODUCTS"
  | "MAINTENANCE"
  | "TIRES"
  | "TRIPS"
  | "DOCUMENTS"
  | "DEBTS";

type VehicleCategoryFilter = "VEHICLES" | "IMPLEMENTS";
type VehicleTypeFilter = "LIGHT" | "HEAVY";
type VehicleStatusFilter = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "SOLD";
type SelectOption = { id: string; label: string };

function toCurrency(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(0);
  }

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseDateSafe(dateValue?: string | null) {
  if (!dateValue) return new Date("");

  const normalized = String(dateValue).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(normalized);
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "-";

  const date = parseDateSafe(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

function escapeHtml(value: unknown) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelMaintenanceType(value?: string) {
  if (value === "PREVENTIVE") return "Preventiva";
  if (value === "PERIODIC") return "Periódica";
  if (value === "CORRECTIVE") return "Corretiva";
  return value || "-";
}

function labelMaintenanceStatus(value?: string) {
  if (value === "OPEN" || value === "PENDING") return "Pendente";
  if (value === "IN_PROGRESS") return "Em andamento";
  if (value === "DONE" || value === "COMPLETED") return "Concluída";
  if (value === "CANCELED") return "Cancelada";
  return value || "-";
}

function labelDebtCategory(value?: string) {
  if (value === "FINE") return "Multa";
  if (value === "IPVA") return "IPVA";
  if (value === "LICENSING") return "Licenciamento";
  if (value === "INSURANCE") return "Seguro";
  if (value === "TOLL") return "Pedágio";
  if (value === "TAX") return "Imposto";
  if (value === "OTHER") return "Outros";
  return value || "-";
}

function labelDebtStatus(value?: string) {
  if (value === "PENDING") return "Pendente";
  if (value === "PAID") return "Pago";
  if (value === "OVERDUE") return "Vencido";
  if (value === "APPEALED") return "Recorrido";
  return value || "-";
}

function labelVehicleType(value?: string) {
  if (value === "LIGHT") return "Leve";
  if (value === "HEAVY") return "Pesado";
  return value || "-";
}

function labelVehicleCategory(value?: string) {
  if (value === "CAR") return "Carro";
  if (value === "TRUCK") return "Caminhão";
  if (value === "UTILITY") return "Utilitário";
  if (value === "IMPLEMENT") return "Implemento";
  return value || "-";
}

function labelTripStatus(value?: string) {
  if (value === "OPEN") return "Aberta";
  if (value === "COMPLETED") return "Concluída";
  if (value === "CANCELLED") return "Cancelada";
  return value || "-";
}

function labelDocumentStatus(value?: string) {
  if (value === "VALID") return "Válido";
  if (value === "EXPIRING") return "Vencendo";
  if (value === "EXPIRED") return "Vencido";
  return value || "-";
}

function labelTireStatus(value?: string) {
  if (value === "IN_STOCK") return "Estoque";
  if (value === "INSTALLED") return "Instalado";
  if (value === "MAINTENANCE") return "Manutenção";
  if (value === "RETREADED") return "Recapado";
  if (value === "SCRAPPED") return "Descartado";
  return value || "-";
}

function labelProductCategory(value?: RetailProductCategory | string) {
  if (value === "PERFUMARIA") return "Perfumaria";
  if (value === "COSMETICOS") return "Cosméticos";
  if (value === "LUBRIFICANTES") return "Lubrificantes";
  if (value === "CONVENIENCIA") return "Conveniência";
  if (value === "LIMPEZA") return "Limpeza";
  if (value === "OUTROS") return "Outros";
  return value || "-";
}

function toNumber(value?: string | number | null) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatVehicleDisplay(
  vehicle?: { plate?: string; brand?: string; model?: string } | null,
  fallback?: string,
) {
  if (!vehicle) return fallback || "-";

  const plate = String(vehicle.plate || "").trim();
  const name = [vehicle.brand, vehicle.model]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");

  return [plate, name].filter(Boolean).join(" - ") || fallback || "-";
}

function formatDateTime(dateValue?: string | null) {
  if (!dateValue) return "-";

  const normalized = String(dateValue).trim();

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/
  );

  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${day}/${month}/${year}, ${hour}:${minute}`;
  }

  const date = parseDateSafe(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatYear(value?: string | number | null) {
  if (!value) return "-";
  return String(value);
}

function formatTankCapacity(value?: string | number | null) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";

  return `${number.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })} L`;
}

function formatFuelType(value?: string | null) {
  if (value === "GASOLINE") return "Gasolina";
  if (value === "ETHANOL") return "Etanol";
  if (value === "DIESEL") return "Diesel";
  if (value === "ARLA32") return "ARLA 32";
  if (value === "FLEX") return "Flex";
  if (value === "ELECTRIC") return "Elétrico";
  if (value === "HYBRID") return "Híbrido";
  if (value === "CNG") return "GNV";
  return value || "-";
}

function formatLinkedImplements(vehicle: Vehicle) {
  const implementsList = vehicle.implements || [];

  if (!Array.isArray(implementsList) || implementsList.length === 0) {
    return "-";
  }

  return implementsList
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((item) => formatVehicleDisplay(item.implement))
    .filter((item) => item && item !== "-")
    .join(", ") || "-";
}

function formatLinkedVehicle(vehicle: Vehicle) {
  const source = vehicle as Vehicle & Record<string, any>;

  const linkedVehicle =
    source.linkedVehicle ||
    source.vehicle ||
    source.parentVehicle ||
    source.compositionVehicle ||
    null;

  return formatVehicleDisplay(linkedVehicle, "-");
}

function formatBranchName(item: Record<string, any>) {
  return item.company?.name || item.companyName || item.retailProductImport?.company?.name || "-";
}

function formatAverageConsumption(item: FuelRecord) {
  const source = item as FuelRecord & Record<string, any>;

  const consumption =
    Number(source.averageConsumption || 0) ||
    Number(source.consumptionAverage || 0) ||
    Number(source.kmPerLiter || 0);

  if (!Number.isFinite(consumption) || consumption <= 0) return "-";

  return `${consumption.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km/L`;
}

function formatTireMeasure(item: Tire) {
  const source = item as Tire & Record<string, any>;
  return source.measure || source.size || source.tireSize || "-";
}

function formatTireRim(item: Tire) {
  const source = item as Tire & Record<string, any>;
  return source.rim || source.rimSize || source.wheelRim || "-";
}

function formatTireCondition(item: Tire) {
  const source = item as Tire & Record<string, any>;
  const condition = source.condition || source.state;

  if (condition === "NEW") return "Novo";
  if (condition === "USED") return "Usado";
  if (condition === "RETREADED") return "Recapado";
  if (condition === "SCRAP") return "Sucata";
  if (condition === "GOOD") return "Bom";
  if (condition === "WARNING") return "Atenção";
  if (condition === "CRITICAL") return "Crítico";

  return condition || "-";
}

function formatTireAlerts(item: Tire) {
  const source = item as Tire & Record<string, any>;

  const alerts = [
    source.alert,
    source.alerts,
    source.warning,
    source.warnings,
    source.observation,
  ]
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return alerts.length > 0 ? alerts.join(", ") : "-";
}

function formatTripRoute(item: Trip) {
  const origin = String(item.origin || "").trim();
  const destination = String(item.destination || "").trim();

  if (!origin && !destination) return "-";
  if (!origin) return destination;
  if (!destination) return origin;

  return `${origin} → ${destination}`;
}

function formatTripDistance(item: Trip) {
  const source = item as Trip & Record<string, any>;

  if (
    typeof source.returnKm === "number" &&
    typeof source.departureKm === "number" &&
    source.returnKm >= source.departureKm
  ) {
    return (source.returnKm - source.departureKm).toLocaleString("pt-BR");
  }

  const distance = Number(source.distanceKm || source.km || 0);
  if (!Number.isFinite(distance) || distance <= 0) return "-";

  return distance.toLocaleString("pt-BR");
}

function formatDriverDocuments(driver: Driver) {
  const source = driver as Driver & Record<string, any>;

  const documents = [
    source.document,
    source.licenseNumber || source.cnh,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return documents.length > 0 ? documents.join(" / ") : "-";
}

function formatDriverVehicles(driver: Driver, vehicles: Vehicle[]) {
  const source = driver as Driver & Record<string, any>;

  if (Array.isArray(source.vehicles) && source.vehicles.length > 0) {
    return source.vehicles
      .map((vehicle: Vehicle) => formatVehicleDisplay(vehicle))
      .join(", ");
  }

  if (Array.isArray(source.vehicleIds) && source.vehicleIds.length > 0) {
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

    return source.vehicleIds
      .map((vehicleId: string) =>
        formatVehicleDisplay(vehicleMap.get(vehicleId), vehicleId),
      )
      .join(", ");
  }

  return "-";
}

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  error,
  disabled = false,
  openOnClick = false,
  keepOpenOnSelect = false,
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

export function ReportsPage() {
  const { selectedBranchId } = useBranch();
  const { currentCompany } = useCompanyScope();
  const [errorMessage, setErrorMessage] = useState("");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [products, setProducts] = useState<RetailProductItem[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedImplementIds, setSelectedImplementIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedVehicleCategories, setSelectedVehicleCategories] = useState<
    VehicleCategoryFilter[]
  >(["VEHICLES"]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<VehicleTypeFilter[]>(
    [],
  );
  const [selectedVehicleStatuses, setSelectedVehicleStatuses] = useState<
    VehicleStatusFilter[]
  >([]);
  const [selectedModules, setSelectedModules] = useState<ReportModule[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    vehicleTypes?: string;
  }>({});
  const [format, setFormat] = useState("PDF");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));

  async function loadData() {
    try {
      setErrorMessage("");

      const [
        vehiclesData,
        driversData,
        fuelData,
        maintenanceData,
        debtsData,
        productsData,
        tiresData,
        tripsData,
        documentsData,
      ] = await Promise.all([
        getVehicles(),
        getDrivers(),
        getFuelRecords(),
        getMaintenanceRecords(),
        getDebts(),
        getRetailProducts(),
        getTires(),
        getTrips(),
        getVehicleDocuments(),
      ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setFuelRecords(Array.isArray(fuelData) ? fuelData : []);
      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setTires(Array.isArray(tiresData) ? tiresData : []);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
      setErrorMessage("Não foi possível carregar os dados para geração dos relatórios.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return;

    setSelectedBranchIds((current) =>
      current.includes(selectedBranchId) ? current : [...current, selectedBranchId],
    );
  }, [selectedBranchId]);

  const availableVehicles = useMemo(() => {
    const scoped = selectedBranchId
      ? vehicles.filter((item) => !item.branchId || item.branchId === selectedBranchId)
      : vehicles;

    return [...scoped].sort((a, b) =>
      formatVehicleDisplay(a).localeCompare(formatVehicleDisplay(b), "pt-BR"),
    );
  }, [vehicles, selectedBranchId]);

  const availableMainVehicles = useMemo(
    () => availableVehicles.filter((item) => item.category !== "IMPLEMENT"),
    [availableVehicles],
  );

  const availableImplements = useMemo(
    () => availableVehicles.filter((item) => item.category === "IMPLEMENT"),
    [availableVehicles],
  );

  const vehicleOptions = useMemo<SelectOption[]>(
    () =>
      availableMainVehicles
        .filter((item) =>
          selectedVehicleTypes.length > 0
            ? selectedVehicleTypes.includes(item.vehicleType as VehicleTypeFilter)
            : true,
        )
        .map((item) => ({
          id: item.id,
          label: formatVehicleDisplay(item),
        })),
    [availableMainVehicles, selectedVehicleTypes],
  );

  const implementOptions = useMemo<SelectOption[]>(
    () =>
      availableImplements.map((item) => ({
        id: item.id,
        label: formatVehicleDisplay(item),
      })),
    [availableImplements],
  );

  const driverOptions = useMemo<SelectOption[]>(
    () =>
      drivers
        .map((item) => ({ id: item.id, label: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [drivers],
  );

  const vehicleCategoryOptions: SelectOption[] = [
    { id: "VEHICLES", label: "Veículos" },
    { id: "IMPLEMENTS", label: "Implementos" },
  ];

  const vehicleTypeOptions: SelectOption[] = [
    { id: "LIGHT", label: "Leve" },
    { id: "HEAVY", label: "Pesado" },
  ];

  const moduleOptions: SelectOption[] = [
    { id: "VEHICLES", label: "Veículos" },
    { id: "DRIVERS", label: "Motoristas" },
    { id: "FUEL", label: "Abastecimentos" },
    { id: "PRODUCTS", label: "Produtos" },
    { id: "MAINTENANCE", label: "Manutenções" },
    { id: "TIRES", label: "Gestão de Pneus" },
    { id: "TRIPS", label: "Gestão de viagens" },
    { id: "DOCUMENTS", label: "Gestão de documentos" },
    { id: "DEBTS", label: "Gestão de Finanças" },
  ];

  const vehicleStatusOptions: SelectOption[] = [
    { id: "ACTIVE", label: "Ativos" },
    { id: "INACTIVE", label: "Inativos" },
    { id: "MAINTENANCE", label: "Em manutenção" },
    { id: "SOLD", label: "Vendidos" },
  ];

  useEffect(() => {
    if (!selectedVehicleCategories.includes("VEHICLES")) {
      setSelectedVehicleIds([]);
    }

    if (!selectedVehicleCategories.includes("IMPLEMENTS")) {
      setSelectedImplementIds([]);
    }
  }, [selectedVehicleCategories]);

  const filteredData = useMemo(() => {
    const start = parseDateSafe(startDate);
    const end = parseDateSafe(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const inRange = (dateValue?: string | null) => {
      const date = parseDateSafe(dateValue);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    };

    const baseVehicles = availableVehicles.filter((vehicle) => {
      if (selectedBranchIds.length === 0) return true;
      if (!vehicle.branchId) return true;
      return selectedBranchIds.includes(vehicle.branchId);
    });

    const categoryFilteredVehicles = baseVehicles.filter((vehicle) => {
      if (selectedVehicleCategories.length === 0) return true;

      const isImplement = vehicle.category === "IMPLEMENT";

      if (isImplement) {
        return selectedVehicleCategories.includes("IMPLEMENTS");
      }

      return selectedVehicleCategories.includes("VEHICLES");
    });

    const byType = categoryFilteredVehicles.filter((vehicle) =>
      selectedVehicleTypes.length > 0
        ? selectedVehicleTypes.includes(vehicle.vehicleType as VehicleTypeFilter)
        : true,
    );

    const byStatus = byType.filter((vehicle) =>
      selectedVehicleStatuses.length > 0
        ? selectedVehicleStatuses.includes(String(vehicle.status || "") as VehicleStatusFilter)
        : true,
    );

    const selectedAssetIds = [...selectedVehicleIds, ...selectedImplementIds];

    const vehiclesFinal = byStatus.filter((vehicle) =>
      selectedAssetIds.length > 0 ? selectedAssetIds.includes(vehicle.id) : true,
    );

    const vehicleSet = new Set(vehiclesFinal.map((item) => item.id));
    const driverSet = new Set(selectedDriverIds);

    const driversFinal = drivers
      .filter((driver) => {
        if (selectedDriverIds.length === 0) return true;
        return selectedDriverIds.includes(driver.id);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const fuel = fuelRecords.filter((item) => {
      if (!vehicleSet.has(item.vehicleId) || !inRange(item.fuelDate)) return false;
      if (driverSet.size === 0) return true;
      return item.driverId ? driverSet.has(item.driverId) : false;
    });

    const maintenance = maintenanceRecords.filter(
      (item) => vehicleSet.has(item.vehicleId) && inRange(item.maintenanceDate),
    );

    const debtsFiltered = debts.filter(
      (item) => vehicleSet.has(item.vehicleId) && inRange(item.dueDate || item.debtDate),
    );

    const productsFiltered = products.filter((item) => {
      const vehicleId = item.retailProductImport?.vehicle?.id;

      return (
        inRange(item.retailProductImport?.issuedAt || item.createdAt) &&
        (!vehicleId || vehicleSet.has(vehicleId))
      );
    });

    const tiresFiltered = tires.filter((item) => {
      if (!item.vehicleId || !vehicleSet.has(item.vehicleId)) return false;
      return inRange(item.purchaseDate || item.installedAt || item.createdAt);
    });

    const tripsFiltered = trips.filter((item) => {
      if (!vehicleSet.has(item.vehicleId) || !inRange(item.departureAt)) return false;
      if (driverSet.size === 0) return true;
      return item.driverId ? driverSet.has(item.driverId) : false;
    });

    const documentsFiltered = documents.filter((item) => {
      if (!item.vehicleId || !vehicleSet.has(item.vehicleId)) return false;
      return inRange(item.expiryDate || item.issueDate || item.createdAt);
    });

    return {
      vehicles: vehiclesFinal,
      drivers: driversFinal,
      fuel,
      maintenance,
      debts: debtsFiltered,
      products: productsFiltered,
      tires: tiresFiltered,
      trips: tripsFiltered,
      documents: documentsFiltered,
    };
  }, [
    availableVehicles,
    drivers,
    selectedBranchIds,
    selectedVehicleCategories,
    selectedVehicleTypes,
    selectedVehicleStatuses,
    selectedVehicleIds,
    selectedImplementIds,
    selectedDriverIds,
    startDate,
    endDate,
    fuelRecords,
    maintenanceRecords,
    debts,
    products,
    tires,
    trips,
    documents,
  ]);

  function exportReport() {
    const nextErrors: { vehicleTypes?: string } = {};

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const shouldShowAllModules = selectedModules.length === 0;

    const showVehicles = shouldShowAllModules || selectedModules.includes("VEHICLES");
    const showDrivers = shouldShowAllModules || selectedModules.includes("DRIVERS");
    const showFuel = shouldShowAllModules || selectedModules.includes("FUEL");
    const showProducts = shouldShowAllModules || selectedModules.includes("PRODUCTS");
    const showMaintenance =
      shouldShowAllModules || selectedModules.includes("MAINTENANCE");
    const showTires = shouldShowAllModules || selectedModules.includes("TIRES");
    const showTrips = shouldShowAllModules || selectedModules.includes("TRIPS");
    const showDocuments =
      shouldShowAllModules || selectedModules.includes("DOCUMENTS");
    const showDebts = shouldShowAllModules || selectedModules.includes("DEBTS");

    const vehiclesOnly = filteredData.vehicles
      .filter((item) => item.category !== "IMPLEMENT")
      .sort((a, b) =>
        formatVehicleDisplay(a).localeCompare(formatVehicleDisplay(b), "pt-BR"),
      );

    const implementsOnly = filteredData.vehicles
      .filter((item) => item.category === "IMPLEMENT")
      .sort((a, b) =>
        formatVehicleDisplay(a).localeCompare(formatVehicleDisplay(b), "pt-BR"),
      );

    const vehiclesModuleTotal = 0;
    const fuelModuleTotal = filteredData.fuel.reduce(
      (sum, item) => sum + Number(item.totalValue || 0),
      0,
    );
    const productsModuleTotal = filteredData.products.reduce(
      (sum, item) => sum + toNumber(item.totalValue),
      0,
    );
    const maintenanceModuleTotal = filteredData.maintenance.reduce(
      (sum, item) => sum + Number(item.cost || 0),
      0,
    );
    const tiresModuleTotal = filteredData.tires.reduce(
      (sum, item) => sum + Number(item.purchaseCost || 0),
      0,
    );
    const tripsDistanceTotal = filteredData.trips.reduce((sum, item) => {
      if (typeof item.returnKm === "number" && item.returnKm >= item.departureKm) {
        return sum + (item.returnKm - item.departureKm);
      }

      return sum;
    }, 0);
    const debtsModuleTotal = filteredData.debts.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    const totalGeral =
      (showVehicles ? vehiclesModuleTotal : 0) +
      (showFuel ? fuelModuleTotal : 0) +
      (showProducts ? productsModuleTotal : 0) +
      (showMaintenance ? maintenanceModuleTotal : 0) +
      (showTires ? tiresModuleTotal : 0) +
      (showDebts ? debtsModuleTotal : 0);

    const sections = [
      {
        enabled: showVehicles,
        order: 1,
        title: "Veículos",
        count: vehiclesOnly.length,
        html: `<h2>Veículos (${vehiclesOnly.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca/Modelo</th>
                <th>Ano modelo</th>
                <th>Fipe</th>
                <th>Categoria</th>
                <th>Tipo de veículo</th>
                <th>Capacidade do Tanque</th>
                <th>Implementos vinculados</th>
              </tr>
            </thead>
            <tbody>${vehiclesOnly
            .map((item) => {
              const source = item as Vehicle & Record<string, any>;

              return `<tr>
      <td>${escapeHtml(item.plate || "-")}</td>
      <td>${escapeHtml(`${item.brand || ""} ${item.model || ""}`.trim() || "-")}</td>
      <td>${escapeHtml(formatYear(source.modelYear || item.year))}</td>
      <td>${escapeHtml(source.fipeCode || source.fipe || "-")}</td>
      <td>${escapeHtml(labelVehicleCategory(item.category))}</td>
      <td>${escapeHtml(labelVehicleType(item.vehicleType))}</td>
      <td>${escapeHtml(formatTankCapacity(source.tankCapacity))}</td>
      <td>${escapeHtml(formatLinkedImplements(item))}</td>
    </tr>`;
            })
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Veículos: ${toCurrency(
              vehiclesModuleTotal,
            )}</div>`,
      },
      {
        enabled: showVehicles,
        order: 2,
        title: "Implementos",
        count: implementsOnly.length,
        html: `<h2>Implementos (${implementsOnly.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca/Modelo</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Veículo vinculado</th>
              </tr>
            </thead>
            <tbody>${implementsOnly
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(item.plate || "-")}</td>
                    <td>${escapeHtml(`${item.brand || ""} ${item.model || ""}`.trim() || "-")}</td>
                    <td>${escapeHtml(labelVehicleCategory(item.category))}</td>
                    <td>${escapeHtml(labelVehicleType(item.vehicleType))}</td>
                    <td>${escapeHtml(formatLinkedVehicle(item))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>`,
      },
      {
        enabled: showFuel,
        title: "Abastecimentos",
        count: filteredData.fuel.length,
        html: `<h2>Abastecimentos (${filteredData.fuel.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Filial</th>
                <th>Veículo</th>
                <th>Motorista</th>
                <th>Data e Hora</th>
                <th>Combustível</th>
                <th>Litros</th>
                <th>Valor total</th>
                <th>KM</th>
                <th>Consumo médio</th>
              </tr>
            </thead>
            <tbody>${filteredData.fuel
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(formatBranchName(item))}</td>
                    <td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td>
                    <td>${escapeHtml(item.driver?.name || "-")}</td>
                    <td>${escapeHtml(formatDateTime(item.fuelDate))}</td>
                    <td>${escapeHtml(formatFuelType(item.fuelType))}</td>
                    <td>${toNumber(item.liters).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
                    <td>${toCurrency(item.totalValue || 0)}</td>
                    <td>${toNumber(item.km).toLocaleString("pt-BR")}</td>
                    <td>${escapeHtml(formatAverageConsumption(item))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Abastecimentos: ${toCurrency(
              fuelModuleTotal,
            )}</div>`,
      },
      {
        enabled: showDebts,
        title: "Gestão de Finanças",
        count: filteredData.debts.length,
        html: `<h2>Gestão de Finanças (${filteredData.debts.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Data de lançamento</th>
                <th>Data de Vencimento</th>
              </tr>
            </thead>
            <tbody>${filteredData.debts
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td>
                    <td>${escapeHtml(item.description || "-")}</td>
                    <td>${escapeHtml(labelDebtCategory(item.category))}</td>
                    <td>${escapeHtml(labelDebtStatus(item.status))}</td>
                    <td>${toCurrency(item.amount || 0)}</td>
                    <td>${escapeHtml(formatDate(item.debtDate || item.createdAt))}</td>
                    <td>${escapeHtml(formatDate(item.dueDate))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Gestão de Finanças: ${toCurrency(
              debtsModuleTotal,
            )}</div>`,
      },
      {
        enabled: showDocuments,
        title: "Gestão de documentos",
        count: filteredData.documents.length,
        html: `<h2>Gestão de documentos (${filteredData.documents.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Documento</th>
                <th>Status</th>
                <th>Data de lançamento</th>
                <th>Data de Vencimento</th>
              </tr>
            </thead>
            <tbody>${filteredData.documents
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId || undefined))}</td>
                    <td>${escapeHtml(item.name || "-")}</td>
                    <td>${escapeHtml(labelDocumentStatus(item.status))}</td>
                    <td>${escapeHtml(formatDate(item.issueDate || item.createdAt))}</td>
                    <td>${escapeHtml(formatDate(item.expiryDate))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Gestão de documentos: ${filteredData.documents.length
          } documento(s)</div>`,
      },
      {
        enabled: showTires,
        title: "Gestão de Pneus",
        count: filteredData.tires.length,
        html: `<h2>Gestão de Pneus (${filteredData.tires.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Número de série</th>
                <th>Marca/Modelo</th>
                <th>Medida</th>
                <th>Aro</th>
                <th>Posição</th>
                <th>Status</th>
                <th>Estado</th>
                <th>Veículo vinculado</th>
                <th>KM</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>${filteredData.tires
            .map((item) => {
              const source = item as Tire & Record<string, any>;

              return `<tr>
      <td>${escapeHtml(source.serialNumber || source.number || source.code || "-")}</td>
      <td>${escapeHtml(`${source.brand || ""} ${source.model || ""}`.trim() || "-")}</td>
      <td>${escapeHtml(formatTireMeasure(item))}</td>
      <td>${escapeHtml(formatTireRim(item))}</td>
      <td>${escapeHtml(
                `${source.axlePosition || "-"}${source.wheelPosition ? ` | ${source.wheelPosition}` : ""
                }`,
              )}</td>
      <td>${escapeHtml(labelTireStatus(source.status))}</td>
      <td>${escapeHtml(formatTireCondition(item))}</td>
      <td>${escapeHtml(formatVehicleDisplay(source.vehicle, source.vehicleId || "-"))}</td>
      <td>${toNumber(source.currentKm || source.km || source.installedKm).toLocaleString("pt-BR")}</td>
      <td>${escapeHtml(formatTireAlerts(item))}</td>
    </tr>`;
            })
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Gestão de Pneus: ${toCurrency(
              tiresModuleTotal,
            )}</div>`,
      },
      {
        enabled: showTrips,
        title: "Gestão de viagens",
        count: filteredData.trips.length,
        html: `<h2>Gestão de viagens (${filteredData.trips.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Motorista</th>
                <th>Rota</th>
                <th>Data de saída</th>
                <th>Data de retorno</th>
                <th>KM Rodados</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${filteredData.trips
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td>
                    <td>${escapeHtml(item.driver?.name || "-")}</td>
                    <td>${escapeHtml(formatTripRoute(item))}</td>
                    <td>${escapeHtml(formatDateTime(item.departureAt))}</td>
                    <td>${escapeHtml(formatDateTime((item as Trip & Record<string, any>).returnAt || (item as Trip & Record<string, any>).arrivalAt))}</td>
                    <td>${escapeHtml(formatTripDistance(item))}</td>
                    <td>${escapeHtml(labelTripStatus(item.status))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>
          <div class="module-total">Total de km em Gestão de viagens: ${tripsDistanceTotal.toLocaleString(
              "pt-BR",
            )} km</div>`,
      },
      {
        enabled: showMaintenance,
        title: "Manutenções",
        count: filteredData.maintenance.length,
        html: `<h2>Manutenções (${filteredData.maintenance.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>KM</th>
                <th>Custo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${filteredData.maintenance
            .map(
              (item) =>
                `<tr>
                    <td>${escapeHtml(formatDate(item.maintenanceDate))}</td>
                    <td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td>
                    <td>${escapeHtml(labelMaintenanceType(item.type))}</td>
                    <td>${escapeHtml(item.description || "-")}</td>
                    <td>${toNumber(item.km).toLocaleString("pt-BR")}</td>
                    <td>${toCurrency(item.cost || 0)}</td>
                    <td>${escapeHtml(labelMaintenanceStatus(item.status))}</td>
                  </tr>`,
            )
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Manutenções: ${toCurrency(
              maintenanceModuleTotal,
            )}</div>`,
      },
      {
        enabled: showDrivers,
        title: "Motoristas",
        count: filteredData.drivers.length,
        html: `<h2>Motoristas (${filteredData.drivers.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Documentos</th>
                <th>Veículos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${filteredData.drivers
            .map((item) => {
              const driver = item as Driver & {
                cpf?: string | null;
                document?: string | null;
                status?: string | null;
              };

              return `<tr>
                  <td>${escapeHtml(driver.name || "-")}</td>
                  <td>${escapeHtml(driver.cpf || "-")}</td>
                  <td>${escapeHtml(formatDriverDocuments(driver))}</td>
                  <td>${escapeHtml(formatDriverVehicles(driver, availableVehicles))}</td>
                  <td>${escapeHtml(driver.status || "-")}</td>
                </tr>`;
            })
            .join("")}</tbody>
          </table>
          <div class="module-total">Total do módulo Motoristas: ${filteredData.drivers.length
          } motorista(s)</div>`,
      },
      {
        enabled: showProducts,
        title: "Produtos",
        count: filteredData.products.length,
        html: `<h2>Produtos (${filteredData.products.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Veículo</th>
        <th>Produto</th>
        <th>Categoria</th>
        <th>Fornecedor</th>
        <th>NF-e</th>
        <th>Quantidade</th>
        <th>Valor total</th>
      </tr>
    </thead>
    <tbody>${filteredData.products
            .map(
              (item) =>
                `<tr>
            <td>${escapeHtml(formatDate(item.retailProductImport?.issuedAt || item.createdAt))}</td>
            <td>${escapeHtml(
                  formatVehicleDisplay(
                    item.retailProductImport?.vehicle,
                    item.retailProductImport?.vehicle?.id,
                  ),
                )}</td>
            <td>${escapeHtml(item.description || "-")}</td>
            <td>${escapeHtml(labelProductCategory(item.category))}</td>
            <td>${escapeHtml(item.retailProductImport?.supplierName || "-")}</td>
            <td>${escapeHtml(item.retailProductImport?.invoiceNumber || "-")}</td>
            <td>${toNumber(item.quantity).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
            <td>${toCurrency(toNumber(item.totalValue))}</td>
          </tr>`,
            )
            .join("")}
    </tbody>
  </table>
  <div class="module-total">Total do módulo Produtos: ${toCurrency(
              productsModuleTotal,
            )}</div>`,
      },
    ];

    const moduleSections = sections
      .filter((section) => section.enabled)
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
        const orderB = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;

        if (orderA !== orderB) return orderA - orderB;

        return String(a.title || "").localeCompare(String(b.title || ""), "pt-BR");
      })
      .map((section) => section.html)
      .join("");

    const html = `
      <html>
        <head>
          <title>Relatório da Frota</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px; }
            h2 { margin: 18px 0 8px; }
            .meta { font-size: 12px; color: #475569; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            th { background: #f8fafc; }
            .module-total { margin: 8px 0 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
            .grand-total { margin-top: 18px; padding-top: 10px; border-top: 2px solid #cbd5e1; font-size: 16px; font-weight: 800; color: #0f172a; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Relatório operacional</h1>
          <div class="meta">Período: ${escapeHtml(formatDate(startDate))} até ${escapeHtml(
      formatDate(endDate),
    )}</div>
          ${moduleSections}
          <div class="grand-total">Valor total geral: ${toCurrency(totalGeral)}</div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1280,height=900");
    if (!printWindow) return;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confronte dados da frota por período, veículo e motorista.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Empresa</label>
            <input
              type="text"
              value={currentCompany?.name || "Empresa não selecionada"}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <MultiSelectField
              label="Módulos"
              options={moduleOptions}
              selectedIds={selectedModules}
              onChange={(value) => setSelectedModules(value as ReportModule[])}
              placeholder="Selecione os módulos, ou deixe limpo para visualizar todos"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          <div>
            <MultiSelectField
              label="Categoria"
              options={vehicleCategoryOptions}
              selectedIds={selectedVehicleCategories}
              onChange={(value) =>
                setSelectedVehicleCategories(value as VehicleCategoryFilter[])
              }
              placeholder="Selecione Veículos/Implementos"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          {selectedVehicleCategories.length > 0 ? (
            <div>
              <MultiSelectField
                label="Tipo de veículo"
                options={vehicleTypeOptions}
                selectedIds={selectedVehicleTypes}
                onChange={(value) => {
                  setSelectedVehicleTypes(value as VehicleTypeFilter[]);
                  setFieldErrors((prev) => ({ ...prev, vehicleTypes: undefined }));
                }}
                placeholder="Selecione Leve/Pesado"
                error={fieldErrors.vehicleTypes}
                openOnClick
                keepOpenOnSelect
              />
            </div>
          ) : null}

          {selectedVehicleCategories.includes("VEHICLES") ? (
            <div>
              <MultiSelectField
                label="Veículos"
                options={vehicleOptions}
                selectedIds={selectedVehicleIds}
                onChange={setSelectedVehicleIds}
                placeholder="Buscar por placa, marca ou modelo"
                openOnClick
                keepOpenOnSelect
              />
            </div>
          ) : null}

          {selectedVehicleCategories.includes("IMPLEMENTS") ? (
            <div>
              <MultiSelectField
                label="Implementos"
                options={implementOptions}
                selectedIds={selectedImplementIds}
                onChange={setSelectedImplementIds}
                placeholder="Buscar por placa, marca ou modelo"
                openOnClick
                keepOpenOnSelect
              />
            </div>
          ) : null}

          <div>
            <MultiSelectField
              label="Motoristas"
              options={driverOptions}
              selectedIds={selectedDriverIds}
              onChange={setSelectedDriverIds}
              placeholder="Digite para buscar motorista"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Data inicial *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Data final *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {selectedModules.includes("VEHICLES") ? (
            <div className="lg:col-span-3">
              <MultiSelectField
                label="Status dos veículos"
                options={vehicleStatusOptions}
                selectedIds={selectedVehicleStatuses}
                onChange={(value) =>
                  setSelectedVehicleStatuses(value as VehicleStatusFilter[])
                }
                placeholder="Selecione os status"
                openOnClick
                keepOpenOnSelect
              />
            </div>
          ) : null}

          <div className="lg:col-span-1">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Formato</label>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="PDF">PDF</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <FileDown size={16} />
            Exportar {format}
          </button>
        </div>
      </div>
    </div>
  );
}