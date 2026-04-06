import { useRef, useState } from "react";
import { CompaniesSection } from "./CompaniesSection";
import { FinanceOverviewSection } from "./FinanceOverviewSection";
import type { Company } from "../../types/company";

export function CompaniesPage() {
  const financeSectionRef = useRef<HTMLDivElement | null>(null);
  const [focusedFinanceCompanyId, setFocusedFinanceCompanyId] = useState<string | null>(null);

  function handleQuickViewFinance(company: Company) {
    setFocusedFinanceCompanyId(company.id);

    window.requestAnimationFrame(() => {
      financeSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="space-y-8">
      <CompaniesSection
        title="Cadastro de empresas"
        description="Gerencie as empresas antes da visão financeira consolidada."
        onQuickViewFinance={handleQuickViewFinance}
      />

      <div ref={financeSectionRef}>
        <FinanceOverviewSection focusedCompanyId={focusedFinanceCompanyId} />
      </div>
    </div>
  );
}
