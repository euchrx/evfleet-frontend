import { api } from "./api";

export type FiscalEnvironment = "HOMOLOGATION" | "PRODUCTION";

export type CompanyFiscalSettings = {
  id: string;
  companyId: string;

  cnpj: string;
  corporateName: string;
  tradeName?: string | null;
  stateRegistration?: string | null;
  taxRegime?: string | null;

  addressStreet: string;
  addressNumber: string;
  addressDistrict: string;
  addressComplement?: string | null;
  cityName: string;
  cityIbgeCode: string;
  state: string;
  zipCode: string;

  mdfeEnvironment: FiscalEnvironment;
  mdfeSeries: number;
  mdfeNextNumber: number;

  certificatePfxUrl?: string | null;
  certificatePasswordEncrypted?: string | null;
  certificateExpiresAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type UpsertCompanyFiscalSettingsInput = Omit<
  CompanyFiscalSettings,
  "id" | "companyId" | "createdAt" | "updatedAt"
>;

export async function getFiscalSettings() {
  const { data } = await api.get<CompanyFiscalSettings>("/fiscal-settings/me");
  return data;
}

export async function saveFiscalSettings(
  payload: UpsertCompanyFiscalSettingsInput,
) {
  const { data } = await api.put<CompanyFiscalSettings>(
    "/fiscal-settings/me",
    payload,
  );

  return data;
}