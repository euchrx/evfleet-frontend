import { useEffect, useState } from "react";
import { BellRing, Building2, FileCog, Lock, Settings2, ShieldCheck } from "lucide-react";
import { addSystemLog } from "../../services/systemLogs";
import {
  MENU_VISIBILITY_ITEMS,
  getDefaultMenuVisibilityMap,
  getMenuVisibilityMap,
  saveMenuVisibilityMap,
  type MenuVisibilityMap,
} from "../../services/menuVisibility";

type SoftwareSettings = {
  companyName: string;
  timezone: string;
  language: string;
  currency: string;
  alertDaysBeforeCnh: number;
  alertDaysBeforeDocument: number;
  alertKmBeforeMaintenance: number;
  enableSystemNotifications: boolean;
  enableEmailNotifications: boolean;
  enableWhatsappNotifications: boolean;
  allowFleetManagerDeleteRecords: boolean;
  enforceStrongPassword: boolean;
  sessionTimeoutMinutes: number;
  defaultReportFormat: "PDF";
  defaultDashboardPeriod: "CURRENT_MONTH" | "CURRENT_YEAR" | "LAST_30_DAYS" | "ALL";
};

const STORAGE_KEY = "evfleet_admin_settings_v1";

const defaultSettings: SoftwareSettings = {
  companyName: "EvFleet",
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  currency: "BRL",
  alertDaysBeforeCnh: 30,
  alertDaysBeforeDocument: 15,
  alertKmBeforeMaintenance: 500,
  enableSystemNotifications: true,
  enableEmailNotifications: false,
  enableWhatsappNotifications: false,
  allowFleetManagerDeleteRecords: false,
  enforceStrongPassword: true,
  sessionTimeoutMinutes: 60,
  defaultReportFormat: "PDF",
  defaultDashboardPeriod: "CURRENT_YEAR",
};

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<SoftwareSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function AdministrationPage() {
  const [settings, setSettings] = useState<SoftwareSettings>(defaultSettings);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityMap>(getDefaultMenuVisibilityMap());
  const [savedAt, setSavedAt] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateFeedback, setUpdateFeedback] = useState("");

  useEffect(() => {
    setSettings(readSettings());
    setMenuVisibility(getMenuVisibilityMap());
  }, []);

  function handleChange<K extends keyof SoftwareSettings>(field: K, value: SoftwareSettings[K]) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const now = new Date().toLocaleString("pt-BR");
    setSavedAt(now);
    setSaveMessage("Configurações salvas com sucesso.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function restoreDefaults() {
    setSettings(defaultSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
    const now = new Date().toLocaleString("pt-BR");
    setSavedAt(now);
    setSaveMessage("Configurações padrão restauradas.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function handleMenuVisibilityChange(path: string, value: boolean) {
    setMenuVisibility((prev) => ({ ...prev, [path]: value }));
  }

  function saveMenuVisibility() {
    saveMenuVisibilityMap(menuVisibility);
    window.dispatchEvent(new CustomEvent("evfleet-menu-visibility-updated"));
    setSaveMessage("Visibilidade do menu lateral atualizada.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function restoreMenuVisibilityDefaults() {
    const defaults = getDefaultMenuVisibilityMap();
    setMenuVisibility(defaults);
    saveMenuVisibilityMap(defaults);
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 md:col-span-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Nome da empresa</span>
            <input
              value={settings.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Fuso horário</span>
            <select
              value={settings.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Idioma</span>
            <select
              value={settings.language}
              onChange={(e) => handleChange("language", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="pt-BR">Português (Brasil)</option>
            </select>
          </label>
          <label className="space-y-1 lg:col-span-1">
            <span className="text-sm font-medium text-slate-700">Moeda</span>
            <select
              value={settings.currency}
              onChange={(e) => handleChange("currency", e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="BRL">Real (BRL)</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BellRing size={18} className="text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Automação e alertas</h3>
            </div>
            <div className="grid gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Alerta CNH (dias)</span>
                <input
                  type="number"
                  min="0"
                  value={settings.alertDaysBeforeCnh}
                  onChange={(e) => handleChange("alertDaysBeforeCnh", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Alerta documento (dias)</span>
                <input
                  type="number"
                  min="0"
                  value={settings.alertDaysBeforeDocument}
                  onChange={(e) => handleChange("alertDaysBeforeDocument", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Alerta manutenção (KM)</span>
                <input
                  type="number"
                  min="0"
                  value={settings.alertKmBeforeMaintenance}
                  onChange={(e) => handleChange("alertKmBeforeMaintenance", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.enableSystemNotifications}
                  onChange={(e) => handleChange("enableSystemNotifications", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notificação no sistema
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.enableEmailNotifications}
                  onChange={(e) => handleChange("enableEmailNotifications", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notificação por e-mail
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.enableWhatsappNotifications}
                  onChange={(e) => handleChange("enableWhatsappNotifications", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notificação por WhatsApp
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lock size={18} className="text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Segurança e acesso</h3>
            </div>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.enforceStrongPassword}
                  onChange={(e) => handleChange("enforceStrongPassword", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Exigir senha forte para todos os usuários
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.allowFleetManagerDeleteRecords}
                  onChange={(e) => handleChange("allowFleetManagerDeleteRecords", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Permitir que gestor exclua registros
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Tempo de sessão (minutos)</span>
                <input
                  type="number"
                  min="5"
                  value={settings.sessionTimeoutMinutes}
                  onChange={(e) => handleChange("sessionTimeoutMinutes", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileCog size={18} className="text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Padrões de relatório</h3>
            </div>
            <div className="grid gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Formato padrão</span>
                <select
                  value={settings.defaultReportFormat}
                  onChange={(e) => handleChange("defaultReportFormat", e.target.value as "PDF")}
                  className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="PDF">PDF</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Período padrão do dashboard</span>
                <select
                  value={settings.defaultDashboardPeriod}
                  onChange={(e) =>
                    handleChange("defaultDashboardPeriod", e.target.value as SoftwareSettings["defaultDashboardPeriod"])
                  }
                  className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="CURRENT_YEAR">Ano atual</option>
                  <option value="CURRENT_MONTH">Mês atual</option>
                  <option value="LAST_30_DAYS">Últimos 30 dias</option>
                  <option value="ALL">Todo o período</option>
                </select>
              </label>
            </div>
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
