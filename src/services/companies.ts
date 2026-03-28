import { api } from "./api";
import type { Company } from "../types/company";

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
  const response = await api.get<Company[]>("/companies");
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray((response.data as any)?.items)) return (response.data as any).items;
  if (Array.isArray((response.data as any)?.data)) return (response.data as any).data;
  return [];
}

export async function createCompany(data: CreateCompanyInput) {
  const response = await api.post<Company>("/companies", data);
  return response.data;
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  const response = await api.patch<Company>(`/companies/${id}`, data);
  return response.data;
}

export async function deleteCompany(id: string) {
  await api.delete(`/companies/${id}`);
}
