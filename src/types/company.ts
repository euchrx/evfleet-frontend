export type Company = {
  id: string;
  name: string;
  document?: string | null;
  slug?: string | null;
  active: boolean;
  createdAt: string;
};
