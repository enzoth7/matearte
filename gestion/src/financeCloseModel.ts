import type { Payment } from "./data";
import type { ExpenseSources } from "./expenseSource";
import type { FinanceManualIncome } from "./financeIncomeSource";

export type FinanceCurrency = "UYU" | "USD" | "ARS";
export type FinanceAccount = { id: string; name: string; kind: "bank" | "cash" | "wallet"; currency: FinanceCurrency };
export type FinanceBalance = FinanceAccount & { amount_minor: number };
export type FinanceAdjustment = {
  id: string; kind: "aporte" | "retiro"; currency: FinanceCurrency; amount_minor: number; note: string;
};
export type FinanceCashEntry = {
  id: string; source: "web" | "local" | "wholesale" | "customer" | "purchase" | "fixed" | "manual";
  kind: "income" | "expense"; date: string; label: string; currency: FinanceCurrency; amount_minor: number;
  exchange_rate_to_uyu?: number | null;
};
export type FinanceCloseSummary = {
  opening_uyu_minor: number | null; income_uyu_minor: number | null; expense_uyu_minor: number | null;
  result_uyu_minor: number | null; adjustment_uyu_minor: number | null; expected_uyu_minor: number | null;
  actual_uyu_minor: number | null; difference_uyu_minor: number | null;
  missing_currencies: FinanceCurrency[];
};
export type FinanceCloseRecord = {
  id: string; month: string; revision: number; status: "draft" | "closed"; reason: string | null;
  balances: FinanceBalance[]; adjustments: FinanceAdjustment[]; rates: Record<string, number>;
  entries: FinanceCashEntry[]; opening_balances: FinanceBalance[]; summary: FinanceCloseSummary;
  created_at: string; closed_at: string | null;
};

export const firstFinanceCloseMonth = "2026-11";
export const monthEnd = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, "0")}`;
};
export const previousMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
};
const isCurrency = (value: string | undefined): value is FinanceCurrency =>
  value === "UYU" || value === "USD" || value === "ARS";
const safeMinor = (amount: number): number | null => {
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
};

export function buildFinanceCashEntries(month: string, payments: Payment[], sources: ExpenseSources, manualIncomes: FinanceManualIncome[] = []): {
  entries: FinanceCashEntry[]; unknownAmounts: number;
} {
  const entries: FinanceCashEntry[] = [];
  let unknownAmounts = 0;
  for (const payment of payments) {
    if (!payment.date.startsWith(month)) continue;
    const currency = payment.sourceCurrency || "UYU";
    if (!isCurrency(currency)) { unknownAmounts++; continue; }
    const originalAmount = payment.sourceAmount ?? payment.amount;
    const amount_minor = originalAmount == null ? null : safeMinor(originalAmount);
    if (amount_minor == null) { unknownAmounts++; continue; }
    const source = payment.id.startsWith("wholesale-receipt:") ? "wholesale"
      : payment.id.startsWith("account-receipt:") ? "customer"
        : payment.id.startsWith("local:") || payment.id.startsWith("local-receipt:") ? "local" : "web";
    entries.push({
      id: payment.id, source, kind: "income", date: payment.date,
      label: source === "customer" ? "Cobro a cuenta" : source === "wholesale" ? "Cobro mayorista"
        : source === "local" ? "Cobro local" : "Cobro web",
      currency, amount_minor,
    });
  }
  for (const income of manualIncomes) {
    if (!income.receivedOn.startsWith(month)) continue;
    if (!Number.isSafeInteger(income.amountMinor) || income.amountMinor <= 0) { unknownAmounts++; continue; }
    entries.push({ id: `manual:${income.id}`, source: "manual", kind: "income", date: income.receivedOn,
      label: `${income.category}: ${income.description}`, currency: income.currency, amount_minor: income.amountMinor,
      exchange_rate_to_uyu: income.exchangeRateToUyu });
  }
  for (const purchase of sources.purchases) {
    if (purchase.status !== "pagada") continue;
    const date = purchase.paid_on || purchase.purchased_on;
    if (!date.startsWith(month)) continue;
    if (!isCurrency(purchase.currency) || !Number.isSafeInteger(Number(purchase.amount_minor))) { unknownAmounts++; continue; }
    entries.push({
      id: `purchase:${purchase.id}`, source: "purchase", kind: "expense", date,
      label: purchase.description, currency: purchase.currency, amount_minor: Number(purchase.amount_minor),
      exchange_rate_to_uyu: Number(purchase.exchange_rate_to_uyu) || null,
    });
  }
  const fixedById = new Map(sources.fixed.map((row) => [row.id, row]));
  for (const payment of sources.payments) {
    if (!payment.paid_on.startsWith(month)) continue;
    const fixed = fixedById.get(payment.fixed_expense_id);
    if (!fixed || !isCurrency(fixed.currency) || !Number.isSafeInteger(Number(payment.amount_minor))) { unknownAmounts++; continue; }
    entries.push({
      id: `fixed:${payment.id}`, source: "fixed", kind: "expense", date: payment.paid_on,
      label: fixed.name, currency: fixed.currency, amount_minor: Number(payment.amount_minor),
      exchange_rate_to_uyu: Number(payment.exchange_rate_to_uyu) || null,
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { entries, unknownAmounts };
}

export function calculateFinanceClose(
  balances: FinanceBalance[],
  openingBalances: FinanceBalance[] | null,
  adjustments: FinanceAdjustment[],
  entries: FinanceCashEntry[],
  rates: Record<string, number>,
  monthlyAdjustmentMinor = 0,
): FinanceCloseSummary {
  const used = new Set<FinanceCurrency>([
    ...balances.map((row) => row.currency),
    ...(openingBalances || []).map((row) => row.currency),
    ...adjustments.map((row) => row.currency),
    ...entries.filter((row) => row.currency !== "UYU" && !(Number(row.exchange_rate_to_uyu) > 0)).map((row) => row.currency),
  ]);
  const missing_currencies = [...used].filter((currency) => currency !== "UYU" && !(Number(rates[currency]) > 0));
  const convert = (amount_minor: number, currency: FinanceCurrency, savedRate?: number | null) =>
    Math.round(amount_minor * (currency === "UYU" ? 1 : Number(savedRate) > 0 ? Number(savedRate) : Number(rates[currency])));
  if (missing_currencies.length) {
    return {
      opening_uyu_minor: null, income_uyu_minor: null, expense_uyu_minor: null, result_uyu_minor: null,
      adjustment_uyu_minor: null, expected_uyu_minor: null, actual_uyu_minor: null,
      difference_uyu_minor: null, missing_currencies,
    };
  }
  const sum = (rows: { amount_minor: number; currency: FinanceCurrency; exchange_rate_to_uyu?: number | null }[]) =>
    rows.reduce((total, row) => total + convert(row.amount_minor, row.currency, row.exchange_rate_to_uyu), 0);
  const income_uyu_minor = sum(entries.filter((entry) => entry.kind === "income"));
  const expense_uyu_minor = sum(entries.filter((entry) => entry.kind === "expense"));
  const adjustment_uyu_minor = adjustments.reduce((total, row) =>
    total + (row.kind === "aporte" ? 1 : -1) * convert(row.amount_minor, row.currency), monthlyAdjustmentMinor);
  const opening_uyu_minor = openingBalances === null ? null : sum(openingBalances);
  const actual_uyu_minor = sum(balances);
  const result_uyu_minor = income_uyu_minor - expense_uyu_minor;
  const expected_uyu_minor = opening_uyu_minor === null ? null : opening_uyu_minor + result_uyu_minor + adjustment_uyu_minor;
  return {
    opening_uyu_minor, income_uyu_minor, expense_uyu_minor, result_uyu_minor,
    adjustment_uyu_minor, expected_uyu_minor, actual_uyu_minor,
    difference_uyu_minor: expected_uyu_minor === null ? null : actual_uyu_minor - expected_uyu_minor,
    missing_currencies,
  };
}

export function sameFinanceEntries(left: FinanceCashEntry[], right: FinanceCashEntry[]): boolean {
  const normalized = (rows: FinanceCashEntry[]) => JSON.stringify([...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((row) => [row.id, row.date, row.kind, row.currency, row.amount_minor, row.exchange_rate_to_uyu || null]));
  return normalized(left) === normalized(right);
}
