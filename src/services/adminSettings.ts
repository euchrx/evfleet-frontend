export type SoftwareSettings = {
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
  lockDefaultBranch: boolean;
  defaultBranchId: string;
};

export const ADMIN_SETTINGS_STORAGE_KEY = "evfleet_admin_settings_v1";

export const defaultSoftwareSettings: SoftwareSettings = {
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
  lockDefaultBranch: false,
  defaultBranchId: "",
};

export function readSoftwareSettings() {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSoftwareSettings;
    const parsed = JSON.parse(raw) as Partial<SoftwareSettings>;
    return { ...defaultSoftwareSettings, ...parsed };
  } catch {
    return defaultSoftwareSettings;
  }
}

export function saveSoftwareSettings(settings: SoftwareSettings) {
  localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
