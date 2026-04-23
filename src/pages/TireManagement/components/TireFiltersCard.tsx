type Props = {
  totalTires: number;
  totalInvestment: number;
};

export function TireFiltersCard({
  totalTires,
  totalInvestment,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          Qtd total de pneus
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900">
          {totalTires}
        </p>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-wide text-orange-700">
          Investimento total
        </p>
        <p className="mt-2 text-2xl font-bold text-orange-700">
          {totalInvestment.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
      </div>
    </div>
  );
}