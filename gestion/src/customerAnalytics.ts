import { allCountries } from "country-region-data";
import type { Customer, Order } from "./data";
import { isSale } from "./data";
import { customerDisplayChannel } from "./customerChannel";
import { countryDisplayName, countryForCity, flagCode } from "./location";

export const UNSPECIFIED = "Sin especificar";

export type Slice = { name: string; customers: number; orders: number };
export type AgeBucket = { label: string; customers: number };
export type MonthPoint = { month: string; label: string; customers: number };

export type CustomerAnalytics = {
  total: number;
  withOrders: number;
  wholesale: number;
  retail: number;
  countries: Slice[];
  /** País (nombre canónico) → provincias o estados de ese país. */
  provincesByCountry: Map<string, Slice[]>;
  ages: { buckets: AgeBucket[]; known: number; average: number | null; median: number | null };
  channels: Slice[];
  newByMonth: MonthPoint[];
  newLast30Days: number;
  completeness: { label: string; count: number }[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");
const regionKey = (value: string) => normalize(value).replace(/^(provincia|departamento|estado|region|state|province)\s+(de(l)?\s+)?/, "").replace(/\s+/g, " ");
const descending = (a: Slice, b: Slice) => b.customers - a.customers || b.orders - a.orders || a.name.localeCompare(b.name, "es");
const withUnspecifiedLast = (rows: Slice[]) => [...rows.filter((row) => row.name !== UNSPECIFIED).sort(descending), ...rows.filter((row) => row.name === UNSPECIFIED)];

/** Nombre del país tal como se muestra en la base ("UY" y "uruguay" cuentan como Uruguay); si falta, se intenta por ciudad. */
export function canonicalCountry(customer: Pick<Customer, "country" | "city">): string {
  const raw = (customer.country || "").trim();
  if (raw && normalize(raw) !== normalize(UNSPECIFIED)) {
    const code = flagCode(raw);
    return code ? countryDisplayName(code) : countryDisplayName(raw);
  }
  const byCity = countryForCity(customer.city || "");
  return byCity === UNSPECIFIED ? UNSPECIFIED : byCity;
}

const regionsOf = (country: string) => {
  const code = flagCode(country)?.toUpperCase();
  return allCountries.find((entry) => entry[1] === code)?.[2].map(([name]) => name) ?? [];
};

/** Provincia o estado normalizado: usa el nombre oficial del país cuando coincide, y si no, el texto cargado. */
export function canonicalRegion(country: string, value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return UNSPECIFIED;
  const key = regionKey(raw);
  const official = regionsOf(country).find((name) => regionKey(name) === key);
  return official || raw.replace(/\s+/g, " ");
}

export function ageOn(birthDate: string | undefined, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate || "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 && age <= 110 ? age : null;
}

const ageRanges: { label: string; min: number; max: number }[] = [
  { label: "<18", min: 0, max: 17 },
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55-64", min: 55, max: 64 },
  { label: "65+", min: 65, max: 110 },
];

// El año solo aparece en el primer mes y en enero: así las etiquetas no se pisan en pantallas angostas.
const monthLabel = (key: string, withYear: boolean) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es", withYear ? { month: "short", year: "2-digit" } : { month: "short" }).format(new Date(year, month - 1, 1)).replace(".", "");
};

export function buildCustomerAnalytics(customers: Customer[], orders: Order[], today = new Date()): CustomerAnalytics {
  const salesByCustomer = new Map<string, Order[]>();
  for (const order of orders.filter(isSale)) salesByCustomer.set(order.customerId, [...(salesByCustomer.get(order.customerId) || []), order]);
  const allOrdersByCustomer = new Map<string, Order[]>();
  for (const order of orders) allOrdersByCustomer.set(order.customerId, [...(allOrdersByCustomer.get(order.customerId) || []), order]);

  const countryMap = new Map<string, Slice>();
  const provinceMaps = new Map<string, Map<string, Slice>>();
  const channelMap = new Map<string, Slice>();
  const bump = (map: Map<string, Slice>, name: string, orderCount: number) => {
    const slice = map.get(name) || { name, customers: 0, orders: 0 };
    slice.customers += 1; slice.orders += orderCount;
    map.set(name, slice);
  };

  const ages: number[] = [];
  const bucketCounts = ageRanges.map(() => 0);
  const monthCounts = new Map<string, number>();
  const start30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  let newLast30Days = 0;
  let withOrders = 0;
  let wholesale = 0;
  const completeness = { country: 0, province: 0, birth: 0, email: 0, phone: 0 };

  for (const customer of customers) {
    const sales = salesByCustomer.get(customer.id) || [];
    if (sales.length) withOrders += 1;
    if (customer.segment === "Mayorista") wholesale += 1;

    const country = canonicalCountry(customer);
    bump(countryMap, country, sales.length);
    const region = canonicalRegion(country, customer.department);
    if (!provinceMaps.has(country)) provinceMaps.set(country, new Map());
    bump(provinceMaps.get(country)!, region, sales.length);

    bump(channelMap, customerDisplayChannel(customer, allOrdersByCustomer.get(customer.id) || []) || UNSPECIFIED, sales.length);

    const age = ageOn(customer.birthDate, today);
    if (age !== null) {
      ages.push(age);
      const index = ageRanges.findIndex((range) => age >= range.min && age <= range.max);
      if (index >= 0) bucketCounts[index] += 1;
    }

    const created = (customer.createdAt || customer.firstPurchaseDate || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(created)) {
      monthCounts.set(created.slice(0, 7), (monthCounts.get(created.slice(0, 7)) || 0) + 1);
      if (new Date(`${created}T12:00:00`) >= start30) newLast30Days += 1;
    }

    if (country !== UNSPECIFIED) completeness.country += 1;
    if (region !== UNSPECIFIED) completeness.province += 1;
    if (age !== null) completeness.birth += 1;
    if (customer.email?.trim()) completeness.email += 1;
    if (customer.phone?.trim()) completeness.phone += 1;
  }

  const sortedAges = [...ages].sort((a, b) => a - b);
  const months: MonthPoint[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, label: monthLabel(key, offset === 11 || date.getMonth() === 0), customers: monthCounts.get(key) || 0 });
  }

  return {
    total: customers.length,
    withOrders,
    wholesale,
    retail: customers.length - wholesale,
    countries: withUnspecifiedLast([...countryMap.values()]),
    provincesByCountry: new Map([...provinceMaps].map(([country, map]) => [country, withUnspecifiedLast([...map.values()])])),
    ages: {
      buckets: ageRanges.map((range, index) => ({ label: range.label, customers: bucketCounts[index] })),
      known: ages.length,
      average: ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length * 10) / 10 : null,
      median: ages.length ? sortedAges[Math.floor(sortedAges.length / 2)] : null,
    },
    channels: withUnspecifiedLast([...channelMap.values()]),
    newByMonth: months,
    newLast30Days,
    completeness: [
      { label: "País", count: completeness.country },
      { label: "Provincia o estado", count: completeness.province },
      { label: "Fecha de nacimiento", count: completeness.birth },
      { label: "Mail", count: completeness.email },
      { label: "Celular", count: completeness.phone },
    ],
  };
}

/** Los países más grandes se muestran uno por uno; el resto se agrupa en "Otros". */
export function topWithOthers(rows: Slice[], limit: number): Slice[] {
  const known = rows.filter((row) => row.name !== UNSPECIFIED);
  const unspecified = rows.filter((row) => row.name === UNSPECIFIED);
  if (known.length <= limit) return [...known, ...unspecified];
  const rest = known.slice(limit);
  const others: Slice = { name: "Otros", customers: rest.reduce((s, r) => s + r.customers, 0), orders: rest.reduce((s, r) => s + r.orders, 0) };
  return [...known.slice(0, limit), others, ...unspecified];
}
