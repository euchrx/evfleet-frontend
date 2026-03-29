export function formatFuelTypeLabel(value?: string | null) {
  const fuelType = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (fuelType === "GASOLINE") return "Gasolina";
  if (fuelType === "ETHANOL") return "Etanol";
  if (fuelType === "DIESEL") return "Diesel";
  if (fuelType === "FLEX") return "Flex";
  if (fuelType === "ELECTRIC") return "Elétrico";
  if (fuelType === "HYBRID") return "Híbrido";
  if (fuelType === "CNG") return "GNV";

  return value || "-";
}
