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
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type ReportModule =
  | "VEHICLES"
  | "FUEL"
  | "PRODUCTS"
  | "MAINTENANCE"
  | "TIRES"
  | "TRIPS"
  | "DOCUMENTS"
  | "DEBTS";

type VehicleTypeFilter = "LIGHT" | "HEAVY";
type VehicleStatusFilter = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "SOLD";
type SelectOption = { id: string; label: string };

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateSafe(dateValue?: string | null) {
  if (!dateValue) return new Date("");
  const normalized = String(dateValue).trim();
  const calendarDate = normalized.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
    const [year, month, day] = calendarDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(normalized);
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "-";
  const date = parseDateSafe(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function escapeHtml(value: string) {
  return value
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

function labelVehicleStatus(value?: string) {
  if (value === "ACTIVE") return "Ativo";
  if (value === "INACTIVE") return "Inativo";
  if (value === "MAINTENANCE") return "Em manutenção";
  if (value === "SOLD") return "Vendido";
  return value || "-";
}

function labelTripStatus(value?: string) {
  if (value === "OPEN") return "Aberta";
  if (value === "COMPLETED") return "Concluída";
  if (value === "CANCELLED") return "Cancelada";
  return value || "-";
}

function labelDocumentType(value?: string) {
  if (value === "LICENSING") return "Licenciamento";
  if (value === "INSURANCE") return "Seguro";
  if (value === "IPVA") return "IPVA";
  if (value === "LEASING_CONTRACT") return "Contrato";
  if (value === "INSPECTION") return "Inspeção";
  if (value === "OTHER") return "Outro";
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
  const parts = [vehicle.plate, vehicle.brand, vehicle.model]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return parts.join(" • ") || fallback || "-";
}

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  error,
  disabled = false,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((item) => {
      if (selectedIds.includes(item.id)) return false;
      if (!normalized) return true;
      return item.label.toLowerCase().includes(normalized);
    });
  }, [options, selectedIds, query]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
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
          className={`min-h-[44px] w-full rounded-xl border bg-white px-2.5 py-2 text-sm focus-within:ring-2 ${
            error
              ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-200"
              : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
          }`}
          onClick={() => setOpen(true)}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {item.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!disabled) onChange(selectedIds.filter((id) => id !== item.id));
                  }}
                  className={`text-slate-500 ${
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-red-600"
                  }`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={query}
              onChange={(event) => {
                if (disabled) return;
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (!disabled) setOpen(true);
              }}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={selectedOptions.length === 0 ? placeholder : "Digite para buscar..."}
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
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<VehicleTypeFilter[]>([]);
  const [selectedVehicleStatuses, setSelectedVehicleStatuses] = useState<VehicleStatusFilter[]>([
    "ACTIVE",
    "INACTIVE",
    "MAINTENANCE",
    "SOLD",
  ]);
  const [selectedModules, setSelectedModules] = useState<ReportModule[]>([
    "VEHICLES",
    "FUEL",
    "PRODUCTS",
    "MAINTENANCE",
    "TIRES",
    "TRIPS",
    "DOCUMENTS",
    "DEBTS",
  ]);
  const [fieldErrors, setFieldErrors] = useState<{
    modules?: string;
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
    loadData();
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
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR"),
    );
  }, [vehicles, selectedBranchId]);

  const vehicleOptions = useMemo<SelectOption[]>(
    () =>
      availableVehicles.map((item) => ({
        id: item.id,
        label: formatVehicleLabel(item),
      })),
    [availableVehicles],
  );

  const driverOptions = useMemo<SelectOption[]>(
    () => drivers.map((item) => ({ id: item.id, label: item.name })),
    [drivers],
  );

  const vehicleTypeOptions: SelectOption[] = [
    { id: "LIGHT", label: "Leve" },
    { id: "HEAVY", label: "Pesado" },
  ];

  const moduleOptions: SelectOption[] = [
    { id: "VEHICLES", label: "Veículos" },
    { id: "FUEL", label: "Abastecimentos" },
    { id: "PRODUCTS", label: "Produtos" },
    { id: "MAINTENANCE", label: "Manutenções" },
    { id: "TIRES", label: "Gestão de pneus" },
    { id: "TRIPS", label: "Gestão de viagens" },
    { id: "DOCUMENTS", label: "Gestão de documentos" },
    { id: "DEBTS", label: "Débitos e multas" },
  ];

  const vehicleStatusOptions: SelectOption[] = [
    { id: "ACTIVE", label: "Ativos" },
    { id: "INACTIVE", label: "Inativos" },
    { id: "MAINTENANCE", label: "Em manutenção" },
    { id: "SOLD", label: "Vendidos" },
  ];

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

    const byType = baseVehicles.filter((vehicle) =>
      selectedVehicleTypes.length > 0
        ? selectedVehicleTypes.includes(vehicle.vehicleType as VehicleTypeFilter)
        : true,
    );

    const byStatus = byType.filter((vehicle) =>
      selectedVehicleStatuses.length > 0
        ? selectedVehicleStatuses.includes(String(vehicle.status || "") as VehicleStatusFilter)
        : true,
    );

    const vehiclesFinal = byStatus.filter((vehicle) =>
      selectedVehicleIds.length > 0 ? selectedVehicleIds.includes(vehicle.id) : true,
    );

    const vehicleSet = new Set(vehiclesFinal.map((item) => item.id));
    const driverSet = new Set(selectedDriverIds);

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

    const productsFiltered = products.filter((item) =>
      inRange(item.retailProductImport?.issuedAt || item.createdAt),
    );

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
      if (!vehicleSet.has(item.vehicleId)) return false;
      return inRange(item.expiryDate || item.issueDate || item.createdAt);
    });

    return {
      vehicles: vehiclesFinal,
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
    selectedBranchIds,
    selectedVehicleTypes,
    selectedVehicleStatuses,
    selectedVehicleIds,
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
    const nextErrors: { modules?: string; vehicleTypes?: string } = {};
    if (selectedModules.length === 0) nextErrors.modules = "Selecione ao menos um módulo.";
    if (selectedVehicleTypes.length === 0) {
      nextErrors.vehicleTypes = "Selecione ao menos uma categoria de veículo.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const showVehicles = selectedModules.includes("VEHICLES");
    const showFuel = selectedModules.includes("FUEL");
    const showProducts = selectedModules.includes("PRODUCTS");
    const showMaintenance = selectedModules.includes("MAINTENANCE");
    const showTires = selectedModules.includes("TIRES");
    const showTrips = selectedModules.includes("TRIPS");
    const showDocuments = selectedModules.includes("DOCUMENTS");
    const showDebts = selectedModules.includes("DEBTS");

    const vehiclesModuleTotal = 0;
    const fuelModuleTotal = filteredData.fuel.reduce((sum, item) => sum + Number(item.totalValue || 0), 0);
    const productsModuleTotal = filteredData.products.reduce((sum, item) => sum + toNumber(item.totalValue), 0);
    const maintenanceModuleTotal = filteredData.maintenance.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const tiresModuleTotal = filteredData.tires.reduce((sum, item) => sum + Number(item.purchaseCost || 0), 0);
    const tripsDistanceTotal = filteredData.trips.reduce((sum, item) => {
      if (typeof item.returnKm === "number" && item.returnKm >= item.departureKm) {
        return sum + (item.returnKm - item.departureKm);
      }
      return sum;
    }, 0);
    const debtsModuleTotal = filteredData.debts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalGeral =
      (showVehicles ? vehiclesModuleTotal : 0) +
      (showFuel ? fuelModuleTotal : 0) +
      (showProducts ? productsModuleTotal : 0) +
      (showMaintenance ? maintenanceModuleTotal : 0) +
      (showTires ? tiresModuleTotal : 0) +
      (showDebts ? debtsModuleTotal : 0);

    const selectedVehicleStatusesLabel =
      selectedVehicleStatuses.length > 0
        ? selectedVehicleStatuses.map((status) => labelVehicleStatus(status)).join(", ")
        : "Todos os status";

    const sections = [
      {
        enabled: showVehicles,
        count: filteredData.vehicles.length,
        html: `<h2>Veículos (${filteredData.vehicles.length})</h2>
          <table><thead><tr><th>Placa</th><th>Veículo</th><th>Categoria</th><th>Tipo</th><th>Status</th></tr></thead>
          <tbody>${filteredData.vehicles
            .map(
              (item) =>
                `<tr><td>${escapeHtml(item.plate || "-")}</td><td>${escapeHtml(
                  `${item.brand || ""} ${item.model || ""}`.trim() || "-"
                )}</td><td>${escapeHtml(labelVehicleCategory(item.category))}</td><td>${escapeHtml(
                  labelVehicleType(item.vehicleType),
                )}</td><td>${escapeHtml(labelVehicleStatus(item.status))}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Veículos: ${toCurrency(vehiclesModuleTotal)}</div>`,
      },
      {
        enabled: showFuel,
        count: filteredData.fuel.length,
        html: `<h2>Abastecimentos (${filteredData.fuel.length})</h2>
          <table><thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Litros</th><th>Valor</th><th>KM</th></tr></thead>
          <tbody>${filteredData.fuel
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.fuelDate))}</td><td>${escapeHtml(
                  `${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`.trim(),
                )}</td><td>${escapeHtml(item.driver?.name || "-")}</td><td>${toNumber(item.liters).toFixed(2)}</td><td>${toCurrency(item.totalValue || 0)}</td><td>${toNumber(item.km).toLocaleString("pt-BR")}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Abastecimentos: ${toCurrency(fuelModuleTotal)}</div>`,
      },
      {
        enabled: showProducts,
        count: filteredData.products.length,
        html: `<h2>Produtos (${filteredData.products.length})</h2>
          <table><thead><tr><th>Data</th><th>Produto</th><th>Categoria</th><th>Fornecedor</th><th>NF-e</th><th>Quantidade</th><th>Valor total</th></tr></thead>
          <tbody>${filteredData.products
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.retailProductImport?.issuedAt || item.createdAt))}</td><td>${escapeHtml(item.description || "-")}</td><td>${escapeHtml(labelProductCategory(item.category))}</td><td>${escapeHtml(item.retailProductImport?.supplierName || "-")}</td><td>${escapeHtml(item.retailProductImport?.invoiceNumber || "-")}</td><td>${toNumber(item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>${toCurrency(toNumber(item.totalValue))}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Produtos: ${toCurrency(productsModuleTotal)}</div>`,
      },
      {
        enabled: showMaintenance,
        count: filteredData.maintenance.length,
        html: `<h2>Manutenções (${filteredData.maintenance.length})</h2>
          <table><thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Status</th><th>Custo</th><th>KM</th></tr></thead>
          <tbody>${filteredData.maintenance
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.maintenanceDate))}</td><td>${escapeHtml(`${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`.trim())}</td><td>${escapeHtml(labelMaintenanceType(item.type))}</td><td>${escapeHtml(labelMaintenanceStatus(item.status))}</td><td>${toCurrency(item.cost || 0)}</td><td>${toNumber(item.km).toLocaleString("pt-BR")}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Manutenções: ${toCurrency(maintenanceModuleTotal)}</div>`,
      },
      {
        enabled: showTires,
        count: filteredData.tires.length,
        html: `<h2>Gestão de pneus (${filteredData.tires.length})</h2>
          <table><thead><tr><th>Data</th><th>Veículo</th><th>Pneu</th><th>Posição</th><th>Status</th><th>Custo</th></tr></thead>
          <tbody>${filteredData.tires
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.purchaseDate || item.installedAt || item.createdAt))}</td><td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId || "-"))}</td><td>${escapeHtml(`${item.brand} ${item.model}`)}</td><td>${escapeHtml(`${item.axlePosition || "-"}${item.wheelPosition ? ` | ${item.wheelPosition}` : ""}`)}</td><td>${escapeHtml(labelTireStatus(item.status))}</td><td>${toCurrency(item.purchaseCost || 0)}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Gestão de pneus: ${toCurrency(tiresModuleTotal)}</div>`,
      },
      {
        enabled: showTrips,
        count: filteredData.trips.length,
        html: `<h2>Gestão de viagens (${filteredData.trips.length})</h2>
          <table><thead><tr><th>Saída</th><th>Veículo</th><th>Motorista</th><th>Rota</th><th>Status</th><th>KM rodados</th></tr></thead>
          <tbody>${filteredData.trips
            .map((item) => {
              const kmRodados = typeof item.returnKm === "number" && item.returnKm >= item.departureKm ? item.returnKm - item.departureKm : 0;
              return `<tr><td>${escapeHtml(formatDate(item.departureAt))}</td><td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td><td>${escapeHtml(item.driver?.name || "-")}</td><td>${escapeHtml(`${item.origin} → ${item.destination}`)}</td><td>${escapeHtml(labelTripStatus(item.status))}</td><td>${kmRodados.toLocaleString("pt-BR")}</td></tr>`;
            })
            .join("")}</tbody></table>
          <div class="module-total">Total de km em Gestão de viagens: ${tripsDistanceTotal.toLocaleString("pt-BR")} km</div>`,
      },
      {
        enabled: showDocuments,
        count: filteredData.documents.length,
        html: `<h2>Gestão de documentos (${filteredData.documents.length})</h2>
          <table><thead><tr><th>Data</th><th>Veículo</th><th>Documento</th><th>Tipo</th><th>Status</th><th>Emissor</th></tr></thead>
          <tbody>${filteredData.documents
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.expiryDate || item.issueDate || item.createdAt))}</td><td>${escapeHtml(formatVehicleDisplay(item.vehicle, item.vehicleId))}</td><td>${escapeHtml(item.name || "-")}</td><td>${escapeHtml(labelDocumentType(item.type))}</td><td>${escapeHtml(labelDocumentStatus(item.status))}</td><td>${escapeHtml(item.issuer || "-")}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Gestão de documentos: ${filteredData.documents.length} documento(s)</div>`,
      },
      {
        enabled: showDebts,
        count: filteredData.debts.length,
        html: `<h2>Débitos e multas (${filteredData.debts.length})</h2>
          <table><thead><tr><th>Data</th><th>Veículo</th><th>Categoria</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>${filteredData.debts
            .map(
              (item) =>
                `<tr><td>${escapeHtml(formatDate(item.dueDate || item.debtDate))}</td><td>${escapeHtml(`${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`.trim())}</td><td>${escapeHtml(labelDebtCategory(item.category))}</td><td>${escapeHtml(item.description || "-")}</td><td>${escapeHtml(labelDebtStatus(item.status))}</td><td>${toCurrency(item.amount || 0)}</td></tr>`,
            )
            .join("")}</tbody></table>
          <div class="module-total">Total do módulo Débitos e multas: ${toCurrency(debtsModuleTotal)}</div>`,
      },
    ];

    const moduleSections = sections
      .filter((section) => section.enabled)
      .sort((a, b) => {
        const aZero = a.count === 0 ? 1 : 0;
        const bZero = b.count === 0 ? 1 : 0;
        if (aZero !== bZero) return aZero - bZero;
        return b.count - a.count;
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
          <div class="meta">Período: ${escapeHtml(formatDate(startDate))} até ${escapeHtml(formatDate(endDate))}</div>
          ${showVehicles ? `<div class="meta">Status de veículos: ${escapeHtml(selectedVehicleStatusesLabel)}</div>` : ""}
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

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data inicial *</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data final *</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <MultiSelectField
              label="Veículos"
              options={vehicleOptions}
              selectedIds={selectedVehicleIds}
              onChange={setSelectedVehicleIds}
              placeholder="Buscar por placa, marca ou modelo"
            />
          </div>

          <div>
            <MultiSelectField
              label="Motoristas"
              options={driverOptions}
              selectedIds={selectedDriverIds}
              onChange={setSelectedDriverIds}
              placeholder="Digite para buscar motorista"
            />
          </div>

          <div>
            <MultiSelectField
              label="Categoria de veículo"
              options={vehicleTypeOptions}
              selectedIds={selectedVehicleTypes}
              onChange={(value) => {
                setSelectedVehicleTypes(value as VehicleTypeFilter[]);
                setFieldErrors((prev) => ({ ...prev, vehicleTypes: undefined }));
              }}
              placeholder="Selecione Leve/Pesado"
              error={fieldErrors.vehicleTypes}
            />
          </div>

          <div className="lg:col-span-3">
            <MultiSelectField
              label="Módulos"
              options={moduleOptions}
              selectedIds={selectedModules}
              onChange={(value) => {
                setSelectedModules(value as ReportModule[]);
                setFieldErrors((prev) => ({ ...prev, modules: undefined }));
              }}
              placeholder="Selecione os módulos"
              error={fieldErrors.modules}
            />
          </div>

          {selectedModules.includes("VEHICLES") ? (
            <div className="lg:col-span-3">
              <MultiSelectField
                label="Status dos veículos"
                options={vehicleStatusOptions}
                selectedIds={selectedVehicleStatuses}
                onChange={(value) => setSelectedVehicleStatuses(value as VehicleStatusFilter[])}
                placeholder="Selecione os status"
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
