import { describe, expect, it } from "vitest";
import { seedFixture as seed } from "./testing/fixture";
import { buildExpenseForecast, buildRevenueForecast } from "./revenueForecast";

describe("tendencias de ingresos", () => {
  it("usa los doce meses completos anteriores y produce dos curvas distintas", () => {
    const forecast = buildRevenueForecast(seed(), { asOf: "2026-10-13" });
    expect(forecast.coverage).toBe(12);
    expect(forecast.history[0].key).toBe("2025-10");
    expect(forecast.history[11].key).toBe("2026-09");
    expect(forecast.months).toHaveLength(12);
    expect(forecast.months[0].key).toBe("2026-10");
    expect(forecast.months[11].key).toBe("2027-09");
    expect(forecast.months.every((month) => Number.isFinite(month.linear) && Number.isFinite(month.logarithmic))).toBe(true);
    expect(forecast.months[11].linear).not.toBe(forecast.months[11].logarithmic);
    const changes = forecast.months.slice(1).map((month, index) => month.linear - forecast.months[index].linear);
    expect(new Set(changes).size).toBeGreaterThan(1);
    const expenses = buildExpenseForecast(seed(), { asOf: "2026-10-13" });
    expect(expenses.coverage).toBe(12);
    expect(new Set(expenses.months.map((month) => month.linear)).size).toBeGreaterThan(1);
  });

  it("ajusta la recta por mínimos cuadrados y no inventa tendencia sin historial suficiente", () => {
    const state = seed();
    state.orders = state.orders.filter((order) => order.id.startsWith("H-"))
      .map((order, index) => ({ ...order, quantity: 1, unitPrice: 100 + 10 * index }));
    const forecast = buildRevenueForecast(state, { asOf: "2026-10-13" });
    expect(forecast.months[0].linear).toBe(220);
    expect(forecast.months[1].linear).toBe(230);
    state.orders = state.orders.slice(0, 3);
    expect(buildRevenueForecast(state, { asOf: "2026-10-13" }).months).toHaveLength(0);
  });
});
