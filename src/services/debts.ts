import axios from "axios";
import { api } from "./api";
import type { Debt } from "../types/debt";

export type CreateDebtInput = {
  description: string;
  category?: "FINE" | "IPVA" | "LICENSING" | "INSURANCE" | "TOLL" | "TAX" | "OTHER";
  amount: number;
  points?: number;
  debtDate: string;
  dueDate?: string;
  creditor?: string;
  isRecurring?: boolean;
  status: string;
  vehicleId: string;
};

export type UpdateDebtInput = CreateDebtInput;

function normalizeDebt(item: any): Debt {
  return {
    ...item,
    debtDate: item?.debtDate,
  };
}

export async function getDebts() {
  try {
    const response = await api.get("/debts");

    if (Array.isArray(response.data)) return response.data.map(normalizeDebt) as Debt[];
    if (Array.isArray(response.data?.items)) return response.data.items.map(normalizeDebt) as Debt[];
    if (Array.isArray(response.data?.data)) return response.data.data.map(normalizeDebt) as Debt[];

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createDebt(data: CreateDebtInput) {
  const response = await api.post<Debt>("/debts", data);
  return normalizeDebt(response.data);
}

export async function updateDebt(id: string, data: UpdateDebtInput) {
  const response = await api.patch<Debt>(`/debts/${id}`, data);
  return normalizeDebt(response.data);
}

export async function deleteDebt(id: string) {
  await api.delete(`/debts/${id}`);
}
