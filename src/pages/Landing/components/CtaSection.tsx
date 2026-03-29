import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Pronto para elevar a gestão da sua frota?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Comece agora com uma plataforma orientada à performance operacional,
            custos controlados e visibilidade completa para o seu negócio.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Entrar e começar
            <ArrowRight size={16} />
          </a>
          <a
            href="/how-to-use"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver manual de uso
          </a>
        </div>
      </div>
    </section>
  );
}
