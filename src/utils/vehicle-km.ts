type VehicleLike = {
  id: string;
  currentKm?: number;
  createdAt?: string;
  updatedAt?: string;
};

type FuelRecordLike = {
  vehicleId: string;
  km: number;
  fuelDate?: string;
  createdAt?: string;
};

type MaintenanceRecordLike = {
  vehicleId: string;
  km: number;
  maintenanceDate?: string;
  createdAt?: string;
};

type TripLike = {
  vehicleId: string;
  departureKm?: number;
  returnKm?: number | null;
  departureAt?: string;
  returnAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ResolveLatestVehicleKmMapInput = {
  vehicles?: VehicleLike[];
  fuelRecords?: FuelRecordLike[];
  maintenanceRecords?: MaintenanceRecordLike[];
  trips?: TripLike[];
};

type KmSnapshot = {
  km: number;
  timestamp: number;
};

function toTimestamp(...candidates: Array<string | undefined | null>) {
  for (const value of candidates) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function saveLatest(
  map: Map<string, KmSnapshot>,
  vehicleId: string,
  km: number | undefined | null,
  timestamp: number,
) {
  if (!vehicleId) return;
  if (typeof km !== "number" || Number.isNaN(km) || km < 0) return;

  const current = map.get(vehicleId);
  if (!current) {
    map.set(vehicleId, { km, timestamp });
    return;
  }

  if (timestamp > current.timestamp) {
    map.set(vehicleId, { km, timestamp });
    return;
  }

  if (timestamp === current.timestamp && km > current.km) {
    map.set(vehicleId, { km, timestamp });
  }
}

export function resolveLatestVehicleKmMap({
  vehicles = [],
  fuelRecords = [],
  maintenanceRecords = [],
  trips = [],
}: ResolveLatestVehicleKmMapInput) {
  const snapshots = new Map<string, KmSnapshot>();

  vehicles.forEach((vehicle) => {
    saveLatest(
      snapshots,
      vehicle.id,
      vehicle.currentKm,
      toTimestamp(vehicle.updatedAt, vehicle.createdAt),
    );
  });

  fuelRecords.forEach((record) => {
    saveLatest(
      snapshots,
      record.vehicleId,
      record.km,
      toTimestamp(record.createdAt, record.fuelDate),
    );
  });

  maintenanceRecords.forEach((record) => {
    saveLatest(
      snapshots,
      record.vehicleId,
      record.km,
      toTimestamp(record.createdAt, record.maintenanceDate),
    );
  });

  trips.forEach((trip) => {
    const km =
      typeof trip.returnKm === "number" && !Number.isNaN(trip.returnKm)
        ? trip.returnKm
        : trip.departureKm;
    saveLatest(
      snapshots,
      trip.vehicleId,
      km,
      toTimestamp(trip.updatedAt, trip.createdAt, trip.returnAt, trip.departureAt),
    );
  });

  return new Map(
    Array.from(snapshots.entries()).map(([vehicleId, snapshot]) => [
      vehicleId,
      snapshot.km,
    ]),
  );
}

