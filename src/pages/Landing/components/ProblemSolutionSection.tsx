import { AlertTriangle, CheckCircle2 } from "lucide-react";

const problems = [
  "Informações espalhadas entre planilhas, grupos de WhatsApp e controles isolados por unidade.",
  "Baixa visibilidade sobre custo real por veículo, filial, período e tipo de despesa.",
  "Dificuldade para acompanhar documentos, multas, débitos e manutenção antes que virem problema.",
  "Falta de padrão entre matriz e postos, gerando retrabalho e decisões lentas.",
];

const solutions = [
  "Operação centralizada com visão executiva para a matriz e visão prática para cada unidade.",
  "Histórico completo de abastecimentos, manutenções, documentos, viagens e eventos operacionais.",
  "Mais controle sobre disponibilidade da frota, conformidade e custo por ativo.",
  "Relatórios gerenciais para identificar desperdícios, gargalos e veículos mais caros da operação.",
];

export function ProblemSolutionSection() {
  return (
    <section className="border-y border-white/10 bg-slate-900/60">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-2 lg:px-8">
        <div className="rounded-[2rem] border border-rose-400/15 bg-rose-400/5 p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-rose-300/80">
                O cenário atual
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Onde a operação normalmente perde controle
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            {problems.map((problem) => (
              <div
                key={problem}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-300"
              >
                {problem}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/15 bg-cyan-400/5 p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300/80">
                A proposta do EvFleet
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Uma plataforma para organizar a rotina e dar visão à gestão
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            {solutions.map((solution) => (
              <div
                key={solution}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-200"
              >
                {solution}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}