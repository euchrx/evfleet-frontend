import { useEffect, useMemo, useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import { getBranches } from "../../services/branches";
import { getDebts } from "../../services/debts";
import { getDrivers } from "../../services/drivers";
import { getFuelRecords, type FuelRecord } from "../../services/fuelRecords";
import { getMaintenanceRecords } from "../../services/maintenanceRecords";
import { getVehicles } from "../../services/vehicles";
import type { Branch } from "../../types/branch";
import type { Debt } from "../../types/debt";
import type { Driver } from "../../types/driver";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";

type ReportModule = "FUEL" | "MAINTENANCE" | "DEBTS";
type VehicleTypeFilter = "LIGHT" | "HEAVY";
type SelectOption = { id: string; label: string };

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
    [options, selectedIds]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => {
      if (selectedIds.includes(option.id)) return false;
      if (!normalized) return true;
      return option.label.toLowerCase().includes(normalized);
    });
  }, [options, selectedIds, query]);

  function addItem(id: string) {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(true);
  }

  function removeItem(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <div
          className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200"
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
                    removeItem(item.id);
                  }}
                  className="cursor-pointer text-slate-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setTimeout(() => setOpen(false), 120);
              }}
              placeholder={selectedOptions.length === 0 ? placeholder : "Digite para buscar..."}
              className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
        </div>

        {open && filteredOptions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
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
    </div>
  );
}

export function ReportsPage() {
  const { selectedBranchId } = useBranch();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<VehicleTypeFilter[]>([]);
  const [selectedModules, setSelectedModules] = useState<ReportModule[]>([
    "FUEL",
    "MAINTENANCE",
    "DEBTS",
  ]);
  const [plateFilter, setPlateFilter] = useState("");
  const [format, setFormat] = useState("PDF");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [branchesData, vehiclesData, driversData, fuelData, maintenanceData, debtsData] =
        await Promise.all([
          getBranches(),
          getVehicles(),
          getDrivers(),
          getFuelRecords(),
          getMaintenanceRecords(),
          getDebts(),
        ]);

      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setFuelRecords(Array.isArray(fuelData) ? fuelData : []);
      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
      setErrorMessage("Não foi possível carregar os dados para geração dos relatórios.");
    } finally {
      setLoading(false);
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

  const branchOptions = useMemo<SelectOption[]>(
    () =>
      [...branches]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((branch) => ({ id: branch.id, label: branch.name })),
    [branches]
  );

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
      availableVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`,
      })),
    [availableVehicles]
  );

  const driverOptions = useMemo<SelectOption[]>(
    () =>
      [...drivers]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((driver) => ({ id: driver.id, label: driver.name })),
    [drivers]
  );

  const vehicleTypeOptions: SelectOption[] = [
    { id: "LIGHT", label: "Leve" },
    { id: "HEAVY", label: "Pesado" },
  ];

  const moduleOptions: SelectOption[] = [
    { id: "FUEL", label: "Abastecimentos" },
    { id: "MAINTENANCE", label: "Manutenções" },
    { id: "DEBTS", label: "Débitos e multas" },
  ];

  const filteredData = useMemo(() => {
    const vehicleByBranch = availableVehicles.filter((vehicle) =>
      selectedBranchIds.length > 0 ? selectedBranchIds.includes(vehicle.branchId) : true
    );

    const vehicleByType = vehicleByBranch.filter((vehicle) =>
      selectedVehicleTypes.length > 0
        ? selectedVehicleTypes.includes(vehicle.vehicleType as VehicleTypeFilter)
        : true
    );

    const vehicleByPlate = vehicleByType.filter((vehicle) =>
      plateFilter.trim()
        ? vehicle.plate.toLowerCase().includes(plateFilter.trim().toLowerCase())
        : true
    );

    const vehiclesFinal = vehicleByPlate.filter((vehicle) =>
      selectedVehicleIds.length > 0 ? selectedVehicleIds.includes(vehicle.id) : true
    );

    const selectedVehicleSet = new Set(vehiclesFinal.map((vehicle) => vehicle.id));
    const selectedDriversSet = new Set(selectedDriverIds);

    const start = parseDateSafe(startDate);
    const end = parseDateSafe(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const inRange = (dateValue: string) => {
      const date = parseDateSafe(dateValue);
      if (Number.isNaN(date.getTime())) return false;
      return date >= start && date <= end;
    };

    const fuel = fuelRecords.filter((item) => {
      if (!selectedVehicleSet.has(item.vehicleId)) return false;
      if (!inRange(item.fuelDate)) return false;
      if (selectedDriversSet.size === 0) return true;
      return item.driverId ? selectedDriversSet.has(item.driverId) : false;
    });

    const maintenance = maintenanceRecords.filter((item) => {
      if (!selectedVehicleSet.has(item.vehicleId)) return false;
      if (!inRange(item.maintenanceDate)) return false;
      return true;
    });

    const debtsFiltered = debts.filter((item) => {
      if (!selectedVehicleSet.has(item.vehicleId)) return false;
      if (!inRange(item.debtDate)) return false;
      return true;
    });

    return {
      vehicles: vehiclesFinal,
      fuel,
      maintenance,
      debts: debtsFiltered,
    };
  }, [
    availableVehicles,
    selectedBranchIds,
    selectedVehicleTypes,
    selectedVehicleIds,
    selectedDriverIds,
    plateFilter,
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
    return {
      fuelCost,
      maintenanceCost,
      debtsCost,
      total: fuelCost + maintenanceCost + debtsCost,
    };
  }, [filteredData]);

  function exportReport() {
    const generatedAt = new Date().toLocaleString("pt-BR");
    const selectedBranchNames = branchOptions
      .filter((option) => selectedBranchIds.includes(option.id))
      .map((option) => option.label);
    const selectedModulesLabels = moduleOptions
      .filter((option) => selectedModules.includes(option.id as ReportModule))
      .map((option) => option.label);
    const selectedTypesLabels = vehicleTypeOptions
      .filter((option) => selectedVehicleTypes.includes(option.id as VehicleTypeFilter))
      .map((option) => option.label);

    const showFuel = selectedModules.length === 0 || selectedModules.includes("FUEL");
    const showMaintenance =
      selectedModules.length === 0 || selectedModules.includes("MAINTENANCE");
    const showDebts = selectedModules.length === 0 || selectedModules.includes("DEBTS");

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
          <div class="meta">Gerado em: ${generatedAt}</div>
          <div class="meta">Formato: ${escapeHtml(format)}</div>
          <div class="meta">Módulos: ${escapeHtml(selectedModulesLabels.join(", ") || "Todos")}</div>
          <div class="meta">Categoria de veículo: ${escapeHtml(selectedTypesLabels.join(", ") || "Todas")}</div>
          <div class="meta">Período: ${escapeHtml(formatDate(startDate))} até ${escapeHtml(formatDate(endDate))}</div>
          <div class="meta">Estabelecimentos: ${escapeHtml(selectedBranchNames.join(", ") || "Todos")}</div>
          <div class="meta">Placa (filtro): ${escapeHtml(plateFilter || "Todas")}</div>
          <div class="meta">Total despesas: ${metrics.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>

          ${
            showFuel
              ? `<h2>Abastecimentos (${filteredData.fuel.length})</h2>
                 <table>
                   <thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Litros</th><th>Valor</th><th>KM</th></tr></thead>
                   <tbody>
                     ${filteredData.fuel
                       .map(
                         (item) =>
                           `<tr><td>${escapeHtml(formatDate(item.fuelDate))}</td><td>${escapeHtml(
                             `${item.vehicle?.brand || ""} ${item.vehicle?.model || ""} (${item.vehicle?.plate || item.vehicleId})`
                           )}</td><td>${escapeHtml(item.driver?.name || "-")}</td><td>${(item.liters || 0).toFixed(
                             2
                           )}</td><td>${toCurrency(item.totalValue || 0)}</td><td>${(item.km || 0).toLocaleString(
                             "pt-BR"
                           )}</td></tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>`
              : ""
          }

          ${
            showMaintenance
              ? `<h2>Manutenções (${filteredData.maintenance.length})</h2>
                 <table>
                   <thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Status</th><th>Custo</th><th>KM</th></tr></thead>
                   <tbody>
                     ${filteredData.maintenance
                       .map(
                         (item) =>
                           `<tr><td>${escapeHtml(formatDate(item.maintenanceDate))}</td><td>${escapeHtml(
                             `${item.vehicle?.brand || ""} ${item.vehicle?.model || ""} (${item.vehicle?.plate || item.vehicleId})`
                           )}</td><td>${escapeHtml(labelMaintenanceType(item.type))}</td><td>${escapeHtml(
                             item.status || "-"
                           )}</td><td>${toCurrency(item.cost || 0)}</td><td>${(item.km || 0).toLocaleString(
                             "pt-BR"
                           )}</td></tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>`
              : ""
          }

          ${
            showDebts
              ? `<h2>Débitos e multas (${filteredData.debts.length})</h2>
                 <table>
                   <thead><tr><th>Data</th><th>Veículo</th><th>Categoria</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead>
                   <tbody>
                     ${filteredData.debts
                       .map(
                         (item) =>
                           `<tr><td>${escapeHtml(formatDate(item.debtDate))}</td><td>${escapeHtml(
                             `${item.vehicle?.brand || ""} ${item.vehicle?.model || ""} (${item.vehicle?.plate || item.vehicleId})`
                           )}</td><td>${escapeHtml(labelDebtCategory(item.category))}</td><td>${escapeHtml(
                             item.description || "-"
                           )}</td><td>${escapeHtml(item.status || "-")}</td><td>${toCurrency(item.amount || 0)}</td></tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>`
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
          Confronte dados da frota por período, filial, veículo e motorista.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <MultiSelectField
              label="Estabelecimento"
              options={branchOptions}
              selectedIds={selectedBranchIds}
              onChange={setSelectedBranchIds}
              placeholder="Digite para buscar estabelecimento"
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
            <label className="mb-1 block text-sm font-semibold text-slate-700">Placa</label>
            <input
              value={plateFilter}
              onChange={(event) => setPlateFilter(event.target.value.toUpperCase())}
              placeholder="AAA1234 ou AAA1A34"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <MultiSelectField
              label="Veículos"
              options={vehicleOptions}
              selectedIds={selectedVehicleIds}
              onChange={setSelectedVehicleIds}
              placeholder="Digite para buscar veículo"
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
              onChange={(value) => setSelectedVehicleTypes(value as VehicleTypeFilter[])}
              placeholder="Selecione Leve/Pesado"
            />
          </div>

          <div>
            <MultiSelectField
              label="Módulos"
              options={moduleOptions}
              selectedIds={selectedModules}
              onChange={(value) => setSelectedModules(value as ReportModule[])}
              placeholder="Selecione os módulos"
            />
          </div>

          <div>
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
            onClick={loadData}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Atualizar dados
          </button>
          <button
            onClick={exportReport}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <FileDown size={16} />
            Exportar {format}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total despesas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{toCurrency(metrics.total)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Abastecimentos
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{filteredData.fuel.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manutenções
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {filteredData.maintenance.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Débitos e multas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{filteredData.debts.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        {loading
          ? "Sincronizando dados para geração dos relatórios..."
          : "Use os campos multi-select para cruzar 1, 2 ou mais veículos, motoristas, tipos e módulos."}
      </div>
    </div>
  );
}
