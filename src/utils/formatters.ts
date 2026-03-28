export function formatCurrency(cents: number, currency = "BRL") {
  const normalized = Number.isFinite(cents) ? cents / 100 : 0;
  return normalized.toLocaleString("pt-BR", { style: "currency", currency });
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}
