import { describe, expect, it } from "vitest";
import { buildFinanceCashEntries, calculateFinanceClose, sameFinanceEntries, type FinanceBalance } from "./financeCloseModel";
import type { ExpenseSources } from "./expenseSource";
import type { Payment } from "./data";

const sources: ExpenseSources = {
  purchases: [
    { id: "paid", purchased_on: "2026-10-28", paid_on: "2026-11-04", due_on: "2026-11-02",
      description: "Insumos", category: "Materiales", amount_minor: 5000, currency: "UYU", status: "pagada" },
    { id: "pending", purchased_on: "2026-11-01", paid_on: null, due_on: "2026-11-20",
      description: "Pendiente", category: "Materiales", amount_minor: 7000, currency: "UYU", status: "pendiente" },
  ],
  fixed: [{ id: "rent", name: "Alquiler", category: "Alquiler", amount_minor: 200, currency: "USD",
    due_day: 10, starts_on: "2026-11-01", ends_on: null, active: true }],
  payments: [{ id: "rent-nov", fixed_expense_id: "rent", month: "2026-11-01", amount_minor: 200, paid_on: "2026-11-08" }],
};
const payments: Payment[] = [
  { id: "local:one", orderId: "one", amount: 200, date: "2026-11-03", method: "Efectivo" },
  { id: "web:two", orderId: "two", amount: 200, sourceCurrency: "USD", sourceAmount: 5, date: "2026-11-05", method: "PayPal" },
  { id: "old", orderId: "old", amount: 500, date: "2026-10-31", method: "Transferencia" },
];
const balance = (id: string, currency: "UYU" | "USD", amount_minor: number): FinanceBalance => ({
  id, name: id, kind: "bank", currency, amount_minor,
});

describe("conciliación mensual", () => {
  it("incluye ingresos ajenos a ventas en caja una sola vez y en su fecha", () => {
    const manual = [{ id: "tax-refund", receivedOn: "2026-11-07", category: "Devolución impuestos",
      description: "DGI", amountMinor: 125000, currency: "UYU" as const, exchangeRateToUyu: null }];
    const november = buildFinanceCashEntries("2026-11", payments, sources, manual).entries;
    const october = buildFinanceCashEntries("2026-10", payments, sources, manual).entries;
    expect(november.filter((entry) => entry.id === "manual:tax-refund")).toHaveLength(1);
    expect(october.some((entry) => entry.id === "manual:tax-refund")).toBe(false);
    expect(calculateFinanceClose([], [], [], november, { UYU: 1, USD: 40 }).income_uyu_minor).toBe(165000);
  });
  it("convierte ingresos y egresos en moneda extranjera con la cotización guardada", () => {
    const foreignSources: ExpenseSources = { fixed: [], payments: [], purchases: [{
      id: "ars", purchased_on: "2026-11-09", paid_on: "2026-11-09", due_on: null,
      description: "Compra argentina", category: "Insumos", amount_minor: 1000000,
      currency: "ARS", exchange_rate_to_uyu: 0.03, status: "pagada",
    }] };
    const manual = [{ id: "usd", receivedOn: "2026-11-08", category: "Otros",
      description: "Ingreso en dólares", amountMinor: 10000, currency: "USD" as const, exchangeRateToUyu: 40 }];
    const entries = buildFinanceCashEntries("2026-11", [], foreignSources, manual).entries;
    const summary = calculateFinanceClose([], [], [], entries, { UYU: 1, ARS: 0.05, USD: 50 });
    expect(summary.income_uyu_minor).toBe(400000);
    expect(summary.expense_uyu_minor).toBe(30000);
    expect(summary.result_uyu_minor).toBe(370000);
    expect(sameFinanceEntries(entries, entries.map((row) => row.id === "manual:usd"
      ? { ...row, exchange_rate_to_uyu: 41 } : row))).toBe(false);
  });
  it("toma cobros y egresos efectivamente pagados en el mes, sin duplicar pendientes", () => {
    const { entries, unknownAmounts } = buildFinanceCashEntries("2026-11", payments, sources);
    expect(unknownAmounts).toBe(0);
    expect(entries.map((entry) => entry.id)).toEqual(["local:one", "purchase:paid", "web:two", "fixed:rent-nov"]);
    expect(entries.find((entry) => entry.id === "web:two")).toMatchObject({ currency: "USD", amount_minor: 500 });
  });

  it("separa resultado de caja, ajustes y diferencia de saldos", () => {
    const { entries } = buildFinanceCashEntries("2026-11", payments, sources);
    const summary = calculateFinanceClose(
      [balance("bank-uyu", "UYU", 38000), balance("bank-usd", "USD", 1000)],
      [balance("bank-uyu", "UYU", 10000), balance("bank-usd", "USD", 1000)],
      [{ id: "owner", kind: "aporte", currency: "UYU", amount_minor: 1000, note: "Aporte de socio" }],
      entries,
      { UYU: 1, USD: 40 },
    );
    expect(summary).toMatchObject({
      opening_uyu_minor: 50000, income_uyu_minor: 40000, expense_uyu_minor: 13000,
      result_uyu_minor: 27000, adjustment_uyu_minor: 1000,
      expected_uyu_minor: 78000, actual_uyu_minor: 78000, difference_uyu_minor: 0,
    });
  });

  it("usa el ajuste mensual del resumen una sola vez en el saldo esperado", () => {
    const summary = calculateFinanceClose(
      [balance("bank", "UYU", 85000)],
      [balance("bank", "UYU", 100000)],
      [], [], { UYU: 1 }, -15000,
    );
    expect(summary).toMatchObject({
      adjustment_uyu_minor: -15000, expected_uyu_minor: 85000,
      actual_uyu_minor: 85000, difference_uyu_minor: 0,
    });
  });

  it("permite el saldo inicial cero de noviembre, pero exige cotización y cierre anterior después", () => {
    const { entries } = buildFinanceCashEntries("2026-11", payments, sources);
    const first = calculateFinanceClose([balance("bank", "UYU", 30000)], [], [], entries, { UYU: 1, USD: 40 });
    expect(first.opening_uyu_minor).toBe(0);
    expect(first.difference_uyu_minor).toBe(3000);
    const noRate = calculateFinanceClose([], [], [], entries, { UYU: 1 });
    expect(noRate.missing_currencies).toEqual(["USD"]);
    expect(noRate.result_uyu_minor).toBeNull();
    const noPrevious = calculateFinanceClose([], null, [], entries, { UYU: 1, USD: 40 });
    expect(noPrevious.result_uyu_minor).toBe(27000);
    expect(noPrevious.difference_uyu_minor).toBeNull();
  });

  it("detecta movimientos modificados después de guardar un cierre", () => {
    const { entries } = buildFinanceCashEntries("2026-11", payments, sources);
    expect(sameFinanceEntries(entries, [...entries])).toBe(true);
    expect(sameFinanceEntries(entries, entries.map((entry) => entry.id === "purchase:paid"
      ? { ...entry, amount_minor: entry.amount_minor + 100 } : entry))).toBe(false);
  });
});
