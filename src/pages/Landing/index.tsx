import { Building2, Fuel } from "lucide-react";
import { Link } from "react-router-dom";
import {
  defaultSoftwareSettings,
  readSoftwareSettings,
} from "../../services/adminSettings";
import { BenefitsSection } from "./components/BenefitsSection";
import { CtaSection } from "./components/CtaSection";
import { FaqSection } from "./components/FaqSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HeroSection } from "./components/HeroSection";
import { PreviewSection } from "./components/PreviewSection";
import { ProblemSolutionSection } from "./components/ProblemSolutionSection";

export function LandingPage() {
  const softwareSettings = readSoftwareSettings();
  const productName =
    softwareSettings.companyName?.trim() || defaultSoftwareSettings.companyName;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
              <Fuel className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                Plataforma de operação
              </p>
              <div className="flex items-center">
                <img
                  src="/src/assets/logo.png"
                  alt="EvFleet"
                  className="h-10 w-auto object-contain"
                />
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#funcionalidades"
              className="text-sm text-slate-300 transition hover:text-white"
            >
              Funcionalidades
            </a>
            <a
              href="#beneficios"
              className="text-sm text-slate-300 transition hover:text-white"
            >
              Benefícios
            </a>
            <a
              href="#preview"
              className="text-sm text-slate-300 transition hover:text-white"
            >
              Preview
            </a>
            <a
              href="#faq"
              className="text-sm text-slate-300 transition hover:text-white"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">

            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Building2 className="h-4 w-4" />
              Solicitar demonstração
            </a>
          </div>
        </div>
      </header>

      <main>
        <HeroSection productName={productName} />
        <ProblemSolutionSection />
        <FeaturesSection />
        <BenefitsSection />
        <PreviewSection />
        <FaqSection />
        <CtaSection />
      </main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10">
                <Fuel className="h-5 w-5 text-cyan-300" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/75">
                  Gestão operacional
                </p>
                <p className="text-lg font-bold tracking-tight text-white">
                  {productName}
                </p>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-7 text-slate-400">
              Plataforma SaaS para redes de postos e operações com frota própria,
              com foco em controle por filial, redução de custos, compliance e
              visão executiva da operação.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
              Navegação
            </h3>
            <div className="space-y-3 text-sm text-slate-400">
              <a href="#funcionalidades" className="block hover:text-white">
                Funcionalidades
              </a>
              <a href="#beneficios" className="block hover:text-white">
                Benefícios
              </a>
              <a href="#preview" className="block hover:text-white">
                Preview
              </a>
              <a href="#faq" className="block hover:text-white">
                FAQ
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
              Posicionamento
            </h3>
            <div className="space-y-3 text-sm text-slate-400">
              <p>Multiempresa e multifilial</p>
              <p>Controle de custos por veículo</p>
              <p>Rastreabilidade operacional</p>
              <p>Operação pronta para escalar</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-sm text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8">
            <p>
              © {new Date().getFullYear()} {productName}. Todos os direitos
              reservados.
            </p>
            <p>Gestão de frota com foco em rede de postos e operação real.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}