import { api } from "./api";

export type MenuVisibilityMap = Record<string, boolean>;

export type MenuVisibilityItem = {
  label: string;
  path: string;
};

export const MENU_VISIBILITY_ITEMS: MenuVisibilityItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Importação XML NF-e", path: "/xml-import" },
  { label: "Produtos XML", path: "/xml-import/retail-products" },
  { label: "Relatórios", path: "/reports" },
  { label: "Veículos", path: "/vehicles" },
  { label: "Motoristas", path: "/drivers" },
  { label: "Manutenções", path: "/maintenance-records" },
  { label: "Abastecimentos", path: "/fuel-records" },
  { label: "Débitos e Multas", path: "/debts" },
  { label: "Gestão de Viagens", path: "/trips" },
  { label: "Gestão de Documentos", path: "/vehicle-documents" },
  { label: "Como usar", path: "/how-to-use" },
  { label: "Empresas", path: "/companies" },
  { label: "Finanças", path: "/finance" },
  { label: "Usuários", path: "/users" },
  { label: "Administração", path: "/administration" },
];

const CACHE_KEY = "evfleet_menu_visibility_cache_v2";

export function getDefaultMenuVisibilityMap() {
  return MENU_VISIBILITY_ITEMS.reduce<MenuVisibilityMap>((acc, item) => {
    acc[item.path] = true;
    return acc;
  }, {});
}

function normalizeMenuVisibilityMap(raw: unknown): MenuVisibilityMap {
  const defaults = getDefaultMenuVisibilityMap();
  if (!raw || typeof raw !== "object") return defaults;

  const source = raw as Record<string, unknown>;
  const next: MenuVisibilityMap = { ...defaults };
  for (const item of MENU_VISIBILITY_ITEMS) {
    if (typeof source[item.path] === "boolean") {
      next[item.path] = source[item.path] as boolean;
    }
  }

  // Evita lock administrativo acidental.
  next["/administration"] = true;
  return next;
}

export function getCachedMenuVisibilityMap() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return getDefaultMenuVisibilityMap();
    return normalizeMenuVisibilityMap(JSON.parse(raw));
  } catch {
    return getDefaultMenuVisibilityMap();
  }
}

function setCachedMenuVisibilityMap(map: MenuVisibilityMap) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

export async function fetchMenuVisibilityMap() {
  try {
    const { data } = await api.get("/menu-visibility");
    const visibility = normalizeMenuVisibilityMap(data?.visibility);
    setCachedMenuVisibilityMap(visibility);
    return visibility;
  } catch {
    return getCachedMenuVisibilityMap();
  }
}

export async function saveMenuVisibilityMap(map: MenuVisibilityMap) {
  const normalized = normalizeMenuVisibilityMap(map);
  const { data } = await api.put("/menu-visibility", {
    visibility: normalized,
  });
  const saved = normalizeMenuVisibilityMap(data?.visibility);
  setCachedMenuVisibilityMap(saved);
  return saved;
}

export function isMenuPathVisible(path: string, map: MenuVisibilityMap) {
  for (const item of MENU_VISIBILITY_ITEMS) {
    if (path === item.path || path.startsWith(`${item.path}/`)) {
      return map[item.path] !== false;
    }
  }
  return true;
}
