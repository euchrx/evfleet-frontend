export type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "FLEET_MANAGER";
  createdAt: string;
  companyId?: string;
};
