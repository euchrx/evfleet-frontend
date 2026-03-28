import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { Company } from "../types/company";
import { useAuth } from "./AuthContext";

export const COMPANY_SCOPE_STORAGE_KEY = "evfleet_selected_company_scope";

type ScopeOption = {
  id: string;
  name: string;
};

type CompanyScopeContextType = {
  selectedCompanyId: string;
  setSelectedCompanyId: (companyId: string) => void;
  options: ScopeOption[];
  isLoadingScopeOptions: boolean;
};

const CompanyScopeContext = createContext<CompanyScopeContextType | undefined>(undefined);

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [selectedCompanyId, setSelectedCompanyIdState] = useState("");
  const [options, setOptions] = useState<ScopeOption[]>([]);
  const [isLoadingScopeOptions, setIsLoadingScopeOptions] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COMPANY_SCOPE_STORAGE_KEY) || "";
    setSelectedCompanyIdState(saved);
  }, []);

  useEffect(() => {
    async function loadOptions() {
      if (!isAuthenticated || !user) {
        setOptions([]);
        return;
      }

      try {
        setIsLoadingScopeOptions(true);
        if (user.role === "ADMIN") {
          const response = await api.get<Company[]>("/companies", {
            headers: { "x-company-scope": "__ALL__" },
          });
          const companies = Array.isArray(response.data) ? response.data : [];
          setOptions(
            companies.map((company: Company) => ({
              id: company.id,
              name: company.name,
            })),
          );
          return;
        }

        const response = await api.get<Company>("/companies/me");
        const currentCompany = response.data;
        if (currentCompany?.id) {
          setOptions([{ id: currentCompany.id, name: currentCompany.name }]);
        } else {
          setOptions([]);
        }
      } catch {
        setOptions([]);
      } finally {
        setIsLoadingScopeOptions(false);
      }
    }

    loadOptions();
  }, [isAuthenticated, user]);

  function setSelectedCompanyId(companyId: string) {
    const normalized = String(companyId || "").trim();
    setSelectedCompanyIdState(normalized);

    if (normalized) {
      localStorage.setItem(COMPANY_SCOPE_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(COMPANY_SCOPE_STORAGE_KEY);
    }

    window.dispatchEvent(new Event("evfleet-company-scope-updated"));
  }

  const value = useMemo(
    () => ({
      selectedCompanyId,
      setSelectedCompanyId,
      options,
      isLoadingScopeOptions,
    }),
    [isLoadingScopeOptions, options, selectedCompanyId],
  );

  return <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>;
}

export function useCompanyScope() {
  const context = useContext(CompanyScopeContext);
  if (!context) {
    throw new Error("useCompanyScope deve ser usado dentro de CompanyScopeProvider");
  }
  return context;
}
