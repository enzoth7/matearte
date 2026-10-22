import type { SupabaseClient } from "@supabase/supabase-js";
import type { Expense } from "./data";

export type PurchaseRecord = {
  id: string; purchased_on: string; description: string; category: string; amount_minor: number; currency: string;
  status: string; paid_on: string | null;
};
export type FixedExpenseRecord = {
  id: string; name: string; category: string; amount_minor: number; currency: string; due_day: number | null;
  starts_on: string; ends_on: string | null; active: boolean;
};
export type FixedPaymentRecord = { id: string; fixed_expense_id: string; month: string; amount_minor: number; paid_on: string };
export type ExpenseSources = { purchases: PurchaseRecord[]; fixed: FixedExpenseRecord[]; payments: FixedPaymentRecord[] };

const pageSize = 1000;
async function readPages<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await read(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    rows.push(...((data || []) as T[]));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

/** Devuelve null si el usuario no tiene permiso o la lectura falla: en ese caso los egresos siguen sin conectar. */
export async function readExpenseSources(client: SupabaseClient): Promise<ExpenseSources | null> {
  try {
    const [purchases, fixed, payments] = await Promise.all([
      readPages<PurchaseRecord>((from, to) => client.from("purchases").select("id,purchased_on,description,category,amount_minor,currency,status,paid_on").order("id").range(from, to)),
      readPages<FixedExpenseRecord>((from, to) => client.from("fixed_expenses").select("id,name,category,amount_minor,currency,due_day,starts_on,ends_on,active").order("id").range(from, to)),
      readPages<FixedPaymentRecord>((from, to) => client.from("fixed_expense_payments").select("id,fixed_expense_id,month,amount_minor,paid_on").order("id").range(from, to)),
    ]);
    return { purchases, fixed, payments };
  } catch {
    return null;
  }
}

/** Misma regla que las políticas RLS de las tablas de compras. */
export function canReadExpenses(membership: { access_user_id?: string | null; allowed_paths?: string[] | null } | null | undefined) {
  return Boolean(membership && (membership.access_user_id === "t1" || !membership.allowed_paths || membership.allowed_paths.includes("/inventario/compras")));
}

const addMonths = (month: string, offset: number) => {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const lastDay = (month: string) => { const [year, number] = month.split("-").map(Number); return new Date(Date.UTC(year, number, 0)).getUTCDate(); };

/**
 * Convierte compras y gastos fijos en egresos en pesos para el resumen financiero.
 * - Compras pagadas cuentan en el mes de su fecha de pago; las pendientes quedan como compromiso por pagar.
 * - Gastos fijos: los meses ya pagados cuentan como pagados; el mes actual y los 11 siguientes se proyectan como por pagar.
 * - Los importes en otra moneda se convierten con la cotización guardada; si falta, se omiten y se cuentan en `skipped`.
 */
export function adaptExpenses(sources: ExpenseSources, rates: Record<string, number>, asOf: string): { expenses: Expense[]; skipped: number } {
  const currentMonth = asOf.slice(0, 7);
  let skipped = 0;
  const toUyu = (minor: number, currency: string) => {
    const rate = currency === "UYU" ? 1 : rates[currency];
    if (!rate) { skipped++; return null; }
    return Math.round(minor * rate) / 100;
  };
  const expenses: Expense[] = [];
  for (const purchase of sources.purchases) {
    const amount = toUyu(Number(purchase.amount_minor), purchase.currency);
    if (amount === null) continue;
    const paid = purchase.status === "pagada";
    expenses.push({ id: `purchase:${purchase.id}`, name: purchase.description, amount, date: paid ? purchase.paid_on || purchase.purchased_on : purchase.purchased_on, paid, category: purchase.category });
  }
  const fixedById = new Map(sources.fixed.map((item) => [item.id, item]));
  const paidKeys = new Set<string>();
  for (const payment of sources.payments) {
    const fixed = fixedById.get(payment.fixed_expense_id);
    if (!fixed) continue;
    const amount = toUyu(Number(payment.amount_minor), fixed.currency);
    paidKeys.add(`${fixed.id}:${payment.month.slice(0, 7)}`);
    if (amount === null) continue;
    expenses.push({ id: `fixed:${fixed.id}:${payment.month.slice(0, 7)}`, name: fixed.name, amount, date: payment.paid_on, paid: true, category: fixed.category });
  }
  for (const fixed of sources.fixed) {
    if (!fixed.active) continue;
    for (let offset = 0; offset < 12; offset++) {
      const month = addMonths(currentMonth, offset);
      if (paidKeys.has(`${fixed.id}:${month}`)) continue;
      if (fixed.starts_on.slice(0, 10) > `${month}-${lastDay(month)}` || (fixed.ends_on && fixed.ends_on.slice(0, 10) < `${month}-01`)) continue;
      const amount = toUyu(Number(fixed.amount_minor), fixed.currency);
      if (amount === null) continue;
      const day = Math.min(fixed.due_day || 1, lastDay(month));
      expenses.push({ id: `fixed:${fixed.id}:${month}`, name: fixed.name, amount, date: `${month}-${String(day).padStart(2, "0")}`, paid: false, category: fixed.category });
    }
  }
  return { expenses: expenses.sort((a, b) => b.date.localeCompare(a.date)), skipped };
}
