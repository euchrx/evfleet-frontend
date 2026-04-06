import { ArrowRight, MessageCircle, PlayCircle } from "lucide-react";

export function CtaSection() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden border-t border-white/10 bg-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_40%)]" />

      <div className="relative mx-auto max-w-5xl px-6 py-20 text-center lg:px-8">
        <div className="rounded-[2rem] border border-cyan-400/15 bg-cyan-400/[0.06] px-8 py-12 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Próximo passo
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Transforme a gestão da sua frota em uma operação mais previsível,
            rastreável e profissional.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Se a sua empresa precisa de mais controle entre matriz, filiais,
            veículos, abastecimentos e manutenção, o EvFleet foi pensado para
            essa realidade.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <PlayCircle className="h-4 w-4" />
              Acessar plataforma
            </a>

            <a
              href="https://wa.me/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com especialista
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}