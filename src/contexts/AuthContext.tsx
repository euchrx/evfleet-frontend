import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../services/api";
import type { AuthUser } from "../types/auth-user";

type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

function normalizeToken(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "");
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  async function fetchMe() {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
      if (response.data?.name) {
        localStorage.setItem("auth_user_name", String(response.data.name));
      }
      return true;
    } catch (error) {
      console.error("Erro ao buscar usuario logado:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("auth_user_name");
      setToken(null);
      setUser(null);
      return false;
    }
  }

  useEffect(() => {
    async function initializeAuth() {
      const storedToken = normalizeToken(localStorage.getItem("token"));

      if (!storedToken) {
        setIsLoadingAuth(false);
        return;
      }

      localStorage.setItem("token", storedToken);
      setToken(storedToken);
      await fetchMe();
      setIsLoadingAuth(false);
    }

    initializeAuth();
  }, []);

  async function login(newToken: string) {
    const normalizedToken = normalizeToken(newToken);

    if (!normalizedToken) {
      throw new Error("Token inválido recebido no login.");
    }

    localStorage.setItem("token", normalizedToken);
    setToken(normalizedToken);
    const ok = await fetchMe();

    if (!ok) {
      throw new Error("Não foi possível validar sua sessão.");
    }

  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user_name");
    setToken(null);
    setUser(null);
  }

  async function refreshMe() {
    await fetchMe();
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoadingAuth,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
