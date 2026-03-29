import {
  BadgeAlert,
  BarChart3,
  CreditCard,
  FileSpreadsheet,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Dashboard executivo em tempo real",
    description:
      "Acompanhe custos, ativos, rankings e indicadores chave em poucos cliques.",
  },
  {
    icon: Wrench,
    title: "Gestão de manutenção preventiva e corretiva",
    description:
      "Controle planos, peças trocadas, status e histórico por veículo com rastreabilidade.",
  },
  {
    icon: Route,
    title: "Viagens e quilometragem integradas",
    description:
      "Tenha visão completa de rotas, uso da frota e produtividade operacional.",
  },
  {
    icon: BadgeAlert,
    title: "Débitos, multas e documentos",
    description:
      "Gerencie vencimentos, pendências e conformidade em um fluxo único.",
  },
  {
    icon: CreditCard,
    title: "Assinatura SaaS multiempresa",
    description:
      "Escopo por empresa, plano atual, histórico de pagamentos e regularização rápida.",
  },
  {
    icon: FileSpreadsheet,
    title: "Importação e relatórios avançados",
    description:
      "Importe dados em lote e gere relatórios com filtros completos para auditoria e gestão.",
  },
];

export function FeaturesSection() {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900">Funcionalidades que aceleram a operação</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Tudo o que um gestor de frota elétrica precisa para reduzir retrabalho,
          aumentar previsibilidade e tomar decisões com dados confiáveis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200"
          >
            <div className="mb-3 inline-flex rounded-xl bg-orange-100 p-2 text-orange-600">
              <feature.icon size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        <span className="inline-flex items-center gap-1 font-semibold">
          <ShieldCheck size={14} />
          Compliance e segurança:
        </span>{" "}
        autenticação JWT, escopo por empresa e controle de acesso por perfil.
      </div>
    </section>
  );
}
