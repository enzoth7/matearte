import { describe, expect, it } from "vitest";
import { total } from "./data";
import { seedFixture as seed } from "./testing/fixture";
import { overviewRange, overviewScope, salesByCustomerType } from "./overview";

describe("períodos del resumen", () => {
  it("usa límites inclusivos y deja fuera movimientos futuros", () => {
    expect(overviewRange("7d", "2026-10-13")).toEqual({ start: "2026-10-07", end: "2026-10-13" });
    expect(overviewRange("14d", "2026-10-13")).toEqual({ start: "2026-09-30", end: "2026-10-13" });
    expect(overviewRange("1m", "2026-10-13")).toEqual({ start: "2026-09-13", end: "2026-10-13" });
    expect(overviewRange("3m", "2026-10-13")).toEqual({ start: "2026-07-13", end: "2026-10-13" });
    expect(overviewRange("6m", "2026-10-13")).toEqual({ start: "2026-04-13", end: "2026-10-13" });
  });

  it("mantiene pedidos, egresos y puntos del gráfico en el mismo período", () => {
    const state = seed();
    state.orders.push({ ...state.orders[0], id: "old", date: "2026-05-15" });
    state.orders.push({ ...state.orders[0], id: "future", date: "2026-10-14" });
    state.expenses.push({ ...state.expenses[0], id: "old", date: "2026-05-15", amount: 500 });
    const week = overviewScope(state, "7d", "2026-10-13");
    const sixMonths = overviewScope(state, "6m", "2026-10-13");
    expect(week.orders).toHaveLength(6);
    expect(week.expenses.map((expense) => expense.id)).toEqual(["e1"]);
    expect(sixMonths.orders.some((order) => order.id === "old")).toBe(true);
    expect(sixMonths.orders.some((order) => order.id === "future")).toBe(false);
    expect(sixMonths.trend.reduce((sum, point) => sum + point.ventas, 0))
      .toBe(sixMonths.orders.reduce((sum, order) => sum + total(order), 0));
    expect(sixMonths.trend.reduce((sum, point) => sum + point.egresos, 0))
      .toBe(sixMonths.expenses.filter((expense) => expense.paid).reduce((sum, expense) => sum + expense.amount, 0));
  });

  it("compara ventas minoristas y mayoristas por importe y cantidad", () => {
    const state = seed();
    const minorista = state.customers.find(customer => customer.segment !== "Mayorista")!;
    const mayorista = state.customers.find(customer => customer.segment === "Mayorista")!;
    const orders = [
      { ...state.orders[0], id: "retail", customerId: minorista.id, source: "local" as const, totalAmount: 1200 },
      { ...state.orders[0], id: "wholesale", customerId: mayorista.id, totalAmount: 4800 },
      { ...state.orders[0], id: "wholesale-source", customerId: minorista.id, source: "wholesale" as const, totalAmount: 2000 },
    ];

    expect(salesByCustomerType(state, orders)).toEqual([
      { type: "Minorista", total: 1200, orders: 1 },
      { type: "Mayorista", total: 6800, orders: 2 },
    ]);
  });
});
