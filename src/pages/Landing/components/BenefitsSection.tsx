import { CircleDollarSign, Clock3, Eye, LineChart } from "lucide-react";

const benefits = [
  {
    icon: CircleDollarSign,
    title: "Redução de custos operacionais",
    detail:
      "Identifique desperdícios, anomalias de consumo e custos críticos por ativo.",
  },
  {
    icon: Eye,
    title: "Visibilidade ponta a ponta",
    detail:
      "Consolide operação, finanças e conformidade em uma visão única por empresa.",
  },
  {
    icon: Clock3,
    title: "Mais produtividade do time",
    detail:
      "Menos tarefas manuais com rotinas automatizadas e processos padronizados.",
  },
  {
    icon: LineChart,
    title: "Decisão orientada por indicadores",
    detail:
      "Use dados de período, categoria e histórico para planejar crescimento com segurança.",
  },
];

export function BenefitsSection() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Benefícios para gestores e operação
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Mais controle, menos ruído e uma base sólida para escalar a gestão da
          frota com eficiência.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-2 inline-flex rounded-xl bg-orange-100 p-2 text-orange-600">
              <benefit.icon size={17} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {benefit.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{benefit.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
