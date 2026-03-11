import { api } from "./api";
import type { User } from "../types/user";

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "FLEET_MANAGER";
};

export type UpdateUserInput = {
  name: string;
  email: string;
  role: "ADMIN" | "FLEET_MANAGER";
};

export async function getUsers() {
  const response = await api.get("/users");

  if (Array.isArray(response.data)) return response.data as User[];
  if (Array.isArray(response.data?.items)) return response.data.items as User[];
  if (Array.isArray(response.data?.data)) return response.data.data as User[];

  return [];
}

export async function createUser(data: CreateUserInput) {
  const response = await api.post<User>("/users", data);
  return response.data;
}

export async function updateUser(id: string, data: UpdateUserInput) {
  const response = await api.patch<User>(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`);
}