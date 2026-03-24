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
    </div>
  );
}
