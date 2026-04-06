import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCompanies, getCompanyById, getMyCompany } from "../services/companies";
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
  canSelectCompanyScope: boolean;
  currentCompany: Company | null;
  isLoadingCurrentCompany: boolean;
  companyErrorMessage: string;
};

const CompanyScopeContext = createContext<CompanyScopeContextType | undefined>(undefined);

function normalizeCompanyErrorMessage(error: any) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Não foi possível carregar o contexto da empresa."
  );
}

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [selectedCompanyId, setSelectedCompanyIdState] = useState("");
  const [options, setOptions] = useState<ScopeOption[]>([]);
  const [isLoadingScopeOptions, setIsLoadingScopeOptions] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isLoadingCurrentCompany, setIsLoadingCurrentCompany] = useState(false);
  const [companyErrorMessage, setCompanyErrorMessage] = useState("");

  function clearSelectedCompanyScope() {
    setSelectedCompanyIdState("");
    localStorage.removeItem(COMPANY_SCOPE_STORAGE_KEY);
    window.dispatchEvent(new Event("evfleet-company-scope-updated"));
  }

  useEffect(() => {
    const saved = localStorage.getItem(COMPANY_SCOPE_STORAGE_KEY) || "";
    setSelectedCompanyIdState(saved);
  }, []);

  useEffect(() => {
    async function bootstrapAdminScope() {
      if (isLoadingAuth) return;

      if (!isAuthenticated || !user) {
        setOptions([]);
        setCurrentCompany(null);
        setCompanyErrorMessage("");
        return;
      }

      if (user.role !== "ADMIN") return;

      setCompanyErrorMessage("");
      setIsLoadingScopeOptions(true);

      try {
        const companies = await getCompanies();
        const normalizedOptions = companies.map((company: Company) => ({
          id: company.id,
          name: company.name,
        }));

        setOptions(normalizedOptions);

        const scopedCompanyId = String(selectedCompanyId || "").trim();
        if (!scopedCompanyId) {
          setCurrentCompany(null);
          return;
        }

        const companyExistsInScopeList = companies.some(
          (company: Company) => String(company.id) === scopedCompanyId,
        );

        if (!companyExistsInScopeList) {
          clearSelectedCompanyScope();
          setCurrentCompany(null);
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          clearSelectedCompanyScope();
          setCurrentCompany(null);
          setOptions([]);
          setCompanyErrorMessage("");
          return;
        }

        setCurrentCompany(null);
        setOptions([]);
        setCompanyErrorMessage(normalizeCompanyErrorMessage(error));
      } finally {
        setIsLoadingScopeOptions(false);
      }
    }

    bootstrapAdminScope();
  }, [isAuthenticated, isLoadingAuth, selectedCompanyId, user]);

  useEffect(() => {
    async function loadAdminCurrentCompany() {
      if (isLoadingAuth || !isAuthenticated || !user || user.role !== "ADMIN") return;

      const scopedCompanyId = String(selectedCompanyId || "").trim();
      if (!scopedCompanyId) {
        setCurrentCompany(null);
        setCompanyErrorMessage("");
        return;
      }

      setCompanyErrorMessage("");
      setIsLoadingCurrentCompany(true);

      try {
        const scopedCompany = await getCompanyById(scopedCompanyId);
        setCurrentCompany(scopedCompany || null);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          clearSelectedCompanyScope();
          setCurrentCompany(null);
          setCompanyErrorMessage("");
          return;
        }

        setCurrentCompany(null);
        setCompanyErrorMessage(normalizeCompanyErrorMessage(error));
      } finally {
        setIsLoadingCurrentCompany(false);
      }
    }

    loadAdminCurrentCompany();
  }, [isAuthenticated, isLoadingAuth, selectedCompanyId, user]);

  useEffect(() => {
    async function bootstrapUserCompany() {
      if (isLoadingAuth) return;

      if (!isAuthenticated || !user) {
        setOptions([]);
        setCurrentCompany(null);
        setCompanyErrorMessage("");
        return;
      }

      if (user.role === "ADMIN") return;

      setCompanyErrorMessage("");
      setIsLoadingScopeOptions(true);
      setIsLoadingCurrentCompany(true);

      try {
        let myCompany: Company | null = null;
        let myCompanyError: any = null;

        try {
          myCompany = await getMyCompany();
        } catch (error: any) {
          myCompanyError = error;
        }

        if (!myCompany?.id) {
          if (user.companyId) {
            const fallbackCompany: Company = {
              id: user.companyId,
              name: String(user.companyName || "").trim() || "Empresa vinculada",
              document: null,
              slug: null,
              active: true,
              createdAt: new Date(0).toISOString(),
            };

            setCurrentCompany(fallbackCompany);
            setOptions([{ id: fallbackCompany.id, name: fallbackCompany.name }]);

            if (selectedCompanyId !== fallbackCompany.id) {
              setSelectedCompanyIdState(fallbackCompany.id);
              localStorage.setItem(COMPANY_SCOPE_STORAGE_KEY, fallbackCompany.id);
              window.dispatchEvent(new Event("evfleet-company-scope-updated"));
            }
            return;
          }

          setCurrentCompany(null);
          setOptions([]);
          setCompanyErrorMessage(
            myCompanyError?.response?.status === 401
              ? "Seu usuário autenticado não está vinculado corretamente a uma empresa."
              : "Empresa da sessão não encontrada.",
          );
          return;
        }

        setCurrentCompany(myCompany);
        setOptions([{ id: myCompany.id, name: myCompany.name }]);

        if (selectedCompanyId !== myCompany.id) {
          setSelectedCompanyIdState(myCompany.id);
          localStorage.setItem(COMPANY_SCOPE_STORAGE_KEY, myCompany.id);
          window.dispatchEvent(new Event("evfleet-company-scope-updated"));
        }
      } catch (error: any) {
        setCurrentCompany(null);
        setOptions([]);
        setCompanyErrorMessage(normalizeCompanyErrorMessage(error));
      } finally {
        setIsLoadingScopeOptions(false);
        setIsLoadingCurrentCompany(false);
      }
    }

    bootstrapUserCompany();
  }, [
    isAuthenticated,
    isLoadingAuth,
    user?.companyId,
    user?.companyName,
    user?.id,
    user?.role,
  ]);

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
      canSelectCompanyScope: user?.role === "ADMIN",
      currentCompany,
      isLoadingCurrentCompany,
      companyErrorMessage,
    }),
    [
      companyErrorMessage,
      currentCompany,
      isLoadingCurrentCompany,
      isLoadingScopeOptions,
      options,
      selectedCompanyId,
      user?.role,
    ],
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
