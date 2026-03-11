import { useEffect, useMemo, useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import type { Debt } from "../../types/debt";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { getDebts } from "../../services/debts";
import { getFuelRecords, type FuelRecord } from "../../services/fuelRecords";
import { getMaintenanceRecords } from "../../services/maintenanceRecords";
import { getVehicles } from "../../services/vehicles";

type CostPeriod = "CURRENT_MONTH" | "LAST_30_DAYS" | "CURRENT_YEAR" | "ALL";

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

function isInPeriod(dateValue: string, period: CostPeriod) {
  const date = parseDateSafe(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  if (period === "ALL") return true;
  if (period === "CURRENT_YEAR") return date.getFullYear() === now.getFullYear();
  if (period === "CURRENT_MONTH") {
    return (
      date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    );
  }

  const initial = new Date(now);
  initial.setHours(0, 0, 0, 0);
  initial.setDate(initial.getDate() - 29);
  return date >= initial && date <= now;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function ReportsPage() {
  const { selectedBranch, selectedBranchId } = useBranch();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [costPeriod, setCostPeriod] = useState<CostPeriod>("CURRENT_YEAR");
  const [selectedVehicleId, setSelectedVehicleId] = useState("ALL");
  const [format, setFormat] = useState("PDF");

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [vehiclesData, maintenanceData, debtsData, fuelData] = await Promise.all([
        getVehicles(),
        getMaintenanceRecords(),
        getDebts(),
        getFuelRecords(),
      ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setFuelRecords(Array.isArray(fuelData) ? fuelData : []);
    } catch (error) {
      console.error("Erro ao carregar dados para relatório:", error);
      setErrorMessage("Não foi possível carregar os dados do dashboard para exportação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const vehiclesFiltered = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;

    const vehicleIds = new Set(vehiclesFiltered.map((vehicle) => vehicle.id));
    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleId === "ALL" || vehicleId === selectedVehicleId;

    const maintenance = maintenanceRecords.filter(
      (record) =>
        vehicleIds.has(record.vehicleId) &&
        isVehicleMatch(record.vehicleId) &&
        isInPeriod(record.maintenanceDate, costPeriod)
    );

    const debtsFiltered = debts.filter(
      (debt) =>
        vehicleIds.has(debt.vehicleId) &&
        isVehicleMatch(debt.vehicleId) &&
        isInPeriod(debt.debtDate, costPeriod)
    );

    const fuel = fuelRecords.filter(
      (record) =>
        vehicleIds.has(record.vehicleId) &&
        isVehicleMatch(record.vehicleId) &&
        isInPeriod(record.fuelDate, costPeriod)
    );

    return {
      vehicles: vehiclesFiltered,
      maintenance,
      debts: debtsFiltered,
      fuel,
    };
  }, [
    costPeriod,
    debts,
    fuelRecords,
    maintenanceRecords,
    selectedBranchId,
    selectedVehicleId,
    vehicles,
  ]);

  const metrics = useMemo(() => {
    const fuelCost = filtered.fuel.reduce((sum, row) => sum + row.totalValue, 0);
    const maintenanceCost = filtered.maintenance.reduce((sum, row) => sum + row.cost, 0);
    const debtsCost = filtered.debts.reduce((sum, row) => sum + row.amount, 0);
    const total = fuelCost + maintenanceCost + debtsCost;
    const totalLiters = filtered.fuel.reduce((sum, row) => sum + row.liters, 0);

    return {
      total,
      fuelCost,
      maintenanceCost,
      debtsCost,
      totalLiters,
      fuelCount: filtered.fuel.length,
      pendingMaintenance: filtered.maintenance.filter((x) => x.status === "OPEN").length,
      pendingDebts: filtered.debts.filter((x) => x.status === "PENDING").length,
    };
  }, [filtered]);

  const topVehicles = useMemo(() => {
    const map = new Map<string, number>();
    filtered.maintenance.forEach((item) =>
      map.set(item.vehicleId, (map.get(item.vehicleId) || 0) + item.cost)
    );
    filtered.debts.forEach((item) =>
      map.set(item.vehicleId, (map.get(item.vehicleId) || 0) + item.amount)
    );
    filtered.fuel.forEach((item) =>
      map.set(item.vehicleId, (map.get(item.vehicleId) || 0) + item.totalValue)
    );

    const vehicleMap = new Map(filtered.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    return [...map.entries()]
      .map(([vehicleId, total]) => {
        const vehicle = vehicleMap.get(vehicleId);
        return {
          label: vehicle ? `${vehicle.brand} ${vehicle.model}` : vehicleId,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filtered]);

  function exportDashboardReport() {
    const generatedAt = new Date().toLocaleString("pt-BR");
    const periodLabel =
      costPeriod === "CURRENT_YEAR"
        ? "Ano atual"
        : costPeriod === "CURRENT_MONTH"
        ? "Mes atual"
        : costPeriod === "LAST_30_DAYS"
        ? "Ultimos 30 dias"
        : "Todo o período";
    const vehicleLabel =
      selectedVehicleId === "ALL"
        ? "Todos os veículos"
        : (() => {
            const vehicle = filtered.vehicles.find((v) => v.id === selectedVehicleId);
            return vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo selecionado";
          })();

    const html = `
      <html>
        <head>
          <title>Relatorio Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 6px; }
            .meta { color: #475569; font-size: 12px; margin-bottom: 12px; }
            section { margin-top: 22px; break-inside: avoid; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Relatorio do Dashboard</h1>
          <div class="meta">Gerado em: ${generatedAt}</div>
          <div class="meta">Formato: ${escapeHtml(format)}</div>
          <div class="meta">Filial: ${escapeHtml(selectedBranch?.name || "Todas as filiais")}</div>
          <div class="meta">Período: ${escapeHtml(periodLabel)}</div>
          <div class="meta">Veículo: ${escapeHtml(vehicleLabel)}</div>

          <section>
            <h2>Resumo</h2>
            <table>
              <tr><td>Custo total</td><td>${toCurrency(metrics.total)}</td></tr>
              <tr><td>Custo abastecimento</td><td>${toCurrency(metrics.fuelCost)}</td></tr>
              <tr><td>Custo manutenção</td><td>${toCurrency(metrics.maintenanceCost)}</td></tr>
              <tr><td>Custo débitos e multas</td><td>${toCurrency(metrics.debtsCost)}</td></tr>
              <tr><td>Abastecimentos</td><td>${metrics.fuelCount}</td></tr>
              <tr><td>Total de litros</td><td>${metrics.totalLiters.toFixed(1)} L</td></tr>
              <tr><td>Manuten??es pendentes</td><td>${metrics.pendingMaintenance}</td></tr>
              <tr><td>Débitos e multas pendentes</td><td>${metrics.pendingDebts}</td></tr>
            </table>
          </section>

          <section>
            <h2>Top Veículos por Custo</h2>
            <table>
              <thead><tr><th>Posição</th><th>Veículo</th><th>Total</th></tr></thead>
              <tbody>
                ${topVehicles
                  .map(
                    (item, index) =>
                      `<tr><td>${index + 1}</td><td>${escapeHtml(item.label)}</td><td>${toCurrency(item.total)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=900");
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Exportação de Relatórios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Esta pagina exporta o mesmo recorte de dados do dashboard.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Atualizar dados
          </button>
          <button
            onClick={exportDashboardReport}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <FileDown size={16} />
            Exportar ${format}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Período
            </label>
            <select
              value={costPeriod}
              onChange={(e) => setCostPeriod(e.target.value as CostPeriod)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="CURRENT_YEAR">Ano atual</option>
              <option value="CURRENT_MONTH">Mes atual</option>
              <option value="LAST_30_DAYS">Ultimos 30 dias</option>
              <option value="ALL">Todo o período</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Veículo
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos os veículos</option>
              {filtered.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Formato
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="PDF">PDF</option>
            </select>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        {loading
          ? "Sincronizando dados do dashboard para exportação..."
          : "Relatórios visuais ficam centralizados no Dashboard. Aqui você apenas extrai o relatório do recorte selecionado."}
      </div>
    </div>
  );
}
