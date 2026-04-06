export type UserRole = "ADMIN" | "FLEET_MANAGER";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  companyName?: string | null;
  branchId?: string | null;
};
