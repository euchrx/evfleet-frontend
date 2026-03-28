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
  login: (token: string, userFromLogin?: AuthUser | null) => Promise<void>;
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

function decodeTokenPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as {
      sub?: string;
      email?: string;
      role?: AuthUser["role"];
      companyId?: string;
      name?: string;
    };
  } catch {
    return null;
  }
}

function saveAuthUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_user_name");
    return;
  }
  localStorage.setItem("auth_user", JSON.stringify(user));
  if (user.name) {
    localStorage.setItem("auth_user_name", String(user.name));
  }
}

function readStoredAuthUser() {
  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  async function fetchMe() {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
      saveAuthUser(response.data);
      return true;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 && token) {
        const stored = readStoredAuthUser();
        if (stored) {
          setUser(stored);
          return true;
        }

        const payload = decodeTokenPayload(token);
        if (payload?.sub && payload?.email && payload?.role) {
          const fallbackUser: AuthUser = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            name: payload.name || localStorage.getItem("auth_user_name") || "Usuário",
            companyId: payload.companyId || null,
          };
          setUser(fallbackUser);
          saveAuthUser(fallbackUser);
          return true;
        }
      }

      console.error("Erro ao buscar usuario logado:", error);
      localStorage.removeItem("token");
      saveAuthUser(null);
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

  async function login(newToken: string, userFromLogin?: AuthUser | null) {
    const normalizedToken = normalizeToken(newToken);

    if (!normalizedToken) {
      throw new Error("Token inválido recebido no login.");
    }

    localStorage.setItem("token", normalizedToken);
    setToken(normalizedToken);
    if (userFromLogin) {
      setUser(userFromLogin);
      saveAuthUser(userFromLogin);
    }
    const ok = await fetchMe();

    if (!ok) {
      throw new Error("Não foi possível validar sua sessão.");
    }

  }

  function logout() {
    localStorage.removeItem("token");
    saveAuthUser(null);
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
