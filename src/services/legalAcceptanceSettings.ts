import { api } from "./api";

export type LegalAcceptanceSettings = {
  enabled: boolean;
};

export async function fetchLegalAcceptanceSettings() {
  const { data } = await api.get<LegalAcceptanceSettings>(
    "/system-settings/legal-acceptance",
  );

  return {
    enabled: data?.enabled === true,
  };
}

export async function saveLegalAcceptanceSettings(enabled: boolean) {
  const { data } = await api.put<LegalAcceptanceSettings>(
    "/system-settings/legal-acceptance",
    { enabled },
  );

  return {
    enabled: data?.enabled === true,
  };
}
