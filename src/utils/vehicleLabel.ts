type VehicleLike = {
  brand?: string | null;
  model?: string | null;
  plate?: string | null;
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

export function formatVehicleLabel(vehicle?: VehicleLike | null) {
  if (!vehicle) return "Veículo não identificado";

  const brand = clean(vehicle.brand);
  const model = clean(vehicle.model);
  const plate = clean(vehicle.plate);
  const modelLabel = [brand, model].filter(Boolean).join(" ").trim();

  if (plate && modelLabel) return `${plate} • ${modelLabel}`;
  if (plate) return plate;
  if (modelLabel) return modelLabel;
  return "Veículo não identificado";
}
