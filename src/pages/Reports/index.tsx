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

type ReportCategory = "ALL" | "FUEL" | "MAINTENANCE" | "DEBTS";

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
  const [plateFilter, setPlateFilter] = useState("");
  const [category, setCategory] = useState<ReportCategory>("ALL");
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

  const availableVehicles = useMemo(() => {
    const scoped = selectedBranchId
      ? vehicles.filter((item) => item.branchId === selectedBranchId)
      : vehicles;
    return [...scoped].sort((a, b) =>
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR")
    );
  }, [vehicles, selectedBranchId]);

  const filteredData = useMemo(() => {
    const vehicleByBranch = availableVehicles.filter((vehicle) =>
      selectedBranchIds.length > 0 ? selectedBranchIds.includes(vehicle.branchId) : true
    );
    const vehicleByPlate = vehicleByBranch.filter((vehicle) =>
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
    const branchNames = branches
      .filter((branch) => selectedBranchIds.includes(branch.id))
      .map((branch) => branch.name);
    const categoryLabel =
      category === "ALL"
        ? "Geral"
        : category === "FUEL"
          ? "Abastecimentos"
          : category === "MAINTENANCE"
            ? "Manutenções"
            : "Débitos e multas";

    const showFuel = category === "ALL" || category === "FUEL";
    const showMaintenance = category === "ALL" || category === "MAINTENANCE";
    const showDebts = category === "ALL" || category === "DEBTS";

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
          <div class="meta">Categoria: ${escapeHtml(categoryLabel)}</div>
          <div class="meta">Período: ${escapeHtml(formatDate(startDate))} até ${escapeHtml(formatDate(endDate))}</div>
          <div class="meta">Estabelecimentos: ${escapeHtml(branchNames.join(", ") || "Todos")}</div>
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
            <label className="mb-1 block text-sm font-semibold text-slate-700">Estabelecimento</label>
            <select
              multiple
              value={selectedBranchIds}
              onChange={(event) =>
                setSelectedBranchIds(Array.from(event.currentTarget.selectedOptions).map((item) => item.value))
              }
              className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data inicial *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data final *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Placa</label>
            <input
              value={plateFilter}
              onChange={(e) => setPlateFilter(e.target.value.toUpperCase())}
              placeholder="AAA1234 ou AAA1A34"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Veículos</label>
            <select
              multiple
              value={selectedVehicleIds}
              onChange={(event) =>
                setSelectedVehicleIds(Array.from(event.currentTarget.selectedOptions).map((item) => item.value))
              }
              className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} ({vehicle.plate})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Motoristas</label>
            <select
              multiple
              value={selectedDriverIds}
              onChange={(event) =>
                setSelectedDriverIds(Array.from(event.currentTarget.selectedOptions).map((item) => item.value))
              }
              className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Geral</option>
              <option value="FUEL">Abastecimentos</option>
              <option value="MAINTENANCE">Manutenções</option>
              <option value="DEBTS">Débitos e multas</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Formato</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total despesas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{toCurrency(metrics.total)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Abastecimentos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{filteredData.fuel.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manutenções</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{filteredData.maintenance.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Débitos e multas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{filteredData.debts.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        {loading
          ? "Sincronizando dados para geração dos relatórios..."
          : "Selecione múltiplos itens com Ctrl (Windows) para confronto entre 2 ou mais veículos e motoristas."}
      </div>
    </div>
  );
}
