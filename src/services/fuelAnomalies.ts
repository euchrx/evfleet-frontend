import type { FuelRecord } from "./fuelRecords";
import type { Vehicle } from "../types/vehicle";
import { formatVehicleLabel } from "../utils/vehicleLabel";

type ConsumptionRule = { min: number; max: number };

const CONSUMPTION_RULES_KEY = "evfleet_consumption_rules_v1";
const ACK_PREFIX = "CONFERIDO_MANUAL";

export type DetectedFuelAnomaly = {
  id: string;
  date: string;
  vehicle: string;
  driver: string;
  reason: string;
};

function readConsumptionRules() {
  try {
    const raw = localStorage.getItem(CONSUMPTION_RULES_KEY);
    if (!raw) return {} as Record<string, ConsumptionRule>;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {} as Record<string, ConsumptionRule>;
    return parsed as Record<string, ConsumptionRule>;
  } catch {
    return {} as Record<string, ConsumptionRule>;
  }
}

export function detectFuelAnomalies(records: FuelRecord[], vehicles: Vehicle[]) {
  const rules = readConsumptionRules();
  const anomalies: DetectedFuelAnomaly[] = [];

  records.forEach((record) => {
    const recordId = String(record.id);
    const anomalyReason = String(record.anomalyReason || "");
    const acknowledgedByBackend = anomalyReason.startsWith(ACK_PREFIX);
    if (acknowledgedByBackend) return;

    const vehicle = vehicles.find((item) => item.id === record.vehicleId);
    const avg = record.averageConsumptionKmPerLiter;
    const isHeavyDiesel =
      vehicle?.vehicleType === "HEAVY" && record.fuelType === "DIESEL";

    if (isHeavyDiesel) {
      if (typeof avg === "number" && (avg < 1.5 || avg > 2.5)) {
        anomalies.push({
          id: recordId,
          date: record.fuelDate,
          vehicle: formatVehicleLabel(vehicle || record.vehicle),
          driver: record.driver?.name || "Sem motorista",
          reason: "Consumo fora da faixa esperada para pesado a diesel (1,5 a 2,5 km/L).",
        });
      }
      return;
    }

    const customRule = vehicle ? rules[vehicle.id] : undefined;
    if (customRule && typeof avg === "number") {
      if (avg < customRule.min || avg > customRule.max) {
        anomalies.push({
          id: recordId,
          date: record.fuelDate,
          vehicle: formatVehicleLabel(vehicle || record.vehicle),
          driver: record.driver?.name || "Sem motorista",
          reason: `Consumo fora da faixa configurada (${customRule.min.toLocaleString(
            "pt-BR"
          )} a ${customRule.max.toLocaleString("pt-BR")} km/L).`,
        });
      }
      return;
    }

    if (record.isAnomaly || record.anomalyReason) {
      anomalies.push({
        id: recordId,
        date: record.fuelDate,
        vehicle: formatVehicleLabel(vehicle || record.vehicle),
        driver: record.driver?.name || "Sem motorista",
        reason: record.anomalyReason || "Anomalia detectada no consumo.",
      });
    }
  });

  return anomalies;
}

