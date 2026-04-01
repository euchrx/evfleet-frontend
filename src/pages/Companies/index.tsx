import { CompaniesSection } from "./CompaniesSection";
import { FinanceOverviewSection } from "./FinanceOverviewSection";

export function CompaniesPage() {
  return (
    <div className="space-y-8">
      <CompaniesSection
        title="Cadastro de empresas"
        description="Gerencie as empresas antes da visão financeira consolidada."
      />
      <FinanceOverviewSection />
    </div>
  );
}
