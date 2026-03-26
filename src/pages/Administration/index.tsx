import { useEffect, useState } from "react";
import { Building2, Settings2, ShieldCheck } from "lucide-react";
import { addSystemLog } from "../../services/systemLogs";
import { getBranches } from "../../services/branches";
import type { Branch } from "../../types/branch";
import {
  defaultSoftwareSettings,
  readSoftwareSettings,
  saveSoftwareSettings,
  type SoftwareSettings,
} from "../../services/adminSettings";
import { resetAllDatabaseWithToken } from "../../services/systemReset";
import {
  MENU_VISIBILITY_ITEMS,
  fetchMenuVisibilityMap,
  getDefaultMenuVisibilityMap,
  saveMenuVisibilityMap,
  type MenuVisibilityMap,
} from "../../services/menuVisibility";

export function AdministrationPage() {
  const [settings, setSettings] = useState<SoftwareSettings>(defaultSoftwareSettings);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityMap>(getDefaultMenuVisibilityMap());
  const [savedAt, setSavedAt] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateFeedback, setUpdateFeedback] = useState("");
  const [resettingAll, setResettingAll] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetJwtToken, setResetJwtToken] = useState("");
  const [resetJwtTokenError, setResetJwtTokenError] = useState("");

  useEffect(() => {
    setSettings(readSoftwareSettings());
    fetchMenuVisibilityMap().then(setMenuVisibility);
    getBranches().then((items) => setBranches(Array.isArray(items) ? items : []));
  }, []);

  function handleChange<K extends keyof SoftwareSettings>(field: K, value: SoftwareSettings[K]) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function saveSettings() {
    saveSoftwareSettings(settings);
    window.dispatchEvent(new CustomEvent("evfleet-settings-updated"));
    window.dispatchEvent(new CustomEvent("evfleet-default-branch-updated"));
    const now = new Date().toLocaleString("pt-BR");
    setSavedAt(now);
    setSaveMessage("Configurações salvas com sucesso.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function restoreDefaults() {
    setSettings(defaultSoftwareSettings);
    saveSoftwareSettings(defaultSoftwareSettings);
    window.dispatchEvent(new CustomEvent("evfleet-settings-updated"));
    window.dispatchEvent(new CustomEvent("evfleet-default-branch-updated"));
    const now = new Date().toLocaleString("pt-BR");
    setSavedAt(now);
    setSaveMessage("Configurações padrão restauradas.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function handleMenuVisibilityChange(path: string, value: boolean) {
    setMenuVisibility((prev) => ({ ...prev, [path]: value }));
  }

  async function saveMenuVisibility() {
    const saved = await saveMenuVisibilityMap(menuVisibility);
    setMenuVisibility(saved);
    window.dispatchEvent(new CustomEvent("evfleet-menu-visibility-updated"));
    setSaveMessage("Visibilidade do menu lateral atualizada.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  async function restoreMenuVisibilityDefaults() {
    const defaults = getDefaultMenuVisibilityMap();
    const saved = await saveMenuVisibilityMap(defaults);
    setMenuVisibility(saved);
    window.dispatchEvent(new CustomEvent("evfleet-menu-visibility-updated"));
    setSaveMessage("Visibilidade do menu restaurada para padrão.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function informUpdate() {
    const title = updateTitle.trim() || "Atualização manual";
    const message = updateMessage.trim();

    if (!message) {
      setUpdateFeedback("Informe a mensagem da atualização.");
      window.setTimeout(() => setUpdateFeedback(""), 2500);
      return;
    }

    addSystemLog({
      method: "MANUAL",
      action: title,
      endpoint: "/administration/updates",
      status: "INFO",
      details: message,
    });

    setUpdateTitle("");
    setUpdateMessage("");
    setUpdateFeedback("Atualização registrada no system logs.");
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
    window.setTimeout(() => setUpdateFeedback(""), 2500);
  }

  async function resetAllSystem() {
    if (!resetJwtToken.trim()) {
      setResetJwtTokenError("Informe o token do JWT_SECRET.");
      return;
    }

    try {
      setResettingAll(true);
      setResetJwtTokenError("");
      await resetAllDatabaseWithToken(resetJwtToken.trim());

      window.dispatchEvent(new CustomEvent("evfleet-settings-updated"));
      window.dispatchEvent(new CustomEvent("evfleet-default-branch-updated"));
      window.dispatchEvent(new CustomEvent("evfleet-menu-visibility-updated"));
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));

      const defaultMenu = getDefaultMenuVisibilityMap();
      setMenuVisibility(defaultMenu);
      setSettings(readSoftwareSettings());
      setSaveMessage("Reset all do banco concluído com sucesso.");
      window.setTimeout(() => setSaveMessage(""), 3000);
      getBranches().then((items) => setBranches(Array.isArray(items) ? items : []));
      setIsResetModalOpen(false);
      setResetJwtToken("");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Não foi possível executar o reset do banco.";
      if (/jwt_secret|token/i.test(String(message))) {
        setResetJwtTokenError(String(message));
      } else {
        setSaveMessage(String(message));
        window.setTimeout(() => setSaveMessage(""), 3500);
      }
    } finally {
      setResettingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administração do software</h1>
          <p className="text-sm text-slate-500">
            Configure regras, notificações, segurança e padrões globais do sistema.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <ShieldCheck size={14} className="text-blue-600" />
          Apenas perfil ADMIN
        </div>
      </div>

      {saveMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={18} className="text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Parâmetros gerais</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <label className="space-y-1 lg:col-span-6">
            <span className="text-sm font-medium text-slate-700">Nome da empresa</span>
            <input
              value={settings.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="space-y-1 lg:col-span-3">
            <span className="text-sm font-medium text-slate-700">Fuso horário</span>
            <select
              value={settings.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
            </select>
          </label>
          <label className="space-y-1 lg:col-span-3">
            <span className="text-sm font-medium text-slate-700">Idioma</span>
            <select
              value={settings.language}
              onChange={(e) => handleChange("language", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="pt-BR">Português (Brasil)</option>
            </select>
          </label>
          <label className="space-y-1 lg:col-span-3">
            <span className="text-sm font-medium text-slate-700">Moeda</span>
            <select
              value={settings.currency}
              onChange={(e) => handleChange("currency", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="BRL">Real (BRL)</option>
            </select>
          </label>
          <label className="space-y-1 lg:col-span-3">
            <span className="text-sm font-medium text-slate-700">Limite máximo de veículos permitidos no sistema</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={String(settings.maxVehiclesAllowed)}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "");
                handleChange("maxVehiclesAllowed", Number(onlyDigits || "0"));
              }}
              placeholder="Ex: 500"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <div className="space-y-3 lg:col-span-12 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="block text-sm font-medium text-slate-700">
              Estabelecimento padrão do sistema
            </span>
            <label className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={settings.lockDefaultBranch}
                onChange={(e) => handleChange("lockDefaultBranch", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
              />
              Ativar e bloquear estabelecimento em todo o sistema
            </label>
            <select
              value={settings.defaultBranchId}
              onChange={(e) => handleChange("defaultBranchId", e.target.value)}
              disabled={!settings.lockDefaultBranch}
              className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Nenhum (rede inteira)</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-medium text-slate-500">
              Quando ativado e definido, os campos de estabelecimento serão preenchidos automaticamente e desabilitados.
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Settings2 size={16} />
            {savedAt ? `Última alteração: ${savedAt}` : "Nenhuma alteração salva nesta sessão."}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreDefaults}
              className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Restaurar padrão
            </button>
            <button
              type="button"
              onClick={saveSettings}
              className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Salvar configurações
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Visibilidade do menu lateral</h2>
            <p className="text-sm text-slate-500">
              Habilite ou desabilite quais páginas devem aparecer no menu para os usuários.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MENU_VISIBILITY_ITEMS.map((item) => (
              <label
                key={item.path}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={menuVisibility[item.path] !== false}
                  onChange={(e) => handleMenuVisibilityChange(item.path, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={restoreMenuVisibilityDefaults}
              className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Restaurar menu padrão
            </button>
            <button
              type="button"
              onClick={saveMenuVisibility}
              className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Salvar visibilidade
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Informar atualização</h2>
          <p className="text-sm text-slate-500">
            Registre aqui as atualizações do sistema para aparecer no modal de logs.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Título (opcional)</span>
            <input
              value={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.value)}
              placeholder="Ex: Melhorias na tela de manutenção"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Mensagem da atualização</span>
            <textarea
              rows={4}
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)}
              placeholder="Descreva o que foi alterado."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{updateFeedback || " "}</p>
          <button
            type="button"
            onClick={informUpdate}
            className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Informar atualização
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-red-700">Reset do sistema</h2>
          <p className="text-sm text-slate-600">
            Use esta opção para executar um reset all do banco de dados (dados operacionais do sistema).
          </p>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Atenção: esta ação é irreversível e apaga os registros do banco (usuários são preservados).
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setResetJwtToken("");
              setResetJwtTokenError("");
              setIsResetModalOpen(true);
            }}
            disabled={resettingAll}
            className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resettingAll ? "Executando reset..." : "Reset all"}
          </button>
        </div>
      </div>

      {isResetModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Confirmar reset all do banco</h3>
              <p className="mt-1 text-sm text-slate-600">
                Para confirmar, informe o token do <strong>JWT_SECRET</strong>. O sistema não exibe esse valor.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Token JWT_SECRET</span>
                <input
                  type="password"
                  value={resetJwtToken}
                  onChange={(e) => {
                    setResetJwtToken(e.target.value);
                    setResetJwtTokenError("");
                  }}
                  placeholder="Informe o token"
                  className={`w-full rounded-xl border px-4 py-3 outline-none ${
                    resetJwtTokenError
                      ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                      : "border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  }`}
                />
                {resetJwtTokenError ? <p className="text-xs text-red-600">{resetJwtTokenError}</p> : null}
              </label>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                Esta ação é irreversível e apaga os dados operacionais do banco.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={resetAllSystem}
                disabled={resettingAll}
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {resettingAll ? "Executando..." : "Confirmar reset all"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
