import { describe, expect, it } from "vitest";
import { seedFixture as seed } from "./testing/fixture";
import { buildFinanceProjection } from "./financeProjection";
import { buildExpenseForecast, buildRevenueForecast } from "./revenueForecast";

describe("proyección financiera mensual", () => {
  it("separa cobros, cuentas por cobrar, pagos y cuentas por pagar", () => {
    const months = buildFinanceProjection(seed(), { asOf: "2026-10-13" });
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe("2026-10");
    expect(months[11].key).toBe("2027-09");
    expect(months[0].actualIncome).toBe(63025);
    expect(months[0].receivable).toBe(31039);
    expect(months[0].actualExpense).toBe(14500);
    expect(months[0].payable).toBe(68000);
    expect(months[0].result).toBe(11564);
    expect(months[1].estimatedIncome).toBe(buildRevenueForecast(seed(), { asOf: "2026-10-13" }).months[1].linear);
    expect(months[1].estimatedExpense).toBe(buildExpenseForecast(seed(), { asOf: "2026-10-13" }).months[1].linear);
    expect(months[0].opening).toBe(0);
    expect(months[1].opening).toBe(months[0].cumulative);
    expect(months.every((month) => Number.isFinite(month.opening) && Number.isFinite(month.cumulative))).toBe(true);
    expect(months[1].cumulative).toBe(months[0].result + months[1].result);
    for (const month of months) {
      expect(month.income).toBe(month.actualIncome + month.receivable + month.estimatedIncome);
      expect(month.expense).toBe(month.actualExpense + month.payable + month.estimatedExpense);
      expect(month.result).toBe(month.income - month.expense);
      expect(month.cumulative).toBe(month.opening + month.result);
    }
    expect(new Set(months.slice(1).map((month) => month.estimatedIncome)).size).toBeGreaterThan(1);
    expect(new Set(months.slice(1).map((month) => month.estimatedExpense)).size).toBeGreaterThan(1);
  });

  it("actualiza la estimación sin convertirla en movimiento realizado", () => {
    const baseline = buildFinanceProjection(seed(), { asOf: "2026-10-13", growthPercent: 0 });
    const growing = buildFinanceProjection(seed(), { asOf: "2026-10-13", growthPercent: 5, openingBalance: 2000 });
    expect(growing[0].actualIncome).toBe(baseline[0].actualIncome);
    expect(growing[1].estimatedIncome).toBeGreaterThan(baseline[1].estimatedIncome);
    expect(growing[0].cumulative).toBe(baseline[0].result + 2000);
  });

  it("no duplica los egresos futuros ya registrados dentro del costo estimado", () => {
    const state = seed();
    state.expenses.push({
      id: "future-paid", name: "Compra prevista", amount: 10000,
      date: "2026-11-15", paid: true, category: "Compras",
    });
    const november = buildFinanceProjection(state, { asOf: "2026-10-13" })[1];
    const expected = buildExpenseForecast(state, { asOf: "2026-10-13" }).months[1].linear;
    expect(november.actualExpense).toBe(10000);
    expect(november.estimatedExpense).toBe(expected - 10000);
    expect(november.expense).toBe(expected);
  });
});
