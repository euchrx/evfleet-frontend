export type MenuVisibilityMap = Record<string, boolean>;

export type MenuVisibilityItem = {
  label: string;
  path: string;
};

export const MENU_VISIBILITY_ITEMS: MenuVisibilityItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Relatórios", path: "/reports" },
  { label: "Veículos", path: "/vehicles" },
  { label: "Motoristas", path: "/drivers" },
  { label: "Manutenções", path: "/maintenance-records" },
  { label: "Abastecimentos", path: "/fuel-records" },
  { label: "Débitos e Multas", path: "/debts" },
  { label: "Gestão de Viagens", path: "/trips" },
  { label: "Gestão de Documentos", path: "/vehicle-documents" },
  { label: "Filiais", path: "/branches" },
  { label: "Como usar", path: "/how-to-use" },
  { label: "Usuários", path: "/users" },
  { label: "Administração", path: "/administration" },
];

const STORAGE_KEY = "evfleet_menu_visibility_v1";

export function getDefaultMenuVisibilityMap() {
  return MENU_VISIBILITY_ITEMS.reduce<MenuVisibilityMap>((acc, item) => {
    acc[item.path] = true;
    return acc;
  }, {});
}

export function getMenuVisibilityMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaults = getDefaultMenuVisibilityMap();
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MenuVisibilityMap>;
    const next: MenuVisibilityMap = { ...defaults };
    for (const item of MENU_VISIBILITY_ITEMS) {
      const value = parsed[item.path];
      if (typeof value === "boolean") next[item.path] = value;
    }
    return next;
  } catch {
    return getDefaultMenuVisibilityMap();
  }
}

export function saveMenuVisibilityMap(map: MenuVisibilityMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function isMenuPathVisible(path: string, map: MenuVisibilityMap) {
  return map[path] !== false;
}
