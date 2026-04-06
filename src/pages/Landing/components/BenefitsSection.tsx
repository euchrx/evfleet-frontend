import { CircleDollarSign, Clock3, Eye, LineChart } from "lucide-react";

const benefits = [
  {
    icon: CircleDollarSign,
    title: "Mais controle sobre custo operacional",
    detail:
      "Identifique veículos caros, gastos recorrentes, pontos de desperdício e oportunidades de correção por unidade.",
  },
  {
    icon: Eye,
    title: "Visão clara da operação",
    detail:
      "A matriz acompanha a rede com mais segurança, enquanto cada posto enxerga o que realmente precisa executar.",
  },
  {
    icon: Clock3,
    title: "Menos retrabalho e mais padrão",
    detail:
      "Centralize rotinas, reduza controles paralelos e dê mais fluidez para a operação do dia a dia.",
  },
  {
    icon: LineChart,
    title: "Decisão com base em dados",
    detail:
      "Use indicadores, rankings e histórico para melhorar disponibilidade da frota e eficiência da operação.",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="bg-slate-900/50">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Benefícios
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Mais gestão para a matriz. Mais praticidade para a operação.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            O ganho não está só em registrar dados, mas em transformar a rotina
            da frota em um processo mais organizado, confiável e previsível.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <div
                key={benefit.title}
                className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-7"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-bold text-white">
                  {benefit.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {benefit.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}