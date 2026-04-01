export function formatFuelTypeLabel(value?: string | null) {
  const fuelType = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (fuelType === "GASOLINE") return "GASOLINA";
  if (fuelType === "ETHANOL") return "ETANOL";
  if (fuelType === "DIESEL") return "DIESEL";
  if (fuelType === "ARLA32" || fuelType === "ARLA_32") return "ARLA 32";
  if (fuelType === "FLEX") return "FLEX";
  if (fuelType === "ELECTRIC") return "ELÉTRICO";
  if (fuelType === "HYBRID") return "HÍBRIDO";
  if (fuelType === "CNG") return "GNV";

  return String(value || "-").toUpperCase();
}
