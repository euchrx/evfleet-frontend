import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeAlert,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  BookOpenCheck,
  Building2,
  ClipboardList,
  CreditCard,
  Crown,
  FileText,
  Fuel,
  LayoutDashboard,
  Menu,
  LogOut,
  Route,
  ShieldCheck,
  Truck,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import {
  deleteSystemLog,
  getSystemLogs,
  SYSTEM_LOGS_UPDATED_EVENT,
  updateSystemLog,
  type SystemLogEntry,
} from "../services/systemLogs";
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
import {
  defaultSoftwareSettings,
  readSoftwareSettings,
} from "../services/adminSettings";
import { api } from "../services/api";
import type { SubscriptionStatus } from "../services/subscription";

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

function normalizeVersionLabel(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^v/i.test(text) ? text : `v${text}`;
}

function getLatestVersionFromLogs(logs: SystemLogEntry[]) {
  const latestManualWithVersion = [...logs]
    .filter((log) => String(log.method || "").toUpperCase() === "MANUAL")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find((log) => normalizeVersionLabel(log.version));

  return normalizeVersionLabel(latestManualWithVersion?.version);
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
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const {
    selectedCompanyId,
    setSelectedCompanyId,
    options,
    isLoadingScopeOptions,
    canSelectCompanyScope,
    companyErrorMessage,
  } = useCompanyScope();
  const [isSystemLogsModalOpen, setIsSystemLogsModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] =
    useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompanyScopeOpen, setIsCompanyScopeOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>(() => getSystemLogs());
  const [editingLog, setEditingLog] = useState<SystemLogEntry | null>(null);
  const [editingLogAction, setEditingLogAction] = useState("");
  const [editingLogActor, setEditingLogActor] = useState("");
  const [editingLogVersion, setEditingLogVersion] = useState("");
  const [editingLogDetails, setEditingLogDetails] = useState("");
  const [logToDelete, setLogToDelete] = useState<SystemLogEntry | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityMap>(() =>
    getCachedMenuVisibilityMap(),
  );
  const [isLoadingMenuVisibility, setIsLoadingMenuVisibility] = useState(true);
  const [companyName, setCompanyName] = useState(() => {
    const saved = readSoftwareSettings().companyName?.trim();
    return saved || defaultSoftwareSettings.companyName;
  });
  const [systemVersion, setSystemVersion] = useState(() => {
    const saved = readSoftwareSettings().systemVersion?.trim();
    return saved || defaultSoftwareSettings.systemVersion;
  });
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const companyScopeRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "RelatÃ³rios",
      path: "/reports",
      icon: BarChart3,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "VeÃ­culos",
      path: "/vehicles",
      icon: Truck,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "Filiais",
      path: "/branches",
      icon: Building2,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "Motoristas",
      path: "/drivers",
      icon: Users,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "ManutenÃ§Ãµes",
      path: "/maintenance-records",
      icon: Wrench,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "Abastecimentos",
      path: "/fuel-records",
      icon: Fuel,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "DÃ©bitos e Multas",
      path: "/debts",
      icon: BadgeAlert,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "GestÃ£o de Viagens",
      path: "/trips",
      icon: Route,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "GestÃ£o de Documentos",
      path: "/vehicle-documents",
      icon: FileText,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    {
      name: "Como usar",
      path: "/how-to-use",
      icon: BookOpenCheck,
      roles: ["ADMIN", "FLEET_MANAGER"],
    },
    { name: "Empresas", path: "/companies", icon: Building2, roles: ["ADMIN"] },
    { name: "Filiais", path: "/branches", icon: Building2, roles: ["ADMIN"] },
    { name: "UsuÃ¡rios", path: "/users", icon: Users, roles: ["ADMIN"] },
    {
      name: "AdministraÃ§Ã£o",
      path: "/administration",
      icon: ShieldCheck,
      roles: ["ADMIN"],
    },
  ];

  const administrativePaths = new Set([
    "/companies",
    "/branches",
    "/users",
    "/administration",
  ]);
  const isAdminWithoutCompanyScope =
    user?.role === "ADMIN" && !selectedCompanyId;
  const selectedCompanyOption =
    options.find((company) => company.id === selectedCompanyId) || null;
  const companyScopeTitle =
    selectedCompanyOption?.name || "Sem empresa selecionada";
  const companyScopeSubtitle = selectedCompanyOption
    ? "Empresa selecionada"
    : "Escopo administrativo";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        companyScopeRef.current &&
        !companyScopeRef.current.contains(event.target as Node)
      ) {
        setIsCompanyScopeOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 20),
    [systemLogs],
  );
  const effectiveSystemVersion = useMemo(
    () => getLatestVersionFromLogs(systemLogs) || normalizeVersionLabel(systemVersion) || "v1.0",
    [systemLogs, systemVersion],
  );
  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  function handleCompanyScopeChange(nextCompanyId: string) {
    const current = selectedCompanyId || "";
    setSelectedCompanyId(nextCompanyId);
    setIsCompanyScopeOpen(false);

    if (current !== nextCompanyId) {
      window.location.reload();
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleOpenSystemLogsModal() {
    setSystemLogs(getSystemLogs());
    setIsSystemLogsModalOpen(true);
  }

  function handleOpenEditLog(log: SystemLogEntry) {
    setEditingLog(log);
    setEditingLogAction(log.action || "");
    setEditingLogActor(log.actor || "");
    setEditingLogVersion(normalizeVersionLabel(log.version) || effectiveSystemVersion);
    setEditingLogDetails(log.details || "");
  }

  function handleSaveEditLog() {
    if (!editingLog) return;
    if (!editingLogAction.trim()) return;

    updateSystemLog(editingLog.id, {
      action: editingLogAction.trim(),
      actor: editingLogActor.trim() || "Sistema",
      version: normalizeVersionLabel(editingLogVersion) || effectiveSystemVersion,
      details: editingLogDetails.trim(),
    });

    setSystemLogs(getSystemLogs());
    setEditingLog(null);
  }

  function handleDeleteLog() {
    if (!logToDelete) return;
    deleteSystemLog(logToDelete.id);
    setSystemLogs(getSystemLogs());
    setLogToDelete(null);
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

    const fuelRecords =
      fuelRecordsResult.status === "fulfilled" ? fuelRecordsResult.value : [];
    const vehicles =
      vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];
    const maintenanceRecords =
      maintenanceRecordsResult.status === "fulfilled"
        ? maintenanceRecordsResult.value
        : [];
    const debts = debtsResult.status === "fulfilled" ? debtsResult.value : [];
    const vehicleDocuments =
      vehicleDocumentsResult.status === "fulfilled"
        ? vehicleDocumentsResult.value
        : [];

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
        const vehicleLabel = record.vehicle
          ? `${record.vehicle.brand} ${record.vehicle.model}`
          : "VeÃ­culo";

        return {
          id: `maintenance-schedule-${record.id}`,
          title: `ManutenÃ§Ã£o programada - ${vehicleLabel}`,
          description:
            daysUntil === 0
              ? "A manutenÃ§Ã£o estÃ¡ programada para hoje."
              : `Faltam ${daysUntil} dia(s) para a manutenÃ§Ã£o programada.`,
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
        const vehicleLabel = debt.vehicle
          ? `${debt.vehicle.brand} ${debt.vehicle.model}`
          : "VeÃ­culo";

        return {
          id: `debt-due-${debt.id}`,
          title: `DÃ©bito vencendo - ${vehicleLabel}`,
          description:
            daysUntil === 0
              ? "O dÃ©bito vence hoje."
              : `Faltam ${daysUntil} dia(s) para o vencimento do dÃ©bito.`,
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
        const vehicleLabel = debt.vehicle
          ? `${debt.vehicle.brand} ${debt.vehicle.model}`
          : "VeÃ­culo";
        const overdueDays = Math.abs(
          getDaysUntil(debt.dueDate || debt.debtDate),
        );

        return {
          id: `debt-overdue-${debt.id}`,
          title: `DÃ©bito vencido - ${vehicleLabel}`,
          description: `DÃ©bito vencido hÃ¡ ${overdueDays} dia(s).`,
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
        const daysUntil = getDaysUntil(
          document.expiryDate || document.updatedAt || document.createdAt,
        );
        const vehicleLabel = document.vehicle
          ? `${document.vehicle.brand} ${document.vehicle.model}`
          : "VeÃ­culo";

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
        if (!document.expiryDate)
          return String(document.status || "").toUpperCase() === "EXPIRED";
        const daysUntil = getDaysUntil(document.expiryDate);
        return (
          daysUntil < 0 ||
          String(document.status || "").toUpperCase() === "EXPIRED"
        );
      })
      .map((document) => {
        const vehicleLabel = document.vehicle
          ? `${document.vehicle.brand} ${document.vehicle.model}`
          : "VeÃ­culo";
        const overdueDays = document.expiryDate
          ? Math.abs(getDaysUntil(document.expiryDate))
          : 0;

        return {
          id: `document-expired-${document.id}`,
          title: `Documento vencido - ${vehicleLabel}`,
          description: document.expiryDate
            ? `${document.name} estÃ¡ vencido hÃ¡ ${overdueDays} dia(s).`
            : `${document.name} estÃ¡ marcado como vencido.`,
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
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    );
  }

  useEffect(() => {
    loadNotifications();

    function refreshNotifications() {
      loadNotifications();
    }

    window.addEventListener(
      "evfleet-fuel-anomalies-updated",
      refreshNotifications,
    );
    window.addEventListener(
      "evfleet-notifications-updated",
      refreshNotifications,
    );
    return () => {
      window.removeEventListener(
        "evfleet-fuel-anomalies-updated",
        refreshNotifications,
      );
      window.removeEventListener(
        "evfleet-notifications-updated",
        refreshNotifications,
      );
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    let active = true;

    async function loadSubscriptionStatus() {
      try {
        if (!user) {
          if (active) setSubscriptionStatus(null);
          return;
        }

        const isAdmin = user.role === "ADMIN";
        if (isAdmin && !selectedCompanyId) {
          if (active) setSubscriptionStatus(null);
          return;
        }

        const endpoint =
          isAdmin && selectedCompanyId
            ? `/billing/companies/${selectedCompanyId}/subscription`
            : "/billing/me/subscription";

        const { data } = await api.get<{ status?: SubscriptionStatus } | null>(
          endpoint,
        );
        if (!active) return;
        setSubscriptionStatus(data?.status || null);
      } catch {
        if (!active) return;
        setSubscriptionStatus(null);
      }
    }

    loadSubscriptionStatus();
    return () => {
      active = false;
    };
  }, [selectedCompanyId, user]);

  useEffect(() => {
    async function refreshMenuVisibility() {
      setIsLoadingMenuVisibility(true);
      const visibility = await fetchMenuVisibilityMap();
      setMenuVisibility(visibility);
      setIsLoadingMenuVisibility(false);
    }
    refreshMenuVisibility();
    window.addEventListener(
      "evfleet-menu-visibility-updated",
      refreshMenuVisibility,
    );
    return () => {
      window.removeEventListener(
        "evfleet-menu-visibility-updated",
        refreshMenuVisibility,
      );
    };
  }, []);

  useEffect(() => {
    function refreshSoftwareSettings() {
      const nextSettings = readSoftwareSettings();
      const savedCompanyName = nextSettings.companyName?.trim();
      const savedVersion = nextSettings.systemVersion?.trim();
      setCompanyName(savedCompanyName || defaultSoftwareSettings.companyName);
      setSystemVersion(savedVersion || defaultSoftwareSettings.systemVersion);
    }

    window.addEventListener(
      "evfleet-settings-updated",
      refreshSoftwareSettings,
    );
    return () => {
      window.removeEventListener(
        "evfleet-settings-updated",
        refreshSoftwareSettings,
      );
    };
  }, []);

  useEffect(() => {
    function refreshSystemLogs() {
      setSystemLogs(getSystemLogs());
    }

    window.addEventListener(SYSTEM_LOGS_UPDATED_EVENT, refreshSystemLogs);
    window.addEventListener("storage", refreshSystemLogs);
    return () => {
      window.removeEventListener(SYSTEM_LOGS_UPDATED_EVENT, refreshSystemLogs);
      window.removeEventListener("storage", refreshSystemLogs);
    };
  }, []);

  useEffect(() => {
    if (isLoadingMenuVisibility) return;
    if (!user) return;
    if (location.pathname === "/login") return;

    if (isAdminWithoutCompanyScope) {
      const isAllowedPath =
        location.pathname === "/companies" ||
        location.pathname === "/branches" ||
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
        <p className="text-sm text-slate-500">
          Carregando permissÃµes do sistema...
        </p>
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
            <h1 className="text-2xl font-bold tracking-tight text-orange-500">
              {companyName}
            </h1>
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
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Ambiente
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {companyName} {effectiveSystemVersion}
            </p>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
              >
                <Menu size={18} />
              </button>
              <p className="text-sm font-semibold text-slate-700">
                Painel {companyName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-left shadow-sm transition hover:border-orange-200 lg:col-start-1 lg:max-w-[320px] lg:justify-self-start"
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    NotificaÃ§Ãµes
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {notifications.length > 0
                      ? `${notifications.length} notificaÃ§Ã£o(Ãµes) pendente(s)`
                      : "Sem eventos no momento"}
                  </p>
                </div>
              </div>
            </button>

            {canSelectCompanyScope ? (
              <div
                ref={companyScopeRef}
                className="relative w-full lg:col-start-2 lg:w-[320px] lg:justify-self-center"
              >
                <button
                  type="button"
                  onClick={() =>
                    !isLoadingScopeOptions &&
                    setIsCompanyScopeOpen((prev) => !prev)
                  }
                  className="inline-flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-orange-300 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoadingScopeOptions}
                >
                  <BriefcaseBusiness size={14} className="text-orange-600" />
                  <Crown size={12} className="text-orange-500" />
                  <span className="min-w-0 leading-tight">
                    <strong className="block truncate text-sm font-semibold text-slate-900">
                      {companyScopeTitle}
                    </strong>
                    <small className="block text-[13px] text-slate-600">
                      {companyScopeSubtitle}
                    </small>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`ml-auto shrink-0 text-orange-500 transition ${isCompanyScopeOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isCompanyScopeOpen ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl">
                    <div className="max-h-72 overflow-auto p-2">
                      <button
                        type="button"
                        onClick={() => handleCompanyScopeChange("")}
                        className={`mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                          !selectedCompanyId
                            ? "border-orange-600 bg-orange-500 text-white"
                            : "border-orange-200 bg-white text-slate-700 hover:bg-orange-100"
                        }`}
                      >
                        {!selectedCompanyId ? (
                          <Check size={15} />
                        ) : (
                          <span className="w-[15px]" />
                        )}
                        <span className="truncate">
                          Sem empresa selecionada
                        </span>
                      </button>
                      {options.map((company) => {
                        const active = company.id === selectedCompanyId;
                        return (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => handleCompanyScopeChange(company.id)}
                            className={`mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                              active
                                ? "border-orange-600 bg-orange-500 text-white"
                                : "border-orange-200 bg-white text-slate-700 hover:bg-orange-100"
                            }`}
                          >
                            {active ? (
                              <Check size={15} />
                            ) : (
                              <span className="w-[15px]" />
                            )}
                            <span className="truncate">{company.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              ref={profileMenuRef}
              className="relative flex w-full justify-end lg:col-start-3 lg:justify-self-end"
            >
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-[0px] font-bold text-white shadow-sm transition hover:brightness-95"
              >
                <span className="text-sm leading-none">{initial}</span>
              </button>

              {isProfileMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-orange-200 bg-white text-slate-900 shadow-2xl lg:max-w-[340px]">
                  <div className="border-b border-orange-200 px-4 py-3">
                    <p className="truncate text-lg font-semibold">
                      {user?.name || "UsuÃ¡rio"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {selectedCompanyOption?.name || "Empresa selecionada"}
                    </p>
                    <span className="mt-2 inline-flex rounded-full border border-orange-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                      {String(formatRole(user?.role)).toUpperCase()}
                    </span>
                    {subscriptionStatus === "TRIALING" ? (
                      <span className="mt-2 ml-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        PerÃ­odo de teste
                      </span>
                    ) : null}
                  </div>

                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate(
                          user?.role === "ADMIN" ? "/users" : "/dashboard",
                        );
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-lg text-slate-800 transition hover:bg-orange-100"
                    >
                      <User size={18} />
                      <span>Perfil</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate("/subscription");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-lg text-slate-800 transition hover:bg-orange-100"
                    >
                      <CreditCard size={18} />
                      <span>Assinatura</span>
                    </button>
                  </div>

                  <div className="border-t border-orange-200 py-1.5">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-lg font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <LogOut size={18} />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {companyErrorMessage ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {companyErrorMessage}
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
                <p className="text-sm text-slate-600">
                  Nome do sistema: {companyName}
                </p>
                <p className="text-sm text-slate-600">VersÃ£o atual: {effectiveSystemVersion}</p>
              </div>
              <ClipboardList size={22} className="text-orange-600" />
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                TÃ³picos com as atualizaÃ§Ãµes
              </p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {latestTopics.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma atualizaÃ§Ã£o registrada atÃ© o momento.
                  </p>
                ) : (
                  latestTopics.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {log.action}
                        </p>
                        <span className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                          {normalizeVersionLabel(log.version) || effectiveSystemVersion}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(log.timestamp)} - {log.actor}
                      </p>
                      {log.details ? (
                        <p className="text-xs text-slate-600">{log.details}</p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditLog(log)}
                          className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogToDelete(log)}
                          className="cursor-pointer rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
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

      {editingLog ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Editar atualizaÃ§Ã£o</h3>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">TÃ­tulo</span>
                <input
                  value={editingLogAction}
                  onChange={(e) => setEditingLogAction(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Implementado por</span>
                <input
                  value={editingLogActor}
                  onChange={(e) => setEditingLogActor(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">VersÃ£o</span>
                <input
                  value={editingLogVersion}
                  onChange={(e) => setEditingLogVersion(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Mensagem</span>
                <textarea
                  rows={4}
                  value={editingLogDetails}
                  onChange={(e) => setEditingLogDetails(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditLog}
                className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logToDelete ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Excluir atualizaÃ§Ã£o</h3>
            <p className="mt-2 text-sm text-slate-600">
              Deseja excluir esta atualizaÃ§Ã£o do system logs?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteLog}
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Excluir
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
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  NotificaÃ§Ãµes
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {notifications.length} item(ns) pendente(s)
                </p>
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
                  Nenhuma notificaÃ§Ã£o no momento.
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
                    <p className="text-sm font-semibold text-slate-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {notification.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateOnly(notification.date)}
                    </p>
                    {notification.link ? (
                      <p className="mt-2 text-xs font-semibold text-orange-600">
                        Abrir notificaÃ§Ã£o
                      </p>
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

