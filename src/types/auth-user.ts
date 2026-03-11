export type UserRole = "ADMIN" | "FLEET_MANAGER";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
};