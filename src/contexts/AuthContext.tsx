import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../services/api";
import {
  clearAuthToken,
  readAuthToken,
  writeAuthToken,
} from "../services/authToken";
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
      userId?: string;
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

function normalizeAuthUserPayload(payload: any): AuthUser {
  return {
    id: String(payload?.id || ""),
    name: String(payload?.name || "Usuário"),
    email: String(payload?.email || ""),
    role: payload?.role,
    companyId: payload?.companyId ?? null,
    companyName: payload?.companyName ?? payload?.company?.name ?? null,
    branchId: payload?.branchId ?? null,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  async function fetchMe(tokenOverride?: string | null) {
    const effectiveToken = normalizeToken(tokenOverride ?? token ?? readAuthToken());
    if (!effectiveToken) {
      return false;
    }

    try {
      const response = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
        },
      });

      const normalizedUser = normalizeAuthUserPayload(response.data);
      setUser(normalizedUser);
      saveAuthUser(normalizedUser);
      return true;
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 404 && effectiveToken) {
        const stored = readStoredAuthUser();
        if (stored) {
          setUser(stored);
          return true;
        }

        const payload = decodeTokenPayload(effectiveToken);
        if ((payload?.sub || payload?.userId) && payload?.email && payload?.role) {
          const fallbackUser: AuthUser = {
            id: payload.sub || payload.userId || "",
            email: payload.email,
            role: payload.role,
            name: payload.name || localStorage.getItem("auth_user_name") || "Usuário",
            companyId: payload.companyId || null,
            companyName: null,
          };
          setUser(fallbackUser);
          saveAuthUser(fallbackUser);
          return true;
        }
      }

      console.error("Erro ao buscar usuario logado:", error);
      clearAuthToken();
      saveAuthUser(null);
      setToken(null);
      setUser(null);
      return false;
    }
  }

  useEffect(() => {
    async function initializeAuth() {
      const storedToken = normalizeToken(readAuthToken());

      if (!storedToken) {
        setIsLoadingAuth(false);
        return;
      }

      writeAuthToken(storedToken);
      setToken(storedToken);
      await fetchMe(storedToken);
      setIsLoadingAuth(false);
    }

    initializeAuth();
  }, []);

  async function login(newToken: string, userFromLogin?: AuthUser | null) {
    const normalizedToken = normalizeToken(newToken);

    if (!normalizedToken) {
      throw new Error("Token inválido recebido no login.");
    }

    writeAuthToken(normalizedToken);
    setToken(normalizedToken);

    if (userFromLogin) {
      const payload = decodeTokenPayload(normalizedToken);
      const normalizedUser: AuthUser = {
        ...userFromLogin,
        companyId: userFromLogin.companyId ?? payload?.companyId ?? null,
        companyName: userFromLogin.companyName ?? null,
      };
      setUser(normalizedUser);
      saveAuthUser(normalizedUser);
    }

    const ok = await fetchMe(normalizedToken);
    if (!ok) {
      throw new Error("Não foi possível validar sua sessão.");
    }
  }

  function logout() {
    clearAuthToken();
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
