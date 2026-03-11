import { api } from "./api";
import type { Branch } from "../types/branch";

export type CreateBranchInput = {
  name: string;
  city: string;
  state: string;
};

export type UpdateBranchInput = CreateBranchInput;

export async function getBranches() {
  const response = await api.get("/branches");

  if (Array.isArray(response.data)) return response.data as Branch[];
  if (Array.isArray(response.data?.items)) return response.data.items as Branch[];
  if (Array.isArray(response.data?.data)) return response.data.data as Branch[];

  return [];
}

export async function createBranch(data: CreateBranchInput) {
  const response = await api.post<Branch>("/branches", data);
  return response.data;
}

export async function updateBranch(id: string, data: UpdateBranchInput) {
  const response = await api.patch<Branch>(`/branches/${id}`, data);
  return response.data;
}

export async function deleteBranch(id: string) {
  await api.delete(`/branches/${id}`);
}
