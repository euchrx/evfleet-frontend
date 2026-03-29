import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ProblemSolutionSection() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="mb-3 inline-flex rounded-xl bg-red-100 p-2 text-red-700">
          <AlertTriangle size={18} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">O problema atual</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Dados operacionais espalhados entre planilhas, mensagens e sistemas isolados.</li>
          <li>Baixa visibilidade sobre custo por veículo, condutor e rota.</li>
          <li>Dificuldade para antecipar riscos de manutenção e inadimplência.</li>
          <li>Tempo excessivo para consolidar relatórios gerenciais confiáveis.</li>
        </ul>
      </article>

      <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="mb-3 inline-flex rounded-xl bg-emerald-100 p-2 text-emerald-700">
          <CheckCircle2 size={18} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">A solução com EvFleet</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Operação centralizada com visão executiva e visão operacional por módulo.</li>
          <li>Automação de alertas críticos e histórico auditável de eventos do sistema.</li>
          <li>Relatórios exportáveis com filtros multiempresa, período e ativos específicos.</li>
          <li>Arquitetura SaaS pronta para crescimento com governança e segurança.</li>
        </ul>
      </article>
    </section>
  );
}
