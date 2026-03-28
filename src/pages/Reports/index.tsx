import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { getDebts } from "../../services/debts";
import { getDrivers } from "../../services/drivers";
import { getFuelRecords, type FuelRecord } from "../../services/fuelRecords";
import { getMaintenanceRecords } from "../../services/maintenanceRecords";
import { getVehicles } from "../../services/vehicles";
import type { Debt } from "../../types/debt";
import type { Driver } from "../../types/driver";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type ReportModule = "VEHICLES" | "FUEL" | "MAINTENANCE" | "DEBTS";
type VehicleTypeFilter = "LIGHT" | "HEAVY";
type VehicleStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "SOLD";
type SelectOption = { id: string; label: string };

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateSafe(dateValue: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateValue);
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
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
    [options, selectedIds]
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
    if (disabled) return;
    if (selectedIds.includes(id)) return;
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
                  className={`text-slate-500 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-red-600"}`}
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

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<VehicleTypeFilter[]>([]);
  const [selectedVehicleStatus, setSelectedVehicleStatus] =
    useState<VehicleStatusFilter>("ALL");
  const [selectedModules, setSelectedModules] = useState<ReportModule[]>([
    "VEHICLES",
    "FUEL",
    "MAINTENANCE",
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
      const [vehiclesData, driversData, fuelData, maintenanceData, debtsData] =
        await Promise.all([
          getVehicles(),
          getDrivers(),
          getFuelRecords(),
          getMaintenanceRecords(),
          getDebts(),
        ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setFuelRecords(Array.isArray(fuelData) ? fuelData : []);
      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
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
      current.includes(selectedBranchId) ? current : [...current, selectedBranchId]
    );
  }, [selectedBranchId]);

  const availableVehicles = useMemo(() => {
    const scoped = selectedBranchId
      ? vehicles.filter((item) => item.branchId === selectedBranchId)
      : vehicles;
    return [...scoped].sort((a, b) =>
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR")
    );
  }, [vehicles, selectedBranchId]);

  const vehicleOptions = useMemo<SelectOption[]>(
    () =>
      availableVehicles.map((item) => ({
        id: item.id,
        label: formatVehicleLabel(item),
      })),
    [availableVehicles]
  );
  const driverOptions = useMemo<SelectOption[]>(
    () => drivers.map((item) => ({ id: item.id, label: item.name })),
    [drivers]
  );

  const vehicleTypeOptions: SelectOption[] = [
    { id: "LIGHT", label: "Leve" },
    { id: "HEAVY", label: "Pesado" },
  ];
  const moduleOptions: SelectOption[] = [
    { id: "VEHICLES", label: "Veículos" },
    { id: "FUEL", label: "Abastecimentos" },
    { id: "MAINTENANCE", label: "Manutenções" },
    { id: "DEBTS", label: "Débitos e multas" },
  ];

  const filteredData = useMemo(() => {
    const start = parseDateSafe(startDate);
    const end = parseDateSafe(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const inRange = (dateValue: string) => {
      const date = parseDateSafe(dateValue);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    };

    const baseVehicles = availableVehicles.filter((vehicle) =>
      selectedBranchIds.length > 0 ? selectedBranchIds.includes(vehicle.branchId) : true
    );
    const byType = baseVehicles.filter((vehicle) =>
      selectedVehicleTypes.length > 0
        ? selectedVehicleTypes.includes(vehicle.vehicleType as VehicleTypeFilter)
        : true
    );
    const byStatus = byType.filter((vehicle) => {
      if (selectedVehicleStatus === "ALL") return true;
      if (selectedVehicleStatus === "INACTIVE") return String(vehicle.status || "") === "INACTIVE";
      return String(vehicle.status || "") === selectedVehicleStatus;
    });
    const vehiclesFinal = byStatus.filter((vehicle) =>
      selectedVehicleIds.length > 0 ? selectedVehicleIds.includes(vehicle.id) : true
    );
    const vehicleSet = new Set(vehiclesFinal.map((item) => item.id));
    const driverSet = new Set(selectedDriverIds);

    const fuel = fuelRecords.filter((item) => {
      if (!vehicleSet.has(item.vehicleId) || !inRange(item.fuelDate)) return false;
      if (driverSet.size === 0) return true;
      return item.driverId ? driverSet.has(item.driverId) : false;
    });

    const maintenance = maintenanceRecords.filter(
      (item) => vehicleSet.has(item.vehicleId) && inRange(item.maintenanceDate)
    );
    const debtsFiltered = debts.filter(
      (item) => vehicleSet.has(item.vehicleId) && inRange(item.debtDate)
    );

    return { vehicles: vehiclesFinal, fuel, maintenance, debts: debtsFiltered };
  }, [
    availableVehicles,
    selectedBranchIds,
    selectedVehicleTypes,
    selectedVehicleStatus,
    selectedVehicleIds,
    selectedDriverIds,
    startDate,
    endDate,
    fuelRecords,
    maintenanceRecords,
    debts,
  ]);

  const metrics = useMemo(() => {
    const fuelCost = filteredData.fuel.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const maintenanceCost = filteredData.maintenance.reduce((sum, item) => sum + (item.cost || 0), 0);
    const debtsCost = filteredData.debts.reduce((sum, item) => sum + (item.amount || 0), 0);
    return { total: fuelCost + maintenanceCost + debtsCost };
  }, [filteredData]);

  const vehicleStatusMetrics = useMemo(() => {
    const source = filteredData.vehicles;
    return {
      total: source.length,
      active: source.filter((item) => item.status === "ACTIVE").length,
      inactive: source.filter((item) => String(item.status || "") === "INACTIVE").length,
      maintenance: source.filter((item) => item.status === "MAINTENANCE").length,
      sold: source.filter((item) => item.status === "SOLD").length,
    };
  }, [filteredData.vehicles]);

  function vehicleStatusLabel(value?: string) {
    if (value === "ACTIVE") return "Ativo";
    if (value === "INACTIVE") return "Inativo";
    if (value === "MAINTENANCE") return "Em manutenção";
    if (value === "SOLD") return "Vendido";
    return value || "-";
  }

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
    const showMaintenance = selectedModules.includes("MAINTENANCE");
    const showDebts = selectedModules.includes("DEBTS");

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
          </style>
        </head>
        <body>
          <h1>Relatório operacional</h1>
          <div class="meta">Período: ${escapeHtml(formatDate(startDate))} até ${escapeHtml(formatDate(endDate))}</div>
          <div class="meta">Total de despesas: ${toCurrency(metrics.total)}</div>
          <div class="meta">Status de veículos: ${escapeHtml(selectedVehicleStatus === "ALL" ? "Todos os status" : vehicleStatusLabel(selectedVehicleStatus))}</div>

          ${
            showVehicles
              ? `<h2>Veículos (${filteredData.vehicles.length})</h2>
                 <table><thead><tr><th>Placa</th><th>Veículo</th><th>Categoria</th><th>Tipo</th><th>Status</th></tr></thead>
                 <tbody>${filteredData.vehicles
                   .map(
                     (item) =>
                       `<tr><td>${escapeHtml(item.plate || "-")}</td><td>${escapeHtml(
                         `${item.brand || ""} ${item.model || ""}`.trim() || "-"
                       )}</td><td>${escapeHtml(item.category || "-")}</td><td>${escapeHtml(
                         item.vehicleType || "-"
                       )}</td><td>${escapeHtml(vehicleStatusLabel(item.status))}</td></tr>`
                   )
                   .join("")}</tbody></table>`
              : ""
          }

          ${
            showFuel
              ? `<h2>Abastecimentos (${filteredData.fuel.length})</h2>
                 <table><thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Litros</th><th>Valor</th><th>KM</th></tr></thead>
                 <tbody>${filteredData.fuel
                   .map(
                     (item) =>
                       `<tr><td>${escapeHtml(formatDate(item.fuelDate))}</td><td>${escapeHtml(
                         `${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`
                       )}</td><td>${escapeHtml(item.driver?.name || "-")}</td><td>${(item.liters || 0).toFixed(
                         2
                       )}</td><td>${toCurrency(item.totalValue || 0)}</td><td>${(item.km || 0).toLocaleString(
                         "pt-BR"
                       )}</td></tr>`
                   )
                   .join("")}</tbody></table>`
              : ""
          }
          ${
            showMaintenance
              ? `<h2>Manutenções (${filteredData.maintenance.length})</h2>
                 <table><thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Status</th><th>Custo</th><th>KM</th></tr></thead>
                 <tbody>${filteredData.maintenance
                   .map(
                     (item) =>
                       `<tr><td>${escapeHtml(formatDate(item.maintenanceDate))}</td><td>${escapeHtml(
                         `${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`
                       )}</td><td>${escapeHtml(labelMaintenanceType(item.type))}</td><td>${escapeHtml(
                         item.status || "-"
                       )}</td><td>${toCurrency(item.cost || 0)}</td><td>${(item.km || 0).toLocaleString(
                         "pt-BR"
                       )}</td></tr>`
                   )
                   .join("")}</tbody></table>`
              : ""
          }
          ${
            showDebts
              ? `<h2>Débitos e multas (${filteredData.debts.length})</h2>
                 <table><thead><tr><th>Data</th><th>Veículo</th><th>Categoria</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead>
                 <tbody>${filteredData.debts
                   .map(
                     (item) =>
                       `<tr><td>${escapeHtml(formatDate(item.debtDate))}</td><td>${escapeHtml(
                         `${item.vehicle?.plate || item.vehicleId} - ${item.vehicle?.brand || ""} ${item.vehicle?.model || ""}`
                       )}</td><td>${escapeHtml(labelDebtCategory(item.category))}</td><td>${escapeHtml(
                         item.description || "-"
                       )}</td><td>${escapeHtml(item.status || "-")}</td><td>${toCurrency(item.amount || 0)}</td></tr>`
                   )
                   .join("")}</tbody></table>`
              : ""
          }
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Veículos totais</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{vehicleStatusMetrics.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativos</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{vehicleStatusMetrics.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Inativos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{vehicleStatusMetrics.inactive}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Em manutenção</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{vehicleStatusMetrics.maintenance}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Vendidos</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">{vehicleStatusMetrics.sold}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Status do veículo</label>
            <select
              value={selectedVehicleStatus}
              onChange={(event) => setSelectedVehicleStatus(event.target.value as VehicleStatusFilter)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="MAINTENANCE">Em manutenção</option>
              <option value="SOLD">Vendido</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Estabelecimento</label>
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
