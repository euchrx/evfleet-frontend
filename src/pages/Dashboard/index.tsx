import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CarFront,
  CircleAlert,
  Fuel,
  Gauge,
  Package,
  Route,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";
import type { Branch } from "../../types/branch";
import type { Debt } from "../../types/debt";
import type { Driver } from "../../types/driver";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { RetailProductItem } from "../../services/retailProducts";
import type { Tire } from "../../types/tire";
import type { Trip } from "../../types/trip";
import type { Vehicle } from "../../types/vehicle";
import { getBranches } from "../../services/branches";
import { getDebts } from "../../services/debts";
import { getDrivers } from "../../services/drivers";
import { getFuelRecords, type FuelRecord } from "../../services/fuelRecords";
import { getMaintenanceRecords } from "../../services/maintenanceRecords";
import { getRetailProducts } from "../../services/retailProducts";
import { getTires } from "../../services/tires";
import { getTrips } from "../../services/trips";
import { getVehicles } from "../../services/vehicles";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function toSafeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDatePtBr(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function maintenanceTypePtBr(value?: string) {
  if (value === "PREVENTIVE") return "Preventiva";
  if (value === "PERIODIC") return "Periódica";
  if (value === "CORRECTIVE") return "Corretiva";
  return value || "Serviço";
}

type CostPeriod = "CURRENT_MONTH" | "LAST_30_DAYS" | "CURRENT_YEAR" | "ALL";
type CostModalType = "FUEL" | "PRODUCTS" | "TIRES" | "MAINTENANCE" | "DEBTS";
type DriverCategory = "LIGHT" | "HEAVY";
type VehicleCategoryFilter = "ALL" | "LIGHT" | "HEAVY";
const MAX_RANKING_ITEMS = 10;

function parseDateSafe(dateValue: string) {
  const dateMatch = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  return new Date(dateValue);
}

function isInPeriod(dateValue: string, period: CostPeriod) {
  const date = parseDateSafe(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  if (period === "ALL") return true;

  if (period === "CURRENT_MONTH") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  if (period === "CURRENT_YEAR") {
    return date.getFullYear() === now.getFullYear();
  }

  const initial = new Date(now);
  initial.setHours(0, 0, 0, 0);
  initial.setDate(initial.getDate() - 29);

  return date >= initial && date <= now;
}

function DashboardCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {icon}
      </div>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(
    []
  );
  const [debts, setDebts] = useState<Debt[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [retailProducts, setRetailProducts] = useState<RetailProductItem[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [costPeriod, setCostPeriod] = useState<CostPeriod>("CURRENT_MONTH");
  const [selectedVehicleCategory, setSelectedVehicleCategory] =
    useState<VehicleCategoryFilter>("ALL");
  const [costModal, setCostModal] = useState<CostModalType | null>(null);
  const [vehicleCostModal, setVehicleCostModal] = useState<{
    vehicleId: string;
    label: string;
    category: DriverCategory;
  } | null>(null);
  const [bestDriverModal, setBestDriverModal] = useState<{
    category: DriverCategory;
    driver: string;
    averageKmPerLiter: number;
    samples: number;
    kmsDriven: number;
    totalLiters: number;
    totalValue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [vehiclesData, driversData, branchesData, maintenanceData, debtsData, fuelData, retailProductsData, tiresData, tripsData] =
        await Promise.all([
          getVehicles(),
          getDrivers(),
          getBranches(),
          getMaintenanceRecords(),
          getDebts(),
          getFuelRecords(),
          getRetailProducts(),
          getTires(),
          getTrips(),
        ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setFuelRecords(Array.isArray(fuelData) ? fuelData : []);
      setRetailProducts(Array.isArray(retailProductsData) ? retailProductsData : []);
      setTires(Array.isArray(tiresData) ? tiresData : []);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErrorMessage("Não foi possível carregar os indicadores do dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    function handleRefresh() {
      loadDashboard();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadDashboard();
      }
    }

    window.addEventListener("evfleet-dashboard-updated", handleRefresh);
    window.addEventListener("evfleet-notifications-updated", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("evfleet-dashboard-updated", handleRefresh);
      window.removeEventListener("evfleet-notifications-updated", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard]);

  const filteredData = useMemo(() => {
    const vehiclesFiltered = selectedBranchId
      ? vehicles.filter(
          (vehicle) => !vehicle.branchId || vehicle.branchId === selectedBranchId
        )
      : vehicles;

    const vehicleIds = new Set(vehiclesFiltered.map((vehicle) => vehicle.id));

    const driversFiltered = selectedBranchId
      ? drivers.filter(
          (driver) =>
            (driver.vehicle?.branchId && driver.vehicle.branchId === selectedBranchId) ||
            (!driver.vehicle?.branchId &&
              (driver.vehicleId ? vehicleIds.has(driver.vehicleId) : false)) ||
            (driver.vehicleId ? vehicleIds.has(driver.vehicleId) : false)
        )
      : drivers;

    const branchesFiltered = selectedBranchId
      ? branches.filter((branch) => branch.id === selectedBranchId)
      : branches;

    const maintenanceFiltered = maintenanceRecords.filter((record) =>
      selectedBranchId ? vehicleIds.has(record.vehicleId) : true
    );

    const debtsFiltered = debts.filter((debt) =>
      selectedBranchId ? vehicleIds.has(debt.vehicleId) : true
    );

    const fuelFiltered = fuelRecords.filter((record) =>
      selectedBranchId ? vehicleIds.has(record.vehicleId) : true
    );
    const productsFiltered = retailProducts.filter((item) =>
      selectedBranchId
        ? !item.retailProductImport.branch?.id ||
          item.retailProductImport.branch.id === selectedBranchId
        : true
    );
    const tiresFiltered = tires.filter((item) =>
      selectedBranchId
        ? item.vehicleId
          ? vehicleIds.has(item.vehicleId)
          : true
        : true
    );
    const tripsFiltered = trips.filter((trip) =>
      selectedBranchId ? vehicleIds.has(trip.vehicleId) : true
    );

    return {
      vehicles: vehiclesFiltered,
      drivers: driversFiltered,
      branches: branchesFiltered,
      maintenance: maintenanceFiltered,
      debts: debtsFiltered,
      fuel: fuelFiltered,
      products: productsFiltered,
      tires: tiresFiltered,
      trips: tripsFiltered,
    };
  }, [
    vehicles,
    drivers,
    branches,
    maintenanceRecords,
    debts,
    fuelRecords,
    retailProducts,
    tires,
    trips,
    selectedBranchId,
  ]);

  const vehicleTypeById = useMemo(
    () => new Map(filteredData.vehicles.map((vehicle) => [vehicle.id, vehicle.vehicleType])),
    [filteredData.vehicles]
  );

  const metrics = useMemo(() => {
    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleCategory === "ALL" ||
      vehicleTypeById.get(vehicleId) === selectedVehicleCategory;

    const vehiclesByCategory = filteredData.vehicles.filter((vehicle) =>
      selectedVehicleCategory === "ALL"
        ? true
        : vehicle.vehicleType === selectedVehicleCategory
    );

    const driversByCategory = filteredData.drivers.filter((driver) => {
      if (selectedVehicleCategory === "ALL") return true;

      const driverVehicleType = driver.vehicleId
        ? vehicleTypeById.get(driver.vehicleId)
        : undefined;

      return driverVehicleType === selectedVehicleCategory;
    });

    const maintenanceByCategory = filteredData.maintenance.filter((record) =>
      isVehicleMatch(record.vehicleId)
    );
    const fuelByCategory = filteredData.fuel.filter((record) =>
      isVehicleMatch(record.vehicleId)
    );
    const debtsByCategory = filteredData.debts.filter((debt) =>
      isVehicleMatch(debt.vehicleId)
    );
    const tripsByCategory = filteredData.trips.filter((trip) =>
      isVehicleMatch(trip.vehicleId)
    );

    const pendingMaintenance = maintenanceByCategory.filter(
      (record) => record.status === "OPEN"
    ).length;
    const fuelInPeriod = filteredData.fuel.filter(
      (record) =>
        isInPeriod(record.fuelDate, costPeriod) && isVehicleMatch(record.vehicleId)
    );
    const debtsInPeriod = filteredData.debts.filter(
      (debt) => isInPeriod(debt.debtDate, costPeriod) && isVehicleMatch(debt.vehicleId)
    );
    const productsInPeriod = filteredData.products.filter((item) =>
      isInPeriod(item.retailProductImport.issuedAt || item.createdAt, costPeriod)
    );
    const tiresInPeriod = filteredData.tires.filter((item) => {
      const effectiveDate = item.purchaseDate || item.installedAt || item.createdAt;
      const vehicleMatches =
        !item.vehicleId || isVehicleMatch(item.vehicleId);
      return vehicleMatches && isInPeriod(effectiveDate, costPeriod);
    });
    const maintenanceInPeriod = filteredData.maintenance.filter(
      (record) =>
        isInPeriod(record.maintenanceDate, costPeriod) &&
        isVehicleMatch(record.vehicleId)
    );

    const fuelCostPeriod = fuelInPeriod.reduce(
      (sum, record) => sum + toSafeNumber(record.totalValue),
      0
    );
    const maintenanceCostPeriod = maintenanceInPeriod.reduce(
      (sum, record) => sum + toSafeNumber(record.cost),
      0
    );
    const debtsCostPeriod = debtsInPeriod.reduce(
      (sum, debt) => sum + toSafeNumber(debt.amount),
      0
    );
    const productsCostPeriod = productsInPeriod.reduce(
      (sum, item) => sum + toSafeNumber(item.totalValue),
      0
    );
    const tiresCostPeriod = tiresInPeriod.reduce(
      (sum, item) => sum + toSafeNumber(item.purchaseCost),
      0
    );
    const totalCostPeriod =
      fuelCostPeriod +
      productsCostPeriod +
      tiresCostPeriod +
      maintenanceCostPeriod +
      debtsCostPeriod;

    return {
      pendingMaintenance,
      vehiclesTotal: vehiclesByCategory.length,
      vehiclesActive: vehiclesByCategory.filter((vehicle) => vehicle.status === "ACTIVE")
        .length,
      vehiclesMaintenance: vehiclesByCategory.filter(
        (vehicle) => vehicle.status === "MAINTENANCE"
      ).length,
      driversTotal: driversByCategory.length,
      driversActive: driversByCategory.filter((driver) => driver.status === "ACTIVE")
        .length,
      driversInactive: driversByCategory.filter((driver) => driver.status !== "ACTIVE")
        .length,
      maintenanceTotal: maintenanceByCategory.length,
      fuelTotal: fuelByCategory.length,
      debtsTotal: debtsByCategory.length,
      tripsTotal: tripsByCategory.length,
      tripsOpen: tripsByCategory.filter((trip) => trip.status === "OPEN").length,
      tripsCompleted: tripsByCategory.filter((trip) => trip.status === "COMPLETED")
        .length,
      fuelOperationsPeriod: fuelInPeriod.length,
      fuelCostPeriod,
      productsCostPeriod,
      tiresCostPeriod,
      maintenanceCostPeriod,
      debtsCostPeriod,
      totalCostPeriod,
      pendingDebts: debtsByCategory.filter((debt) => debt.status === "PENDING")
        .length,
    };
  }, [costPeriod, filteredData, selectedVehicleCategory, vehicleTypeById]);

  const topVehiclesByCostByType = useMemo(() => {
    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleCategory === "ALL" ||
      vehicleTypeById.get(vehicleId) === selectedVehicleCategory;

    const costMap = new Map<string, number>();

    filteredData.maintenance
      .filter(
        (record) =>
          isInPeriod(record.maintenanceDate, costPeriod) &&
          isVehicleMatch(record.vehicleId)
      )
      .forEach((record) => {
        costMap.set(
          record.vehicleId,
          (costMap.get(record.vehicleId) ?? 0) + toSafeNumber(record.cost)
        );
      });

    filteredData.fuel
      .filter(
        (record) =>
          isInPeriod(record.fuelDate, costPeriod) && isVehicleMatch(record.vehicleId)
      )
      .forEach((record) => {
        costMap.set(
          record.vehicleId,
          (costMap.get(record.vehicleId) ?? 0) + toSafeNumber(record.totalValue)
        );
      });

    filteredData.debts
      .filter(
        (debt) =>
          isInPeriod(debt.debtDate, costPeriod) && isVehicleMatch(debt.vehicleId)
      )
      .forEach((debt) => {
        costMap.set(
          debt.vehicleId,
          (costMap.get(debt.vehicleId) ?? 0) + toSafeNumber(debt.amount)
        );
      });

    const toLabel = new Map(filteredData.vehicles.map((vehicle) => [vehicle.id, vehicle]));

    const ranked = [...costMap.entries()]
      .map(([vehicleId, total]) => {
        const vehicle = toLabel.get(vehicleId);
        const label = vehicle
          ? formatVehicleLabel(vehicle)
          : `Veículo ${vehicleId.slice(0, 8)}`;
        const vehicleType = vehicle?.vehicleType;
        return { vehicleId, label, value: total, vehicleType };
      });

    return {
      LIGHT: ranked
        .filter((item) => item.vehicleType === "LIGHT")
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_RANKING_ITEMS)
        .map(({ label, value, vehicleId }) => ({ label, value, vehicleId })),
      HEAVY: ranked
        .filter((item) => item.vehicleType === "HEAVY")
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_RANKING_ITEMS)
        .map(({ label, value, vehicleId }) => ({ label, value, vehicleId })),
    };
  }, [filteredData, costPeriod, selectedVehicleCategory, vehicleTypeById]);

  const vehicleCostModalData = useMemo(() => {
    if (!vehicleCostModal) return null;

    const fuel = filteredData.fuel
      .filter(
        (record) =>
          record.vehicleId === vehicleCostModal.vehicleId &&
          isInPeriod(record.fuelDate, costPeriod)
      )
      .sort((a, b) => parseDateSafe(b.fuelDate).getTime() - parseDateSafe(a.fuelDate).getTime());

    const maintenance = filteredData.maintenance
      .filter(
        (record) =>
          record.vehicleId === vehicleCostModal.vehicleId &&
          isInPeriod(record.maintenanceDate, costPeriod)
      )
      .sort(
        (a, b) =>
          parseDateSafe(b.maintenanceDate).getTime() - parseDateSafe(a.maintenanceDate).getTime()
      );

    const debts = filteredData.debts
      .filter(
        (debt) =>
          debt.vehicleId === vehicleCostModal.vehicleId &&
          isInPeriod(debt.debtDate, costPeriod)
      )
      .sort((a, b) => parseDateSafe(b.debtDate).getTime() - parseDateSafe(a.debtDate).getTime());

    const fuelTotal = fuel.reduce((sum, item) => sum + toSafeNumber(item.totalValue), 0);
    const maintenanceTotal = maintenance.reduce((sum, item) => sum + toSafeNumber(item.cost), 0);
    const debtsTotal = debts.reduce((sum, item) => sum + toSafeNumber(item.amount), 0);
    const total = fuelTotal + maintenanceTotal + debtsTotal;

    const history = [
      ...fuel.map((item) => ({
        id: `fuel-${item.id}`,
        date: item.fuelDate,
        type: "Abastecimento",
        value: toSafeNumber(item.totalValue),
        description: `${(item.liters || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} L • KM ${item.km}`,
      })),
      ...maintenance.map((item) => ({
        id: `maintenance-${item.id}`,
        date: item.maintenanceDate,
        type: "Manutenção",
        value: toSafeNumber(item.cost),
        description: `${maintenanceTypePtBr(item.type)} • KM ${item.km}`,
      })),
      ...debts.map((item) => ({
        id: `debt-${item.id}`,
        date: item.debtDate,
        type: "Débito/Multa",
        value: toSafeNumber(item.amount),
        description: `${item.description || "Registro"} • ${item.points || 0} pontos`,
      })),
    ].sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime());

    return {
      fuelTotal,
      maintenanceTotal,
      debtsTotal,
      total,
      history,
    };
  }, [vehicleCostModal, filteredData.fuel, filteredData.maintenance, filteredData.debts, costPeriod]);

  const bestDriversByEfficiencyByType = useMemo(() => {
    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleCategory === "ALL" ||
      vehicleTypeById.get(vehicleId) === selectedVehicleCategory;

    const kmsDrivenByDriver = new Map<string, number>();

    filteredData.trips
      .filter(
        (trip) =>
          trip.status === "COMPLETED" &&
          Boolean(trip.driverId) &&
          isVehicleMatch(trip.vehicleId) &&
          isInPeriod(trip.returnAt || trip.departureAt, costPeriod) &&
          typeof trip.departureKm === "number" &&
          typeof trip.returnKm === "number" &&
          trip.returnKm >= trip.departureKm
      )
      .forEach((trip) => {
        const driverId = trip.driverId as string;
        const traveledKm = Math.max(trip.returnKm! - trip.departureKm, 0);
        kmsDrivenByDriver.set(
          driverId,
          (kmsDrivenByDriver.get(driverId) ?? 0) + traveledKm
        );
      });

    const byDriver = {
      LIGHT: new Map<
        string,
        {
          label: string;
          totalEfficiency: number;
          samples: number;
          driverId: string;
          totalLiters: number;
          totalValue: number;
        }
      >(),
      HEAVY: new Map<
        string,
        {
          label: string;
          totalEfficiency: number;
          samples: number;
          driverId: string;
          totalLiters: number;
          totalValue: number;
        }
      >(),
    };

    filteredData.fuel
      .filter(
        (record) =>
          isInPeriod(record.fuelDate, costPeriod) &&
          isVehicleMatch(record.vehicleId) &&
          typeof record.averageConsumptionKmPerLiter === "number" &&
          record.averageConsumptionKmPerLiter > 0
      )
      .forEach((record) => {
        const vehicleType = vehicleTypeById.get(record.vehicleId);
        if (vehicleType !== "LIGHT" && vehicleType !== "HEAVY") return;

        const driverId = record.driverId || "NO_DRIVER";
        const driverName = record.driver?.name?.trim() || "Sem motorista";
        const current = byDriver[vehicleType].get(driverId) || {
          driverId,
          label: driverName,
          totalEfficiency: 0,
          samples: 0,
          totalLiters: 0,
          totalValue: 0,
        };
        current.totalEfficiency += record.averageConsumptionKmPerLiter as number;
        current.samples += 1;
        current.totalLiters += record.liters || 0;
        current.totalValue += record.totalValue || 0;
        byDriver[vehicleType].set(driverId, current);
      });

    const normalize = (
      entries: Array<{
        driverId: string;
        label: string;
        totalEfficiency: number;
        samples: number;
        totalLiters: number;
        totalValue: number;
      }>
    ) =>
      entries
        .filter(
          (entry) =>
            entry.samples > 0 && (kmsDrivenByDriver.get(entry.driverId) ?? 0) > 0
        )
        .map((entry) => ({
          driver: entry.label,
          averageKmPerLiter: entry.totalEfficiency / entry.samples,
          samples: entry.samples,
          kmsDriven: kmsDrivenByDriver.get(entry.driverId) ?? 0,
          totalLiters: entry.totalLiters,
          totalValue: entry.totalValue,
        }))
        .sort((a, b) => b.averageKmPerLiter - a.averageKmPerLiter)
        .slice(0, MAX_RANKING_ITEMS);

    return {
      LIGHT: normalize([...byDriver.LIGHT.values()]),
      HEAVY: normalize([...byDriver.HEAVY.values()]),
    };
  }, [filteredData.fuel, filteredData.trips, costPeriod, selectedVehicleCategory, vehicleTypeById]);

  const costDetails = useMemo(() => {
    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleCategory === "ALL" ||
      vehicleTypeById.get(vehicleId) === selectedVehicleCategory;

    const fuel = filteredData.fuel
      .filter(
        (record) =>
          isInPeriod(record.fuelDate, costPeriod) && isVehicleMatch(record.vehicleId)
      )
      .sort((a, b) => parseDateSafe(b.fuelDate).getTime() - parseDateSafe(a.fuelDate).getTime());

    const maintenance = filteredData.maintenance
      .filter(
        (record) =>
          isInPeriod(record.maintenanceDate, costPeriod) &&
          isVehicleMatch(record.vehicleId)
      )
      .sort(
        (a, b) =>
          parseDateSafe(b.maintenanceDate).getTime() - parseDateSafe(a.maintenanceDate).getTime()
      );

    const debts = filteredData.debts
      .filter(
        (debt) => isInPeriod(debt.debtDate, costPeriod) && isVehicleMatch(debt.vehicleId)
      )
      .sort((a, b) => parseDateSafe(b.debtDate).getTime() - parseDateSafe(a.debtDate).getTime());

    const products = filteredData.products
      .filter((item) => isInPeriod(item.retailProductImport.issuedAt || item.createdAt, costPeriod))
      .sort(
        (a, b) =>
          parseDateSafe(b.retailProductImport.issuedAt || b.createdAt).getTime() -
          parseDateSafe(a.retailProductImport.issuedAt || a.createdAt).getTime()
      );
    const tires = filteredData.tires
      .filter((item) => {
        const effectiveDate = item.purchaseDate || item.installedAt || item.createdAt;
        const vehicleMatches =
          !item.vehicleId || isVehicleMatch(item.vehicleId);
        return vehicleMatches && isInPeriod(effectiveDate, costPeriod);
      })
      .sort(
        (a, b) =>
          parseDateSafe(b.purchaseDate || b.installedAt || b.createdAt).getTime() -
          parseDateSafe(a.purchaseDate || a.installedAt || a.createdAt).getTime()
      );

    return { fuel, products, tires, maintenance, debts };
  }, [
    filteredData.fuel,
    filteredData.products,
    filteredData.tires,
    filteredData.maintenance,
    filteredData.debts,
    costPeriod,
    selectedVehicleCategory,
    vehicleTypeById,
  ]);

  const groupedCostDetails = useMemo(() => {
    const fuelByVehicle = new Map<
      string,
      { label: string; plate: string; totalLiters: number; totalValue: number; records: number }
    >();
    costDetails.fuel.forEach((record) => {
      const key = record.vehicleId;
      const plate = record.vehicle?.plate || "";
      const label = record.vehicle ? formatVehicleLabel(record.vehicle) : "Veículo não identificado";
      const current = fuelByVehicle.get(key) || {
        label,
        plate,
        totalLiters: 0,
        totalValue: 0,
        records: 0,
      };
      current.totalLiters += record.liters || 0;
      current.totalValue += record.totalValue || 0;
      current.records += 1;
      fuelByVehicle.set(key, current);
    });

    const maintenanceByVehicle = new Map<
      string,
      { label: string; plate: string; totalValue: number; records: number; totalKm: number }
    >();
    costDetails.maintenance.forEach((record) => {
      const key = record.vehicleId;
      const plate = record.vehicle?.plate || "";
      const label = record.vehicle ? formatVehicleLabel(record.vehicle) : "Veículo não identificado";
      const current = maintenanceByVehicle.get(key) || {
        label,
        plate,
        totalValue: 0,
        records: 0,
        totalKm: 0,
      };
      current.totalValue += record.cost || 0;
      current.records += 1;
      current.totalKm += record.km || 0;
      maintenanceByVehicle.set(key, current);
    });

    const productsByCategory = new Map<
      string,
      { label: string; totalValue: number; records: number; totalQuantity: number }
    >();
    costDetails.products.forEach((item) => {
      const key = item.category;
      const label =
        item.category === "PERFUMARIA"
          ? "Perfumaria"
          : item.category === "COSMETICOS"
            ? "Cosméticos"
            : item.category === "LUBRIFICANTES"
              ? "Lubrificantes"
              : item.category === "CONVENIENCIA"
                ? "Conveniência"
                : item.category === "LIMPEZA"
                  ? "Limpeza"
                  : "Outros";
      const current = productsByCategory.get(key) || {
        label,
        totalValue: 0,
        records: 0,
        totalQuantity: 0,
      };
      current.totalValue += toSafeNumber(item.totalValue);
      current.records += 1;
      current.totalQuantity += toSafeNumber(item.quantity);
      productsByCategory.set(key, current);
    });

    const tiresByVehicle = new Map<
      string,
      { label: string; plate: string; totalValue: number; records: number; totalKm: number }
    >();
    costDetails.tires.forEach((item) => {
      const key = item.vehicleId || `tire-${item.id}`;
      const plate = item.vehicle?.plate || "";
      const label = item.vehicle
        ? formatVehicleLabel(item.vehicle)
        : "Sem veículo vinculado";
      const current = tiresByVehicle.get(key) || {
        label,
        plate,
        totalValue: 0,
        records: 0,
        totalKm: 0,
      };
      current.totalValue += toSafeNumber(item.purchaseCost);
      current.records += 1;
      current.totalKm += toSafeNumber(item.currentKm);
      tiresByVehicle.set(key, current);
    });

    const debtsByVehicle = new Map<
      string,
      { label: string; plate: string; totalValue: number; records: number; totalPoints: number }
    >();
    costDetails.debts.forEach((debt) => {
      const key = debt.vehicleId;
      const plate = debt.vehicle?.plate || "";
      const label = debt.vehicle ? formatVehicleLabel(debt.vehicle) : "Veículo não identificado";
      const current = debtsByVehicle.get(key) || {
        label,
        plate,
        totalValue: 0,
        records: 0,
        totalPoints: 0,
      };
      current.totalValue += debt.amount || 0;
      current.records += 1;
      current.totalPoints += debt.points || 0;
      debtsByVehicle.set(key, current);
    });

    return {
      fuel: [...fuelByVehicle.values()].sort((a, b) => b.totalValue - a.totalValue),
      products: [...productsByCategory.values()].sort((a, b) => b.totalValue - a.totalValue),
      tires: [...tiresByVehicle.values()].sort((a, b) => b.totalValue - a.totalValue),
      maintenance: [...maintenanceByVehicle.values()].sort((a, b) => b.totalValue - a.totalValue),
      debts: [...debtsByVehicle.values()].sort((a, b) => b.totalValue - a.totalValue),
    };
  }, [costDetails]);

  const periodLabel =
    costPeriod === "CURRENT_YEAR"
      ? "Ano atual"
      : costPeriod === "CURRENT_MONTH"
        ? "Mês atual"
        : costPeriod === "LAST_30_DAYS"
          ? "Últimos 30 dias"
          : "Todo o período";

  const selectedVehicleLabel =
    selectedVehicleCategory === "ALL"
      ? "Todas as categorias"
      : selectedVehicleCategory === "LIGHT"
        ? "Categoria Leve"
        : "Categoria Pesado";
  const periodReferenceLabel = useMemo(() => {
    const now = new Date();

    if (costPeriod === "CURRENT_YEAR") {
      return `Ano referente: ${now.getFullYear()}`;
    }

    if (costPeriod === "CURRENT_MONTH") {
      const monthYear = now.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      return `Mês referente: ${monthYear}`;
    }

    if (costPeriod === "LAST_30_DAYS") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 29);
      return `Data referente entre ${formatDatePtBr(start)} e ${formatDatePtBr(now)}`;
    }

    const isVehicleMatch = (vehicleId: string) =>
      selectedVehicleCategory === "ALL" ||
      vehicleTypeById.get(vehicleId) === selectedVehicleCategory;

    const allDates = [
      ...filteredData.fuel
        .filter((record) => isVehicleMatch(record.vehicleId))
        .map((record) => parseDateSafe(record.fuelDate)),
      ...filteredData.maintenance
        .filter((record) => isVehicleMatch(record.vehicleId))
        .map((record) => parseDateSafe(record.maintenanceDate)),
      ...filteredData.debts
        .filter((record) => isVehicleMatch(record.vehicleId))
        .map((record) => parseDateSafe(record.debtDate)),
    ].filter((date) => !Number.isNaN(date.getTime()));

    if (allDates.length === 0) {
      return "Todo o período: sem registros";
    }

    const timestamps = allDates.map((date) => date.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    return `Todo o período: desde ${formatDatePtBr(minDate)} até ${formatDatePtBr(maxDate)}`;
  }, [
    costPeriod,
    selectedVehicleCategory,
    filteredData.fuel,
    filteredData.maintenance,
    filteredData.debts,
    vehicleTypeById,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Dashboard Executivo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão operacional e financeira da frota
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={costPeriod}
          onChange={(e) => setCostPeriod(e.target.value as CostPeriod)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
          <option value="CURRENT_YEAR">Ano atual</option>
          <option value="CURRENT_MONTH">Mês atual</option>
          <option value="LAST_30_DAYS">Últimos 30 dias</option>
          <option value="ALL">Todo o período</option>
        </select>

        <select
          value={selectedVehicleCategory}
          onChange={(e) =>
            setSelectedVehicleCategory(e.target.value as VehicleCategoryFilter)
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
          <option value="ALL">Todas as categorias</option>
          <option value="LIGHT">Categoria Leve</option>
          <option value="HEAVY">Categoria Pesado</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        {periodReferenceLabel}
      </p>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setCostModal("FUEL")}
          className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">Custo com combustível</p>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <Fuel size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {loading ? "..." : toCurrency(metrics.fuelCostPeriod)}
            </p>
            <span className="text-xs font-semibold text-slate-500">Ver detalhes</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{periodLabel}</span>
            <span>{selectedVehicleLabel}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCostModal("PRODUCTS")}
          className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">Custo com produtos</p>
            <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
              <Package size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {loading ? "..." : toCurrency(metrics.productsCostPeriod)}
            </p>
            <span className="text-xs font-semibold text-slate-500">Ver detalhes</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{periodLabel}</span>
            <span>Todas as categorias</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCostModal("MAINTENANCE")}
          className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">Custo com manutenção</p>
            <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
              <Wrench size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {loading ? "..." : toCurrency(metrics.maintenanceCostPeriod)}
            </p>
            <span className="text-xs font-semibold text-slate-500">Ver detalhes</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{periodLabel}</span>
            <span>{selectedVehicleLabel}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCostModal("TIRES")}
          className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">Custo com pneus</p>
            <div className="rounded-xl bg-sky-100 p-2 text-sky-700">
              <Gauge size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {loading ? "..." : toCurrency(metrics.tiresCostPeriod)}
            </p>
            <span className="text-xs font-semibold text-slate-500">Ver detalhes</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{periodLabel}</span>
            <span>{selectedVehicleLabel}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCostModal("DEBTS")}
          className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-900">Custo com débitos e multas</p>
            <div className="rounded-xl bg-red-100 p-2 text-red-700">
              <CircleAlert size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {loading ? "..." : toCurrency(metrics.debtsCostPeriod)}
            </p>
            <span className="text-xs font-semibold text-slate-500">Ver detalhes</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span>{periodLabel}</span>
            <span>{selectedVehicleLabel}</span>
          </div>
        </button>
      </div>
      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
              TOTAL DESPESAS
            </p>
          </div>
          <p className="text-3xl font-extrabold text-orange-800">
            {loading ? "..." : toCurrency(metrics.totalCostPeriod)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardCard
          title="Ranking veículos por custo"
          icon={
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <CarFront size={16} />
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : topVehiclesByCostByType.LIGHT.length === 0 &&
            topVehiclesByCostByType.HEAVY.length === 0 ? (
            <p className="text-sm text-slate-500">Sem dados de custo por veículo.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  key: "LIGHT" as const,
                  label: "Leve",
                  icon: (
                    <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700">
                      <CarFront size={14} />
                    </div>
                  ),
                },
                {
                  key: "HEAVY" as const,
                  label: "Pesado",
                  icon: (
                    <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                      <Truck size={14} />
                    </div>
                  ),
                },
              ].map((group) => {
                const rows = topVehiclesByCostByType[group.key];
                return (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {group.icon}
                        <p className="text-base font-semibold text-slate-800">
                          Categoria {group.label}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Top {rows.length}
                      </span>
                    </div>

                    {rows.length === 0 ? (
                      <p className="text-xs text-slate-500">Sem dados nesta categoria.</p>
                    ) : (
                      <div className="space-y-2">
                        {rows.map((row, index) => (
                          <button
                            type="button"
                            key={`${group.key}-${row.vehicleId}-${index}`}
                            onClick={() =>
                              setVehicleCostModal({
                                vehicleId: row.vehicleId,
                                label: row.label,
                                category: group.key,
                              })
                            }
                            className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/30"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                              {index + 1}
                            </span>
                            <span
                              title={row.label}
                              className="text-sm font-semibold leading-tight text-slate-900 break-words"
                            >
                              {row.label}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {toCurrency(row.value)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Ranking melhores motoristas"
          icon={
            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
              <Gauge size={16} />
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : bestDriversByEfficiencyByType.LIGHT.length === 0 &&
            bestDriversByEfficiencyByType.HEAVY.length === 0 ? (
            <p className="text-sm text-slate-500">Sem dados de eficiencia por motorista.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  key: "LIGHT" as const,
                  label: "Leve",
                  icon: (
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      <CarFront size={16} />
                    </div>
                  ),
                },
                {
                  key: "HEAVY" as const,
                  label: "Pesado",
                  icon: (
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                      <Truck size={16} />
                    </div>
                  ),
                },
              ].map((group) => {
                const rows = bestDriversByEfficiencyByType[group.key];
                return (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {group.icon}
                        <p className="text-base font-semibold text-slate-800">
                          Categoria {group.label}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Top {rows.length}
                      </span>
                    </div>

                    {rows.length === 0 ? (
                      <p className="text-xs text-slate-500">Sem dados nesta categoria.</p>
                    ) : (
                      <div className="space-y-2">
                        {rows.map((row, index) => (
                          <button
                            type="button"
                            key={`${group.key}-${row.driver}-${index}`}
                            onClick={() =>
                              setBestDriverModal({
                                category: group.key,
                                driver: row.driver,
                                averageKmPerLiter: row.averageKmPerLiter,
                                samples: row.samples,
                                kmsDriven: row.kmsDriven,
                                totalLiters: row.totalLiters,
                                totalValue: row.totalValue,
                              })
                            }
                            className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-cyan-200 hover:bg-cyan-50/40"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                              {index + 1}
                            </span>
                            <span
                              title={row.driver}
                              className="text-sm font-semibold leading-tight text-slate-900 break-words"
                            >
                              {row.driver}
                            </span>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {row.kmsDriven.toLocaleString("pt-BR")} km
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DashboardCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Veículos da frota"
          icon={
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <CarFront size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.vehiclesTotal}</p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
              Ativos: {loading ? "..." : metrics.vehiclesActive}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
              Manutenção: {loading ? "..." : metrics.vehiclesMaintenance}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Total no escopo</p>
        </DashboardCard>

        <DashboardCard
          title="Motoristas"
          icon={
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <Users size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.driversTotal}</p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-cyan-100 px-2 py-1 font-semibold text-cyan-700">
              Ativos: {loading ? "..." : metrics.driversActive}
            </span>
            <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700">
              Inativos: {loading ? "..." : metrics.driversInactive}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Total no escopo</p>
        </DashboardCard>

        <DashboardCard
          title="Manutenções"
          icon={
            <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
              <Wrench size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.maintenanceTotal}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Registros totais</span>
            <span className="rounded-full bg-orange-100 px-2 py-1 font-semibold text-orange-700">
              Pendentes: {loading ? "..." : metrics.pendingMaintenance}
            </span>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Viagens"
          icon={
            <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
              <Route size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.tripsTotal}</p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
              Abertas: {loading ? "..." : metrics.tripsOpen}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
              Concluídas: {loading ? "..." : metrics.tripsCompleted}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Total no escopo</p>
        </DashboardCard>

        <DashboardCard
          title="Abastecimentos"
          icon={
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <Fuel size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.fuelTotal}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Registros totais</span>
            <span className="font-semibold text-emerald-700">No período: {loading ? "..." : metrics.fuelOperationsPeriod}</span>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Débitos e Multas"
          icon={
            <div className="rounded-xl bg-red-100 p-2 text-red-700">
              <CircleAlert size={16} />
            </div>
          }
        >
          <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? "..." : metrics.debtsTotal}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Registros totais</span>
            <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">
              Pendentes: {loading ? "..." : metrics.pendingDebts}
            </span>
          </div>
        </DashboardCard>

      </div>

      {vehicleCostModal && vehicleCostModalData ? (
        <div className="fixed inset-0 z-[74] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Detalhes de custo do veículo
                </h3>
                <p className="text-sm text-slate-500">
                  {vehicleCostModal.label} •{" "}
                  {vehicleCostModal.category === "LIGHT" ? "Categoria Leve" : "Categoria Pesada"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVehicleCostModal(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Combustível</p>
                <p className="mt-1 text-xl font-bold text-emerald-800">
                  {toCurrency(vehicleCostModalData.fuelTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase text-orange-700">Manutenção</p>
                <p className="mt-1 text-xl font-bold text-orange-800">
                  {toCurrency(vehicleCostModalData.maintenanceTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold uppercase text-red-700">Débitos e multas</p>
                <p className="mt-1 text-xl font-bold text-red-800">
                  {toCurrency(vehicleCostModalData.debtsTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-100 p-3">
                <p className="text-xs font-semibold uppercase text-slate-600">Total</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {toCurrency(vehicleCostModalData.total)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 className="text-sm font-semibold text-slate-800">Histórico de custos</h4>
              </div>
              <div className="max-h-[46vh] overflow-y-auto">
                {vehicleCostModalData.history.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    Nenhum registro encontrado para o filtro atual.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {vehicleCostModalData.history.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[120px_150px_1fr_auto] items-center gap-3 px-4 py-3"
                      >
                        <span className="text-xs font-medium text-slate-500">
                          {parseDateSafe(item.date).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {item.type}
                        </span>
                        <span className="text-sm text-slate-700">{item.description}</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {toCurrency(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bestDriverModal ? (
        <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Detalhes do motorista
                </h3>
                <p className="text-sm text-slate-500">
                  {bestDriverModal.category === "LIGHT" ? "Categoria Leve" : "Categoria Pesada"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBestDriverModal(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">{bestDriverModal.driver}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">KM rodado</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {bestDriverModal.kmsDriven.toLocaleString("pt-BR")} km
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Consumo médio</p>
                  <p className="mt-1 text-2xl font-bold text-cyan-700">
                    {bestDriverModal.averageKmPerLiter.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    km/L
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Abastecimentos</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{bestDriverModal.samples}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Litros totais</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {bestDriverModal.totalLiters.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    L
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Custo total</p>
                <p className="mt-1 text-2xl font-bold text-emerald-800">
                  {toCurrency(bestDriverModal.totalValue)}
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const driverName = bestDriverModal.driver.replace(/\s*\(\d+\)\s*$/, "");
                    setBestDriverModal(null);
                    navigate(`/fuel-records?driver=${encodeURIComponent(driverName)}`);
                  }}
                  className="cursor-pointer rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Ver abastecimentos do motorista
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {costModal ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {costModal === "FUEL"
                    ? "Detalhamento - Custo com combustível"
                    : costModal === "PRODUCTS"
                      ? "Detalhamento - Custo com produtos"
                    : costModal === "TIRES"
                      ? "Detalhamento - Custo com pneus"
                    : costModal === "MAINTENANCE"
                      ? "Detalhamento - Custo com manutenção"
                      : "Detalhamento - Custo com débitos e multas"}
                </h3>
                <p className="text-sm text-slate-500">
                  {periodLabel} • {costModal === "PRODUCTS" ? "Todas as categorias" : selectedVehicleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCostModal(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            {costModal === "FUEL" ? (
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Total: <span className="font-semibold">{toCurrency(metrics.fuelCostPeriod)}</span> • Registros:{" "}
                  <span className="font-semibold">{costDetails.fuel.length}</span>
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Veículo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Total de litros</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Valor total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Abastecimentos</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ir para modulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCostDetails.fuel.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        groupedCostDetails.fuel.map((item) => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-600">{item.label}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.totalLiters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{toCurrency(item.totalValue)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.records}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <button
                                type="button"
                                title="Abrir abastecimentos filtrado por placa"
                                onClick={() => {
                                  if (!item.plate) return;
                                  setCostModal(null);
                                  navigate(`/fuel-records?plate=${encodeURIComponent(item.plate)}`);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {costModal === "PRODUCTS" ? (
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Total: <span className="font-semibold">{toCurrency(metrics.productsCostPeriod)}</span> • Registros:{" "}
                  <span className="font-semibold">{costDetails.products.length}</span>
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Categoria</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Valor total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Itens</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Quantidade total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ir para módulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCostDetails.products.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        groupedCostDetails.products.map((item) => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-600">{item.label}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{toCurrency(item.totalValue)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.records}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.totalQuantity.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <button
                                type="button"
                                title="Abrir produtos"
                                onClick={() => {
                                  setCostModal(null);
                                  navigate("/products");
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {costModal === "TIRES" ? (
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Total: <span className="font-semibold">{toCurrency(metrics.tiresCostPeriod)}</span> • Registros:{" "}
                  <span className="font-semibold">{costDetails.tires.length}</span>
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Veículo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Custo total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Pneus</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">KM acumulado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ir para módulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCostDetails.tires.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        groupedCostDetails.tires.map((item) => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-600">{item.label}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{toCurrency(item.totalValue)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.records}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.totalKm.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <button
                                type="button"
                                title="Abrir gestão de pneus"
                                onClick={() => {
                                  setCostModal(null);
                                  navigate(`/maintenance-records?tab=tires${item.plate ? `&plate=${encodeURIComponent(item.plate)}` : ""}`);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {costModal === "MAINTENANCE" ? (
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Total: <span className="font-semibold">{toCurrency(metrics.maintenanceCostPeriod)}</span> • Registros:{" "}
                  <span className="font-semibold">{costDetails.maintenance.length}</span>
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Veículo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Custo total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Manutenções</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">KM acumulado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ir para modulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCostDetails.maintenance.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        groupedCostDetails.maintenance.map((item) => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-600">{item.label}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{toCurrency(item.totalValue)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.records}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.totalKm.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <button
                                type="button"
                                title="Abrir manutenções filtrado por placa"
                                onClick={() => {
                                  if (!item.plate) return;
                                  setCostModal(null);
                                  navigate(`/maintenance-records?tab=records&plate=${encodeURIComponent(item.plate)}`);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {costModal === "DEBTS" ? (
              <div>
                <p className="mb-3 text-sm text-slate-700">
                  Total: <span className="font-semibold">{toCurrency(metrics.debtsCostPeriod)}</span> • Registros:{" "}
                  <span className="font-semibold">{costDetails.debts.length}</span>
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Veículo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Valor total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Débitos</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Pontos totais</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ir para modulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCostDetails.debts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum registro encontrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        groupedCostDetails.debts.map((item) => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-600">{item.label}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{toCurrency(item.totalValue)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.records}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.totalPoints}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <button
                                type="button"
                                title="Abrir débitos e multas filtrado por placa"
                                onClick={() => {
                                  if (!item.plate) return;
                                  setCostModal(null);
                                  navigate(`/debts?plate=${encodeURIComponent(item.plate)}`);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </div>
  );
}







