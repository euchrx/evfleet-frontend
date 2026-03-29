import { ArrowRight, BadgeCheck, BarChart3, Zap } from "lucide-react";

type HeroSectionProps = {
  productName: string;
};

export function HeroSection({ productName }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm sm:p-10">
      <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="min-w-0">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-200">
            <Zap size={14} />
            SaaS para frotas elétricas
          </span>

          <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Reduza custos e opere sua frota elétrica com controle total.
          </h1>

          <p className="mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
            O {productName} centraliza abastecimento elétrico, manutenção, viagens,
            débitos e indicadores financeiros em uma única plataforma moderna para
            gestores de operação e times executivos.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
            >
              Acessar plataforma
              <ArrowRight size={16} />
            </a>
            <a
              href="#preview"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 sm:w-auto"
            >
              Ver preview do sistema
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-orange-200">
              Disponibilidade
            </p>
            <p className="mt-1 text-2xl font-bold">99,9%</p>
            <p className="mt-1 text-xs text-slate-200">
              Operação contínua com monitoramento de indicadores.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-orange-200">
              Decisão orientada a dados
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <BarChart3 size={20} />
              Tempo real
            </p>
            <p className="mt-1 text-xs text-slate-200">
              KPIs financeiros e operacionais por empresa e por período.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 sm:col-span-2 lg:col-span-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <BadgeCheck size={16} />
              Pronto para escala multiempresa
            </p>
            <p className="mt-2 text-xs text-emerald-100">
              Controle de acesso, escopo por empresa e cobrança recorrente já
              integrados no fluxo da plataforma.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
