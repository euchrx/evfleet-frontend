import {
  BadgeAlert,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Fuel,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Visão central por matriz e filial",
    description:
      "Acompanhe cada posto individualmente ou a operação consolidada, com leitura clara para gestores locais e direção.",
  },
  {
    icon: Fuel,
    title: "Controle de abastecimentos com rastreabilidade",
    description:
      "Registre, organize e acompanhe abastecimentos para entender consumo, frequência, desvios e impacto por veículo.",
  },
  {
    icon: Wrench,
    title: "Manutenção preventiva e corretiva",
    description:
      "Gerencie histórico, pendências, planos de manutenção e status da frota para reduzir paradas inesperadas.",
  },
  {
    icon: BadgeAlert,
    title: "Documentos, multas e débitos",
    description:
      "Tenha mais controle sobre vencimentos, pendências e conformidade da frota em um fluxo único.",
  },
  {
    icon: Route,
    title: "Viagens, deslocamentos e uso operacional",
    description:
      "Monitore a rotina dos veículos e registre movimentações relevantes para apoiar decisões de operação.",
  },
  {
    icon: BarChart3,
    title: "Dashboard e relatórios gerenciais",
    description:
      "Visualize custos, rankings, indicadores e histórico por período, unidade, veículo e categoria.",
  },
  {
    icon: FileSpreadsheet,
    title: "Importações e produtividade operacional",
    description:
      "Reduza retrabalho com fluxos de importação e organização de dados voltados à rotina do time.",
  },
  {
    icon: ShieldCheck,
    title: "Base SaaS pronta para crescer",
    description:
      "Estrutura multiempresa, controle de acesso e organização adequada para operações com mais escala.",
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Funcionalidades
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tudo o que uma rede de postos precisa para controlar melhor sua
            frota
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            O EvFleet foi pensado para o dia a dia da operação. Menos improviso,
            mais padrão, mais clareza e mais capacidade de decisão.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.05]"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 transition group-hover:bg-cyan-400/15">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-bold leading-7 text-white">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}