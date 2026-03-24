import axios from "axios";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { defaultSoftwareSettings, readSoftwareSettings } from "../../services/adminSettings";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const companyName = readSoftwareSettings().companyName?.trim() || defaultSoftwareSettings.companyName;

  function getErrorMessage(error: unknown) {
    if (axios.isAxiosError(error)) {
      const apiMessage = error.response?.data?.message;

      if (Array.isArray(apiMessage) && apiMessage.length > 0) {
        return String(apiMessage[0]);
      }

      if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
        return apiMessage;
      }

      if (error.response?.status === 401) {
        return "E-mail ou senha inválidos.";
      }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return "Não foi possível fazer login. Verifique a API e tente novamente.";
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      const token =
        response.data?.access_token ||
        response.data?.token ||
        response.data?.accessToken;

      if (!token) {
        throw new Error("Token não encontrado na resposta do login.");
      }

      await login(token);
      navigate("/dashboard");
    } catch (error) {
      console.error("Erro no login:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            {companyName}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Painel de gestão de frota
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              E-mail
            </label>

            <input
              type="email"
              placeholder="seuemail@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Senha
            </label>

            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {errorMessage && (
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
