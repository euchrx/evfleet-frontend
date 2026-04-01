import { CompaniesSection } from "./CompaniesSection";
import { FinanceOverviewSection } from "./FinanceOverviewSection";

export function CompaniesPage() {
  return (
    <div className="space-y-8">
      <FinanceOverviewSection />
      <CompaniesSection
        title="Cadastro de empresas"
        description="Gerencie as empresas logo abaixo da visão administrativa."
      />
    </div>
  );
}
