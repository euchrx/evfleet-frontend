import { api } from "./api";
import type {
  Company,
  CompanyDeleteWithBackupInput,
  CompanyDeleteWithBackupResult,
} from "../types/company";

export type CreateCompanyInput = {
  name: string;
  document?: string;
  slug?: string;
};

export type UpdateCompanyInput = {
  name?: string;
  document?: string;
  slug?: string;
  active?: boolean;
};

export async function getCompanies() {
  const response = await api.get<Company[]>("/companies", {
    headers: { "x-company-scope": "__ALL__" },
  });
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray((response.data as any)?.items)) return (response.data as any).items;
  if (Array.isArray((response.data as any)?.data)) return (response.data as any).data;
  return [];
}

export async function getMyCompany() {
  const response = await api.get<Company>("/companies/me");
  return response.data;
}

export async function getCompanyById(id: string) {
  const response = await api.get<Company>(`/companies/${id}`, {
    headers: { "x-company-scope": "__ALL__" },
  });
  return response.data;
}

export async function createCompany(data: CreateCompanyInput) {
  const response = await api.post<Company>("/companies", data, {
    headers: { "x-company-scope": "__ALL__" },
  });
  return response.data;
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  const response = await api.patch<Company>(`/companies/${id}`, data, {
    headers: { "x-company-scope": "__ALL__" },
  });
  return response.data;
}

export async function deleteCompanyWithBackup(
  id: string,
  data: CompanyDeleteWithBackupInput,
) {
  const response = await api.post<
    | CompanyDeleteWithBackupResult
    | {
        success?: boolean;
        data?: CompanyDeleteWithBackupResult;
      }
  >(`/companies/${id}/delete-with-backup`, data, {
    headers: { "x-company-scope": "__ALL__" },
  });

  if ((response.data as { data?: CompanyDeleteWithBackupResult })?.data) {
    return (response.data as { data: CompanyDeleteWithBackupResult }).data;
  }

  return response.data as CompanyDeleteWithBackupResult;
}
