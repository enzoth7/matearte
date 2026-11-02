export type PurchaseFilter = "any" | "bought" | "never";
export type AccountFilter = "any" | "yes" | "no";

export type SegmentFilters = {
  sources?: string[];
  countries?: string[];
  channels?: string[];
  purchase?: PurchaseFilter;
  minPurchases?: number;
  lastPurchaseOlderThanDays?: number;
  lastPurchaseWithinDays?: number;
  account?: AccountFilter;
};

export type SegmentContact = {
  email: string;
  name: string | null;
  source: string | null;
  country: string | null;
  channel: string | null;
  purchase_count: number;
  last_purchase_at: string | null;
};

// Subconjunto del constructor de consultas de PostgREST que necesitan los filtros.
export type SegmentQuery = {
  in(column: string, values: string[]): SegmentQuery;
  eq(column: string, value: string | number | boolean): SegmentQuery;
  neq(column: string, value: string): SegmentQuery;
  gt(column: string, value: number): SegmentQuery;
  gte(column: string, value: string | number): SegmentQuery;
  lte(column: string, value: string): SegmentQuery;
};

const maxValues = 25;
const maxDays = 3650;

const textList = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean))].slice(0, maxValues)
  : [];
const wholeNumber = (value: unknown, max: number) => {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(number) && number >= 1 && number <= max ? number : undefined;
};

// Descarta claves desconocidas y valores fuera de rango: el resultado es seguro de guardar y evaluar.
export function normalizeSegmentFilters(raw: unknown): SegmentFilters {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const filters: SegmentFilters = {};
  for (const key of ["sources", "countries", "channels"] as const) {
    const values = textList(input[key]);
    if (values.length) filters[key] = values;
  }
  if (input.purchase === "bought" || input.purchase === "never") filters.purchase = input.purchase;
  if (input.account === "yes" || input.account === "no") filters.account = input.account;
  const minPurchases = wholeNumber(input.minPurchases, 1000);
  if (minPurchases && filters.purchase !== "never") filters.minPurchases = minPurchases;
  const older = wholeNumber(input.lastPurchaseOlderThanDays, maxDays);
  if (older && filters.purchase !== "never") filters.lastPurchaseOlderThanDays = older;
  const within = wholeNumber(input.lastPurchaseWithinDays, maxDays);
  if (within && filters.purchase !== "never") filters.lastPurchaseWithinDays = within;
  return filters;
}

export const isEmptySegment = (filters: SegmentFilters) => Object.keys(filters).length === 0;

// Las bajas nunca entran, sin importar los filtros: cada consulta de audiencia pasa por acá.
export function applySegmentFilters(query: SegmentQuery, filters: SegmentFilters, now = new Date()): SegmentQuery {
  let result = query.neq("subscription_status", "unsubscribed");
  if (filters.sources?.length) result = result.in("source", filters.sources);
  if (filters.countries?.length) result = result.in("country", filters.countries);
  if (filters.channels?.length) result = result.in("channel", filters.channels);
  if (filters.purchase === "never") result = result.eq("purchase_count", 0);
  const bought = filters.purchase === "bought" || filters.minPurchases || filters.lastPurchaseOlderThanDays || filters.lastPurchaseWithinDays;
  if (bought) result = result.gt("purchase_count", 0);
  if (filters.minPurchases) result = result.gte("purchase_count", filters.minPurchases);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  if (filters.lastPurchaseOlderThanDays) result = result.lte("last_purchase_at", daysAgo(filters.lastPurchaseOlderThanDays));
  if (filters.lastPurchaseWithinDays) result = result.gte("last_purchase_at", daysAgo(filters.lastPurchaseWithinDays));
  if (filters.account === "yes") result = result.eq("has_account", true);
  if (filters.account === "no") result = result.eq("has_account", false);
  return result;
}

export function describeSegment(filters: SegmentFilters): string[] {
  const lines: string[] = [];
  if (filters.sources?.length) lines.push(`Origen: ${filters.sources.join(", ")}`);
  if (filters.countries?.length) lines.push(`País: ${filters.countries.join(", ")}`);
  if (filters.channels?.length) lines.push(`Canal de la última compra: ${filters.channels.join(", ")}`);
  if (filters.purchase === "never") lines.push("Nunca compraron");
  else if (filters.purchase === "bought") lines.push("Ya compraron");
  if (filters.minPurchases) lines.push(`${filters.minPurchases} compras o más`);
  if (filters.lastPurchaseOlderThanDays) lines.push(`Última compra hace más de ${filters.lastPurchaseOlderThanDays} días`);
  if (filters.lastPurchaseWithinDays) lines.push(`Última compra en los últimos ${filters.lastPurchaseWithinDays} días`);
  if (filters.account === "yes") lines.push("Con cuenta en la web");
  if (filters.account === "no") lines.push("Sin cuenta en la web");
  return lines;
}

// Divide el orden de envío en tandas del tamaño indicado.
export function splitIntoBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}
