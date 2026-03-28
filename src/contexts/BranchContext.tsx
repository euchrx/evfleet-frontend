import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBranches } from "../services/branches";
import { readSoftwareSettings } from "../services/adminSettings";
import type { Branch } from "../types/branch";
import { useAuth } from "./AuthContext";
import { useCompanyScope } from "./CompanyScopeContext";

type BranchContextType = {
  branches: Branch[];
  selectedBranchId: string;
  selectedBranch: Branch | null;
  currentBranchId: string;
  currentBranch: Branch | null;
  isLoadingBranches: boolean;
  branchErrorMessage: string;
  setSelectedBranchId: (branchId: string) => void;
  setCurrentBranchId: (branchId: string) => void;
  reloadBranches: () => Promise<void>;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

type BranchProviderProps = {
  children: ReactNode;
};

export function BranchProvider({ children }: BranchProviderProps) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { selectedCompanyId, canSelectCompanyScope } = useCompanyScope();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [branchErrorMessage, setBranchErrorMessage] = useState("");

  const isAdminWithoutCompanyScope =
    canSelectCompanyScope && user?.role === "ADMIN" && !selectedCompanyId;

  async function loadBranches() {
    if (isAdminWithoutCompanyScope) {
      setBranches([]);
      setSelectedBranchIdState("");
      setIsLoadingBranches(false);
      setBranchErrorMessage("Selecione uma empresa para carregar as filiais.");
      localStorage.removeItem("selectedBranchId");
      return;
    }

    try {
      setIsLoadingBranches(true);
      setBranchErrorMessage("");
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setBranches([]);
      setBranchErrorMessage(
        error?.response?.data?.message ||
          error?.message ||
          "Não foi possível carregar as filiais.",
      );
    } finally {
      setIsLoadingBranches(false);
    }
  }

  useEffect(() => {
    if (isLoadingAuth) {
      setIsLoadingBranches(true);
      return;
    }

    if (!isAuthenticated) {
      setBranches([]);
      setSelectedBranchIdState("");
      setIsLoadingBranches(false);
      setBranchErrorMessage("");
      return;
    }

    loadBranches();
  }, [isAuthenticated, isLoadingAuth, isAdminWithoutCompanyScope, selectedCompanyId]);

  useEffect(() => {
    if (!user || branches.length === 0) return;

    const settings = readSoftwareSettings();
    const fixedBranchId = settings.defaultBranchId;
    const fixedBranchExists =
      settings.lockDefaultBranch &&
      fixedBranchId &&
      branches.some((branch) => branch.id === fixedBranchId);

    if (fixedBranchExists) {
      setSelectedBranchIdState(fixedBranchId);
      localStorage.setItem("selectedBranchId", fixedBranchId);
      return;
    }

    const savedBranchId = localStorage.getItem("selectedBranchId");
    const savedBranchExists = branches.some((branch) => branch.id === savedBranchId);

    if (savedBranchId && savedBranchExists) {
      setSelectedBranchIdState(savedBranchId);
      return;
    }

    setSelectedBranchIdState("");
    localStorage.removeItem("selectedBranchId");
  }, [user, branches]);

  useEffect(() => {
    function handleDefaultBranchUpdate() {
      if (branches.length === 0) return;
      const settings = readSoftwareSettings();
      const fixedBranchId = settings.defaultBranchId;
      const fixedBranchExists =
        settings.lockDefaultBranch &&
        fixedBranchId &&
        branches.some((branch) => branch.id === fixedBranchId);

      if (fixedBranchExists) {
        setSelectedBranchIdState(fixedBranchId);
        localStorage.setItem("selectedBranchId", fixedBranchId);
        return;
      }

      setSelectedBranchIdState("");
      localStorage.removeItem("selectedBranchId");
    }

    window.addEventListener("evfleet-default-branch-updated", handleDefaultBranchUpdate);
    return () =>
      window.removeEventListener("evfleet-default-branch-updated", handleDefaultBranchUpdate);
  }, [branches]);

  function setSelectedBranchId(branchId: string) {
    const settings = readSoftwareSettings();
    const fixedBranchId = settings.defaultBranchId;
    const fixedBranchExists =
      settings.lockDefaultBranch &&
      fixedBranchId &&
      branches.some((branch) => branch.id === fixedBranchId);

    if (fixedBranchExists) {
      setSelectedBranchIdState(fixedBranchId);
      localStorage.setItem("selectedBranchId", fixedBranchId);
      return;
    }

    setSelectedBranchIdState(branchId);

    if (branchId) {
      localStorage.setItem("selectedBranchId", branchId);
      return;
    }

    localStorage.removeItem("selectedBranchId");
  }

  const selectedBranch = useMemo(() => {
    return branches.find((branch) => branch.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranchId,
        selectedBranch,
        currentBranchId: selectedBranchId,
        currentBranch: selectedBranch,
        isLoadingBranches,
        branchErrorMessage,
        setSelectedBranchId,
        setCurrentBranchId: setSelectedBranchId,
        reloadBranches: loadBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);

  if (!context) {
    throw new Error("useBranch deve ser usado dentro de BranchProvider");
  }

  return context;
}

