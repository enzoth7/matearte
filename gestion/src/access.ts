import { areas, paths, resolvePath } from "./navigation";
import type { Customer, Order, SalesChannel, State } from "./data";

export const accessUserIds = ["t1", "t2", "t3", "t5"] as const;
export type AccessUserId = (typeof accessUserIds)[number];

const withAreas = (areaIds: string[]) =>
  paths.filter((path) => areaIds.includes(path.split("/")[1]));

export function defaultAccess(): Record<string, string[]> {
  return {
    t1: [...paths],
    t2: [
      "/inicio/resumen",
      "/comercial/pedidos", "/comercial/registrar-min",
      "/clientes/base",
    ],
    t3: [
      "/inicio/resumen", "/inicio/alertas",
      "/comercial/pedidos", "/comercial/registrar-may",
      "/clientes/base",
      "/productos/catalogo", "/productos/servicios", "/productos/ajustes", "/productos/personalizador",
      ...withAreas(["produccion", "inventario", "entregas"]),
    ],
    t5: withAreas(["marketing"]),
  };
}

export function lockedForRichard(path: string): boolean {
  return path === "/administracion/usuarios" || path.startsWith("/finanzas/");
}

export function accessUserId(s: State): AccessUserId {
  if (accessUserIds.some((id) => id === s.activeUserId)) return s.activeUserId as AccessUserId;
  const employee = s.employees.find((person) => person.name === s.user);
  return accessUserIds.find((id) => id === employee?.id) ?? "t2";
}

export function canAccess(s: State, path: string): boolean {
  const normalized = path.split("?")[0];
  if (!resolvePath(normalized)) return false;
  const userId = accessUserId(s);
  if (userId === "t1") return true;
  if (lockedForRichard(normalized)) return false;
  return (s.access?.[userId] ?? defaultAccess()[userId]).includes(normalized);
}

export function firstRegistrationPath(s: State): string | null {
  if (canAccess(s, "/comercial/registrar-min")) return "/comercial/registrar-min";
  if (canAccess(s, "/comercial/registrar-may")) return "/comercial/registrar-may";
  return null;
}

export function visibleAreas(s: State) {
  return areas
    .map((area) => ({
      ...area,
      pages: area.pages.filter(([slug]) => canAccess(s, `/${area.id}/${slug}`)),
    }))
    .filter((area) => area.pages.length > 0);
}

export function firstVisiblePath(s: State): string {
  const area = visibleAreas(s)[0];
  return area ? `/${area.id}/${area.pages[0][0]}` : "/inicio/resumen";
}

export function setAreaAccess(
  s: State,
  userId: Exclude<AccessUserId, "t1">,
  areaId: string,
  enabled: boolean,
): State {
  const area = areas.find((entry) => entry.id === areaId);
  if (!area) return s;
  const current = new Set(s.access?.[userId] ?? defaultAccess()[userId]);
  for (const [slug] of area.pages) {
    const path = `/${area.id}/${slug}`;
    if (lockedForRichard(path)) continue;
    if (enabled) current.add(path);
    else current.delete(path);
  }
  return { ...s, access: { ...s.access, [userId]: [...current] } };
}

export function setPageAccess(
  s: State,
  userId: Exclude<AccessUserId, "t1">,
  path: string,
  enabled: boolean,
): State {
  if (!resolvePath(path) || lockedForRichard(path)) return s;
  const current = new Set(s.access?.[userId] ?? defaultAccess()[userId]);
  if (enabled) current.add(path);
  else current.delete(path);
  return { ...s, access: { ...s.access, [userId]: [...current] } };
}

export function allowedSalesChannels(s: State): SalesChannel[] {
  const userId = accessUserId(s);
  return userId === "t2" ? ["Local", "Feria"] : ["Web", "Local", "Feria", "Instagram", "Facebook", "WhatsApp"];
}

export function visibleOrders(s: State, production = false): Order[] {
  const userId = accessUserId(s);
  if (userId === "t5" && !(s.access?.t5 ?? defaultAccess().t5).some((path) => !path.startsWith("/marketing/"))) return [];
  if (userId === "t1" || userId === "t5" || (userId === "t3" && production)) return s.orders;
  const wholesaleCustomers = new Set(s.customers.filter((customer) => customer.segment === "Mayorista").map((customer) => customer.id));
  if (userId === "t3") return s.orders.filter((order) => order.source === "wholesale" || (order.channel === "Web" && wholesaleCustomers.has(order.customerId)));
  const channels = allowedSalesChannels(s);
  return s.orders.filter((order) => channels.includes(order.channel) && !wholesaleCustomers.has(order.customerId) && order.source !== "wholesale");
}

export function visibleCustomers(s: State): Customer[] {
  const userId = accessUserId(s);
  if (userId === "t5" && !(s.access?.t5 ?? defaultAccess().t5).some((path) => !path.startsWith("/marketing/"))) return [];
  if (userId === "t1" || userId === "t5") return s.customers;
  return s.customers.filter((customer) => userId === "t2" ? customer.segment !== "Mayorista" : customer.segment === "Mayorista");
}
