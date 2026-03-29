import { Building2, LogIn } from "lucide-react";
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
  const productName = softwareSettings.companyName?.trim() || defaultSoftwareSettings.companyName;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/landing" className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Building2 size={18} />
            </span>
            <span className="text-lg font-bold text-slate-900">{productName}</span>
          </Link>

          <nav className="hidden items-center gap-4 md:flex">
            <a href="#funcionalidades" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Funcionalidades
            </a>
            <a href="#beneficios" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Benefícios
            </a>
            <a href="#preview" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Preview
            </a>
          </nav>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <LogIn size={16} />
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <HeroSection productName={productName} />
        <ProblemSolutionSection />
        <div id="funcionalidades">
          <FeaturesSection />
        </div>
        <div id="beneficios">
          <BenefitsSection />
        </div>
        <PreviewSection />
        <FaqSection />
        <CtaSection />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {productName}. Todos os direitos reservados.</p>
          <p>Gestão de frota elétrica com foco em eficiência, controle e escala.</p>
        </div>
      </footer>
    </div>
  );
}
