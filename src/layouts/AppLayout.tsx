import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeAlert,
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Fuel,
  LayoutDashboard,
  Menu,
  LogOut,
  Route,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBranch } from "../contexts/BranchContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { getSystemLogs, type SystemLogEntry } from "../services/systemLogs";
import { getFuelRecords } from "../services/fuelRecords";
import { getVehicles } from "../services/vehicles";
import { detectFuelAnomalies } from "../services/fuelAnomalies";
import { getMaintenanceRecords } from "../services/maintenanceRecords";
import { getDebts } from "../services/debts";
import { getVehicleDocuments } from "../services/vehicleDocuments";
import {
  fetchMenuVisibilityMap,
  getCachedMenuVisibilityMap,
  isMenuPathVisible,
  type MenuVisibilityMap,
} from "../services/menuVisibility";
import { defaultSoftwareSettings, readSoftwareSettings } from "../services/adminSettings";

type AppNotification = {
  id: string;
  title: string;
  description: string;
  date: string;
  link?: string;
};

function formatRole(role?: string) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "FLEET_MANAGER":
      return "Gestor da Frota";
    default:
      return "Sem perfil";
  }
}

function getRoleBadgeClasses(role?: string) {
  switch (role) {
    case "ADMIN":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "FLEET_MANAGER":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatDateOnly(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function parseLocalDate(value: string) {
  const raw = String(value || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getDaysUntil(dateValue: string) {
  const target = parseLocalDate(dateValue);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { branchErrorMessage } = useBranch();
  const {
    selectedCompanyId,
    setSelectedCompanyId,
    options,
    isLoadingScopeOptions,
    canSelectCompanyScope,
    companyErrorMessage,
  } = useCompanyScope();
  const [isSystemLogsModalOpen, setIsSystemLogsModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityMap>(() => getCachedMenuVisibilityMap());
  const [isLoadingMenuVisibility, setIsLoadingMenuVisibility] = useState(true);
  const [companyName, setCompanyName] = useState(() => {
    const saved = readSoftwareSettings().companyName?.trim();
    return saved || defaultSoftwareSettings.companyName;
  });

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Relatórios", path: "/reports", icon: BarChart3, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Veículos", path: "/vehicles", icon: Truck, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Motoristas", path: "/drivers", icon: Users, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Manutenções", path: "/maintenance-records", icon: Wrench, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Abastecimentos", path: "/fuel-records", icon: Fuel, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Débitos e Multas", path: "/debts", icon: BadgeAlert, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Gestão de Viagens", path: "/trips", icon: Route, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Gestão de Documentos", path: "/vehicle-documents", icon: FileText, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Como usar", path: "/how-to-use", icon: BookOpenCheck, roles: ["ADMIN", "FLEET_MANAGER"] },
    { name: "Empresas", path: "/companies", icon: Building2, roles: ["ADMIN"] },
    { name: "Usuários", path: "/users", icon: Users, roles: ["ADMIN"] },
    { name: "Administração", path: "/administration", icon: ShieldCheck, roles: ["ADMIN"] },
  ];

  menu.splice(2, 0, {
    name: "Assinatura",
    path: "/subscription",
    icon: CreditCard,
    roles: ["ADMIN", "FLEET_MANAGER"],
  });

  const administrativePaths = new Set(["/companies", "/users", "/administration"]);
  const isAdminWithoutCompanyScope = user?.role === "ADMIN" && !selectedCompanyId;

  const filteredMenu = menu.filter((item) => {
    const hasRole = user ? item.roles.includes(user.role) : false;
    if (!hasRole) return false;
    if (!isMenuPathVisible(item.path, menuVisibility)) return false;

    if (isAdminWithoutCompanyScope) {
      return administrativePaths.has(item.path);
    }

    return true;
  });
  const latestTopics = useMemo(
    () =>
      [...systemLogs]
        .filter((log) => String(log.method || "").toUpperCase() === "MANUAL")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20),
    [systemLogs]
  );
  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleOpenSystemLogsModal() {
    setSystemLogs(getSystemLogs());
    setIsSystemLogsModalOpen(true);
  }

  async function loadNotifications() {
    const [
      fuelRecordsResult,
      vehiclesResult,
      maintenanceRecordsResult,
      debtsResult,
      vehicleDocumentsResult,
    ] = await Promise.allSettled([
      getFuelRecords(),
      getVehicles(),
      getMaintenanceRecords(),
      getDebts(),
      getVehicleDocuments(),
    ]);

    const fuelRecords = fuelRecordsResult.status === "fulfilled" ? fuelRecordsResult.value : [];
    const vehicles = vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];
    const maintenanceRecords = maintenanceRecordsResult.status === "fulfilled" ? maintenanceRecordsResult.value : [];
    const debts = debtsResult.status === "fulfilled" ? debtsResult.value : [];
    const vehicleDocuments =
      vehicleDocumentsResult.status === "fulfilled" ? vehicleDocumentsResult.value : [];

    const anomalyNotifications: AppNotification[] =
      fuelRecords.length > 0 && vehicles.length > 0
        ? detectFuelAnomalies(fuelRecords, vehicles).map((item) => ({
            id: `fuel-anomaly-${item.id}`,
            title: `Anomalia de consumo - ${item.vehicle}`,
            description: `${item.reason} Motorista: ${item.driver}.`,
            date: item.date,
            link: "/fuel-records",
          }))
        : [];

    const maintenanceNotifications: AppNotification[] = maintenanceRecords
      .filter((record) => {
        if (String(record.status || "").toUpperCase() !== "OPEN") return false;
        const daysUntil = getDaysUntil(record.maintenanceDate);
        return daysUntil >= 0 && daysUntil <= 5;
      })
      .map((record) => {
        const daysUntil = getDaysUntil(record.maintenanceDate);
        const vehicleLabel = record.vehicle ? `${record.vehicle.brand} ${record.vehicle.model}` : "Veículo";

        return {
          id: `maintenance-schedule-${record.id}`,
          title: `Manutenção programada - ${vehicleLabel}`,
          description:
            daysUntil === 0
              ? "A manutenção está programada para hoje."
              : `Faltam ${daysUntil} dia(s) para a manutenção programada.`,
          date: record.maintenanceDate,
          link: `/maintenance-records?tab=records&highlight=${record.id}`,
        };
      });

    const debtNotifications: AppNotification[] = debts
      .filter((debt) => {
        if (String(debt.status || "").toUpperCase() !== "PENDING") return false;
        const daysUntil = getDaysUntil(debt.dueDate || debt.debtDate);
        return daysUntil >= 0 && daysUntil <= 5;
      })
      .map((debt) => {
        const daysUntil = getDaysUntil(debt.dueDate || debt.debtDate);
        const vehicleLabel = debt.vehicle ? `${debt.vehicle.brand} ${debt.vehicle.model}` : "Veículo";

        return {
          id: `debt-due-${debt.id}`,
          title: `Débito vencendo - ${vehicleLabel}`,
          description:
            daysUntil === 0
              ? "O débito vence hoje."
              : `Faltam ${daysUntil} dia(s) para o vencimento do débito.`,
          date: debt.dueDate || debt.debtDate,
          link: `/debts?highlight=${debt.id}`,
        };
      });

    const overdueDebtNotifications: AppNotification[] = debts
      .filter((debt) => {
        if (String(debt.status || "").toUpperCase() !== "PENDING") return false;
        const daysUntil = getDaysUntil(debt.dueDate || debt.debtDate);
        return daysUntil < 0;
      })
      .map((debt) => {
        const vehicleLabel = debt.vehicle ? `${debt.vehicle.brand} ${debt.vehicle.model}` : "Veículo";
        const overdueDays = Math.abs(getDaysUntil(debt.dueDate || debt.debtDate));

        return {
          id: `debt-overdue-${debt.id}`,
          title: `Débito vencido - ${vehicleLabel}`,
          description: `Débito vencido há ${overdueDays} dia(s).`,
          date: debt.dueDate || debt.debtDate,
          link: `/debts?highlight=${debt.id}`,
        };
      });

    const expiringDocumentNotifications: AppNotification[] = vehicleDocuments
      .filter((document) => {
        if (!document.expiryDate) return false;
        const daysUntil = getDaysUntil(document.expiryDate);
        return daysUntil >= 0 && daysUntil <= 30;
      })
      .map((document) => {
        const daysUntil = getDaysUntil(document.expiryDate || document.updatedAt || document.createdAt);
        const vehicleLabel = document.vehicle
          ? `${document.vehicle.brand} ${document.vehicle.model}`
          : "Veículo";

        return {
          id: `document-expiring-${document.id}`,
          title: `Documento vencendo - ${vehicleLabel}`,
          description:
            daysUntil === 0
              ? `${document.name} vence hoje.`
              : `${document.name} vence em ${daysUntil} dia(s).`,
          date: document.expiryDate || document.updatedAt || document.createdAt,
          link: `/vehicle-documents?highlight=${document.id}`,
        };
      });

    const expiredDocumentNotifications: AppNotification[] = vehicleDocuments
      .filter((document) => {
        if (!document.expiryDate) return String(document.status || "").toUpperCase() === "EXPIRED";
        const daysUntil = getDaysUntil(document.expiryDate);
        return daysUntil < 0 || String(document.status || "").toUpperCase() === "EXPIRED";
      })
      .map((document) => {
        const vehicleLabel = document.vehicle
          ? `${document.vehicle.brand} ${document.vehicle.model}`
          : "Veículo";
        const overdueDays = document.expiryDate
          ? Math.abs(getDaysUntil(document.expiryDate))
          : 0;

        return {
          id: `document-expired-${document.id}`,
          title: `Documento vencido - ${vehicleLabel}`,
          description: document.expiryDate
            ? `${document.name} está vencido há ${overdueDays} dia(s).`
            : `${document.name} está marcado como vencido.`,
          date: document.expiryDate || document.updatedAt || document.createdAt,
          link: `/vehicle-documents?highlight=${document.id}`,
        };
      });

    setNotifications(
      [
        ...overdueDebtNotifications,
        ...expiredDocumentNotifications,
        ...maintenanceNotifications,
        ...debtNotifications,
        ...expiringDocumentNotifications,
        ...anomalyNotifications,
      ].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
  }

  useEffect(() => {
    loadNotifications();

    function refreshNotifications() {
      loadNotifications();
    }

    window.addEventListener("evfleet-fuel-anomalies-updated", refreshNotifications);
    window.addEventListener("evfleet-notifications-updated", refreshNotifications);
    return () => {
      window.removeEventListener("evfleet-fuel-anomalies-updated", refreshNotifications);
      window.removeEventListener("evfleet-notifications-updated", refreshNotifications);
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    async function refreshMenuVisibility() {
      setIsLoadingMenuVisibility(true);
      const visibility = await fetchMenuVisibilityMap();
      setMenuVisibility(visibility);
      setIsLoadingMenuVisibility(false);
    }
    refreshMenuVisibility();
    window.addEventListener("evfleet-menu-visibility-updated", refreshMenuVisibility);
    return () => {
      window.removeEventListener("evfleet-menu-visibility-updated", refreshMenuVisibility);
    };
  }, []);

  useEffect(() => {
    function refreshSoftwareSettings() {
      const saved = readSoftwareSettings().companyName?.trim();
      setCompanyName(saved || defaultSoftwareSettings.companyName);
    }

    window.addEventListener("evfleet-settings-updated", refreshSoftwareSettings);
    return () => {
      window.removeEventListener("evfleet-settings-updated", refreshSoftwareSettings);
    };
  }, []);

  useEffect(() => {
    if (isLoadingMenuVisibility) return;
    if (!user) return;
    if (location.pathname === "/login") return;

    if (isAdminWithoutCompanyScope) {
      const isAllowedPath =
        location.pathname === "/companies" ||
        location.pathname === "/users" ||
        location.pathname === "/administration";
      if (!isAllowedPath) {
        navigate("/administration", { replace: true });
        return;
      }
    }

    if (isMenuPathVisible(location.pathname, menuVisibility)) return;

    const fallbackPath = filteredMenu[0]?.path || "/dashboard";
    if (location.pathname !== fallbackPath) {
      navigate(fallbackPath, { replace: true });
    }
  }, [
    filteredMenu,
    isAdminWithoutCompanyScope,
    isLoadingMenuVisibility,
    location.pathname,
    menuVisibility,
    navigate,
    user,
  ]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (isLoadingMenuVisibility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Carregando permissões do sistema...</p>
      </div>
    );
  }

  function handleOpenNotification(notification: AppNotification) {
    setIsNotificationsModalOpen(false);
    if (!notification.link) return;

    if (notification.link.startsWith("/")) {
      navigate(notification.link);
      return;
    }

    window.open(notification.link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100">
      {isMobileMenuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-white shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-orange-500">{companyName}</h1>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-lg border border-slate-700 p-2 text-slate-300 lg:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {filteredMenu.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={handleOpenSystemLogsModal}
            className="block w-full cursor-pointer rounded-2xl bg-slate-800/70 px-4 py-3 text-left transition hover:bg-slate-700/80"
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">Ambiente</p>
            <p className="mt-1 text-sm font-medium text-slate-200">{companyName} v1.0</p>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
              >
                <Menu size={18} />
              </button>
              <p className="text-sm font-semibold text-slate-700">Painel {companyName}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-left shadow-sm transition hover:border-orange-200 lg:max-w-[320px]"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Bell size={18} />
                  {notifications.length > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {notifications.length}
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notificações</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {notifications.length > 0
                      ? `${notifications.length} notificação(ões) pendente(s)`
                      : "Sem eventos no momento"}
                  </p>
                </div>
              </div>
            </button>

            {canSelectCompanyScope ? (
              <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:max-w-[320px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Escopo da empresa
                </p>
                <select
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  disabled={isLoadingScopeOptions}
                >
                  <option value="">Selecionar empresa (vazio)</option>
                  {options.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm lg:max-w-[340px]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                  {initial}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-slate-900">{user?.name || "Usuário"}</p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-[1px] text-[10px] font-semibold ${getRoleBadgeClasses(
                      user?.role
                    )}`}
                  >
                    {formatRole(user?.role)}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:px-3"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </div>
          {companyErrorMessage || branchErrorMessage ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {companyErrorMessage || branchErrorMessage}
            </div>
          ) : null}
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden bg-gradient-to-b from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {isSystemLogsModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600">Nome do sistema: {companyName}</p>
                <p className="text-sm text-slate-600">Versão atual: v1.0</p>
              </div>
              <ClipboardList size={22} className="text-orange-600" />
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tópicos com as atualizações</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {latestTopics.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma atualização registrada até o momento.</p>
                ) : (
                  latestTopics.map((log) => (
                    <div key={log.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(log.timestamp)} - {log.actor}
                      </p>
                      <p className="text-xs text-slate-600">
                        {log.endpoint}
                        {log.details ? ` - ${log.details}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-600">
                Plataforma desenvolvida com foco corporativo por{" "}
                <a
                  href="https://evsistemas.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
                >
                  EvSistemas
                </a>
                .
              </div>
              <button
                type="button"
                onClick={() => setIsSystemLogsModalOpen(false)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNotificationsModalOpen ? (
        <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notificações</p>
                <p className="mt-1 text-sm text-slate-700">{notifications.length} item(ns) pendente(s)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationsModalOpen(false)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nenhuma notificação no momento.
                </p>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    className={`w-full rounded-xl border px-4 py-3 text-left ${
                      notification.link
                        ? "cursor-pointer border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                        : "cursor-default border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{notification.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateOnly(notification.date)}</p>
                    {notification.link ? (
                      <p className="mt-2 text-xs font-semibold text-orange-600">Abrir notificação</p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
