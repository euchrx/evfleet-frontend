import {
  ArrowRight,
  BarChart3,
  Building2,
  Fuel,
  ShieldCheck,
} from "lucide-react";

type HeroSectionProps = {
  productName: string;
};

const heroStats = [
  {
    icon: Building2,
    label: "Controle por unidade",
    value: "Matriz + filiais",
    description: "Visualize a operação consolidada ou separada por posto.",
  },
  {
    icon: Fuel,
    label: "Abastecimentos e custos",
    value: "Tudo rastreável",
    description: "Mais clareza sobre consumo, desvios e gasto por veículo.",
  },
  {
    icon: BarChart3,
    label: "Gestão executiva",
    value: "Indicadores reais",
    description: "Tenha visão rápida da frota, pendências e despesas críticas.",
  },
];

export function HeroSection({ productName }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(to_bottom,rgba(15,23,42,0.98),rgba(2,6,23,1))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            <ShieldCheck className="h-4 w-4" />
            Plataforma para rede de postos e operação
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Controle sua frota com padrão de operação, visão por filial e foco
            total em custo, disponibilidade e conformidade.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            O <span className="font-semibold text-white">{productName}</span>{" "}
            foi pensado para empresas com operação real: redes de postos,
            unidades distribuídas, veículos em campo e necessidade de acompanhar
            abastecimentos, manutenções, documentos, débitos e indicadores em um
            único ambiente.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="#cta"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Solicitar demonstração
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href="#preview"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Ver preview da plataforma
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Multiempresa
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Multifilial
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Dashboard executivo
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Relatórios gerenciais
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                  Painel operacional
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  Gestão central da frota
                </h3>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                Operação ativa
              </div>
            </div>

            <div className="grid gap-4">
              {heroStats.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm text-slate-400">{item.label}</p>
                        <p className="text-lg font-bold text-white">
                          {item.value}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-slate-300">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-5">
              <p className="text-sm font-semibold text-cyan-200">
                Ideal para operações que precisam:
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                padronizar rotinas, reduzir retrabalho, acompanhar custo por
                veículo e dar à matriz uma visão clara do que acontece em cada
                unidade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}