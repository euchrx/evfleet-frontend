import axios from "axios";
import { api } from "./api";

export type DangerousProduct = {
  id: string;
  name: string;
  commercialName?: string | null;
  unNumber: string;
  riskClass: string;
  packingGroup?: string | null;
  hazardNumber?: string | null;
  emergencyNumber?: string | null;
  physicalState?: string | null;
  emergencyInstructions?: unknown;
  fispqUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateDangerousProductInput = {
  name: string;
  commercialName?: string;
  unNumber: string;
  riskClass: string;
  packingGroup?: string;
  hazardNumber?: string;
  emergencyNumber?: string;
  physicalState?: string;
  emergencyInstructions?: Record<string, unknown>;
  fispqUrl?: string;
  active?: boolean;
};

export type UpdateDangerousProductInput = Partial<CreateDangerousProductInput>;

export async function getDangerousProducts() {
  try {
    const response = await api.get("/dangerous-products");

    if (Array.isArray(response.data)) {
      return response.data as DangerousProduct[];
    }

    if (Array.isArray(response.data?.items)) {
      return response.data.items as DangerousProduct[];
    }

    if (Array.isArray(response.data?.data)) {
      return response.data.data as DangerousProduct[];
    }

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getActiveDangerousProducts() {
  try {
    const response = await api.get("/dangerous-products/active");

    if (Array.isArray(response.data)) {
      return response.data as DangerousProduct[];
    }

    if (Array.isArray(response.data?.items)) {
      return response.data.items as DangerousProduct[];
    }

    if (Array.isArray(response.data?.data)) {
      return response.data.data as DangerousProduct[];
    }

    return [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getDangerousProduct(id: string) {
  const response = await api.get<DangerousProduct>(`/dangerous-products/${id}`);
  return response.data;
}

export async function createDangerousProduct(data: CreateDangerousProductInput) {
  const response = await api.post<DangerousProduct>("/dangerous-products", data);
  return response.data;
}

export async function updateDangerousProduct(
  id: string,
  data: UpdateDangerousProductInput,
) {
  const response = await api.patch<DangerousProduct>(
    `/dangerous-products/${id}`,
    data,
  );

  return response.data;
}

export async function deleteDangerousProduct(id: string) {
  await api.delete(`/dangerous-products/${id}`);
}