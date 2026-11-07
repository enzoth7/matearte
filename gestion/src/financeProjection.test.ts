import { describe, expect, it } from "vitest";
import { seedFixture as seed } from "./testing/fixture";
import { buildFinanceProjection } from "./financeProjection";
import { buildExpenseForecast, buildRevenueForecast } from "./revenueForecast";
import { seed as emptyState, paid, balance, type Order } from "./data";

describe("proyección financiera mensual", () => {
  it("separa cobros, cuentas por cobrar, pagos y cuentas por pagar", () => {
    const months = buildFinanceProjection(seed(), { asOf: "2026-10-13" });
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe("2026-10");
    expect(months[11].key).toBe("2027-09");
    expect(months[0].actualIncome).toBe(63025);
    expect(months[0].receivable).toBe(13105);
    expect(months[0].actualExpense).toBe(14500);
    expect(months[0].payable).toBe(68000);
    expect(months[0].result).toBe(-6370);
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

  it("descuenta el dinero a favor del cobro futuro sin volver a registrar el ingreso", () => {
    const state = emptyState();
    const base: Order = {
      id: "pedido-octubre", source: "local", contactId: "cliente-1", customerId: "cliente-1",
      productId: "mate", quantity: 1, unitPrice: 100, channel: "Local", date: "2026-10-01",
      due: "2026-10-20", production: "No aplica", delivery: "Pendiente", method: "Retiro",
      design: false, approved: true,
    };
    state.orders = [base, { ...base, id: "pedido-noviembre", date: "2026-11-01", due: "2026-11-20" }];
    state.accountReceipts = [{ id: "entrega-1", contactId: "cliente-1", amountMinor: 6000,
      sourceAmountMinor: 6000, currency: "UYU", paymentMethod: "Efectivo", paidOn: "2026-10-05", note: null }];
    state.payments = [{ id: "entrega-1", orderId: "", contactId: "cliente-1", accountReceiptId: "entrega-1",
      amount: 60, date: "2026-10-05", method: "Efectivo" }];
    const months = buildFinanceProjection(state, { asOf: "2026-10-13" });
    expect(months[0].actualIncome).toBe(60);
    expect(months[0].receivable).toBe(40);
    expect(months[1].receivable).toBe(100);
    expect(months[0].actualIncome + months[0].receivable).toBe(100);
  });

  it("aplica el saldo de una entrega al pedido mayorista identificado en la base", () => {
    const state = emptyState();
    const order: Order = {
      id: "grupo-mayorista", wholesaleSaleId: "pedido-en-base", source: "wholesale",
      contactId: "cliente-1", customerId: "cliente-1", wholesaleOpeningPaid: 0, wholesaleOpeningPaidArg: 0,
      wholesaleTotalArg: 100, wholesaleTotalUyu: 100,
      productId: "mate", quantity: 1, unitPrice: 100, channel: "Mayorista", date: "2026-10-01",
      due: "2026-10-20", production: "Pendiente", delivery: "Pendiente", method: "Envío",
      design: false, approved: true,
    };
    state.orders = [order];
    state.accountAllocations = [{ id: "asignacion-1", receiptId: "entrega-1", orderId: "pedido-en-base",
      amountMinor: 4000, sourceAmountMinor: 4000, allocatedAt: "2026-10-05T12:00:00Z" }];
    expect(paid(state, order)).toBe(40);
    expect(balance(state, order)).toBe(60);
    expect(buildFinanceProjection(state, { asOf: "2026-10-13" })[0].receivable).toBe(60);
  });
});
