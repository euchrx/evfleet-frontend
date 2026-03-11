import { getVehicles } from "./vehicles";
import type { Vehicle } from "../types/vehicle";

export type DashboardSummary = {
  totalVehicles: number;
  branchVehicles: number;
  newestVehicles: number;
  topBrand: string;
};

export async function getDashboardSummary(selectedBranchId?: string) {
  const vehicles = await getVehicles();

  const safeVehicles: Vehicle[] = Array.isArray(vehicles) ? vehicles : [];

  const totalVehicles = safeVehicles.length;

  const branchVehicles = selectedBranchId
    ? safeVehicles.filter((vehicle) => vehicle.branchId === selectedBranchId).length
    : totalVehicles;

  const currentYear = new Date().getFullYear();

  const newestVehicles = safeVehicles.filter(
    (vehicle) => vehicle.year >= currentYear - 1
  ).length;

  const brandCount = safeVehicles.reduce<Record<string, number>>((acc, vehicle) => {
    const brand = vehicle.brand?.trim() || "Não informado";
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, {});

  const topBrand =
    Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Não informado";

  return {
    totalVehicles,
    branchVehicles,
    newestVehicles,
    topBrand,
  };
}