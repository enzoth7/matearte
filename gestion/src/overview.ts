import { total, isSale, type Expense, type Order, type State } from "./data";

export const overviewPeriods = [
  ["7d", "Última semana"],
  ["14d", "Últimos 14 días"],
  ["1m", "Último mes"],
  ["3m", "Últimos 3 meses"],
  ["6m", "Últimos 6 meses"],
] as const;

export type OverviewPeriod = (typeof overviewPeriods)[number][0];

export function montevideoToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function utcDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number) {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function shiftMonths(iso: string, months: number) {
  const date = utcDate(iso);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return isoDate(target);
}

export function overviewRange(period: OverviewPeriod, end = montevideoToday()) {
  const start = period === "7d" ? shiftDays(end, -6)
    : period === "14d" ? shiftDays(end, -13)
    : shiftMonths(end, period === "1m" ? 1 : period === "3m" ? 3 : 6);
  return { start, end };
}

function weekStart(iso: string) {
  const day = utcDate(iso).getUTCDay();
  return shiftDays(iso, -((day + 6) % 7));
}

function bucketKey(iso: string, period: OverviewPeriod) {
  return period === "6m" ? iso.slice(0, 7)
    : period === "3m" ? weekStart(iso)
    : iso;
}

function bucketLabel(key: string, period: OverviewPeriod) {
  const date = utcDate(period === "6m" ? `${key}-01` : key);
  return new Intl.DateTimeFormat("es-UY", period === "6m"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function overviewScope(s: State, period: OverviewPeriod, end?: string) {
  const range = overviewRange(period, end);
  const inside = (date: string) => date >= range.start && date <= range.end;
  const orders = s.orders.filter((order) => isSale(order) && inside(order.date));
  const expenses = s.expenses.filter((expense) => inside(expense.date));
  const points = new Map<string, { day: string; ventas: number; egresos: number }>();
  for (let date = range.start; date <= range.end; date = shiftDays(date, 1)) {
    const key = bucketKey(date, period);
    if (!points.has(key)) points.set(key, { day: bucketLabel(key, period), ventas: 0, egresos: 0 });
  }
  const add = (date: string, field: "ventas" | "egresos", amount: number) => {
    const point = points.get(bucketKey(date, period));
    if (point) point[field] += amount;
  };
  orders.forEach((order: Order) => add(order.date, "ventas", total(order)));
  expenses.filter((expense: Expense) => expense.paid)
    .forEach((expense) => add(expense.date, "egresos", expense.amount));
  return { ...range, orders, expenses, trend: [...points.values()] };
}
