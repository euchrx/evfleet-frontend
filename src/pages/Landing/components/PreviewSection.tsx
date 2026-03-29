import { ArrowUpRight, CarFront, CreditCard, Fuel, Wrench } from "lucide-react";

const mockRows = [
  {
    vehicle: "ABC1D23 • BYD D1",
    category: "Leve",
    cost: "R$ 2.940,00",
    status: "Ativo",
  },
  {
    vehicle: "DEF2E34 • VOLVO VM",
    category: "Pesado",
    cost: "R$ 7.880,00",
    status: "Manutenção",
  },
  {
    vehicle: "GHI3F45 • JAC E-JT",
    category: "Leve",
    cost: "R$ 1.760,00",
    status: "Ativo",
  },
];

export function PreviewSection() {
  return (
    <section id="preview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Preview do sistema</h2>
          <p className="mt-2 text-sm text-slate-600">
            Interface pensada para rotina operacional com leitura rápida e decisão objetiva.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Ver no produto
          <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">Custo energia</p>
              <p className="mt-1 text-xl font-bold text-slate-900">R$ 21.840</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-700">Manutenção</p>
              <p className="mt-1 text-xl font-bold text-slate-900">R$ 8.420</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase text-blue-700">Débitos</p>
              <p className="mt-1 text-xl font-bold text-slate-900">R$ 1.330</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Veículo</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo mês</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockRows.map((row) => (
                  <tr key={row.vehicle} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{row.vehicle}</td>
                    <td className="px-4 py-3 text-slate-700">{row.category}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.cost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`status-pill ${
                          row.status === "Ativo" ? "status-active" : "status-pending"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CarFront size={16} className="text-orange-600" />
              Frota monitorada
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">128 veículos</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Fuel size={16} className="text-emerald-600" />
              Consumo médio equivalente
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">14,8 km/L</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wrench size={16} className="text-amber-600" />
              Manutenções pendentes
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">9</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CreditCard size={16} className="text-blue-600" />
              Despesa consolidada
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">R$ 31.590</p>
          </div>
        </div>
      </div>
    </section>
  );
}
