import {
  ArrowUpRight,
  BadgeAlert,
  Building2,
  Fuel,
  Truck,
  Wrench,
} from "lucide-react";

const mockRows = [
  {
    vehicle: "RTA-1A23 • Fiat Strada",
    unit: "Posto Matriz",
    cost: "R$ 3.420,00",
    status: "Ativo",
  },
  {
    vehicle: "RTB-4K98 • Chevrolet S10",
    unit: "Posto BR-116",
    cost: "R$ 5.180,00",
    status: "Manutenção",
  },
  {
    vehicle: "RTC-9P17 • Hyundai HR",
    unit: "Posto Centro",
    cost: "R$ 4.090,00",
    status: "Ativo",
  },
];

const quickCards = [
  {
    icon: Building2,
    label: "Unidades acompanhadas",
    value: "11 postos",
  },
  {
    icon: Truck,
    label: "Frota monitorada",
    value: "48 veículos",
  },
  {
    icon: Fuel,
    label: "Abastecimentos no mês",
    value: "326 registros",
  },
  {
    icon: Wrench,
    label: "Manutenções pendentes",
    value: "7 alertas",
  },
  {
    icon: BadgeAlert,
    label: "Documentos a vencer",
    value: "12 avisos",
  },
];

export function PreviewSection() {
  return (
    <section id="preview" className="bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
              Preview
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Interface pensada para leitura rápida e operação sem ruído
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              O foco da plataforma é facilitar a rotina: enxergar o que exige
              atenção, entender o custo e agir rápido.
            </p>
          </div>

          <a
            href="/login"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
          >
            Ver no produto
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Custo com abastecimento</p>
                <p className="mt-2 text-2xl font-black text-white">
                  R$ 26.840
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Custo com manutenção</p>
                <p className="mt-2 text-2xl font-black text-white">
                  R$ 9.730
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Pendências e débitos</p>
                <p className="mt-2 text-2xl font-black text-white">
                  R$ 1.940
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-4 bg-white/5 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <span>Veículo</span>
                <span>Unidade</span>
                <span>Custo mês</span>
                <span>Status</span>
              </div>

              <div className="divide-y divide-white/10">
                {mockRows.map((row) => (
                  <div
                    key={row.vehicle}
                    className="grid grid-cols-4 px-5 py-4 text-sm text-slate-300"
                  >
                    <span className="font-medium text-white">{row.vehicle}</span>
                    <span>{row.unit}</span>
                    <span>{row.cost}</span>
                    <span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold">
                        {row.status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {quickCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>

                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {card.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}