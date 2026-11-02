import { describe, expect, it } from "vitest";
import { applySegmentFilters, describeSegment, isEmptySegment, normalizeSegmentFilters, splitIntoBatches, type SegmentQuery } from "../../shared/marketingSegments";

function recorder() {
  const calls: unknown[][] = [];
  const query: SegmentQuery = new Proxy({} as SegmentQuery, { get: (_target, method) => (...args: unknown[]) => { calls.push([method, ...args]); return query; } });
  return { query, calls };
}

describe("segmentos de campañas", () => {
  it("descarta claves desconocidas, valores vacíos y números fuera de rango", () => {
    expect(normalizeSegmentFilters({ sources: [" Web ", "Web", "", 4], countries: "UY", purchase: "bought", minPurchases: "2", lastPurchaseOlderThanDays: 99999, hack: true, account: "maybe" }))
      .toEqual({ sources: ["Web"], purchase: "bought", minPurchases: 2 });
    expect(normalizeSegmentFilters(null)).toEqual({});
    expect(normalizeSegmentFilters([1, 2])).toEqual({});
  });

  it("ignora filtros de compra cuando se pide gente que nunca compró", () => {
    expect(normalizeSegmentFilters({ purchase: "never", minPurchases: 3, lastPurchaseWithinDays: 30 })).toEqual({ purchase: "never" });
  });

  it("siempre excluye las bajas, incluso sin filtros", () => {
    const { query, calls } = recorder();
    applySegmentFilters(query, {});
    expect(calls).toEqual([["neq", "subscription_status", "unsubscribed"]]);
    expect(isEmptySegment({})).toBe(true);
  });

  it("traduce los filtros a condiciones de la vista", () => {
    const { query, calls } = recorder();
    const now = new Date("2026-11-30T12:00:00Z");
    applySegmentFilters(query, { sources: ["Web"], channels: ["Local"], purchase: "bought", minPurchases: 2, lastPurchaseOlderThanDays: 90, account: "no" }, now);
    expect(calls).toEqual([
      ["neq", "subscription_status", "unsubscribed"],
      ["in", "source", ["Web"]],
      ["in", "channel", ["Local"]],
      ["gt", "purchase_count", 0],
      ["gte", "purchase_count", 2],
      ["lte", "last_purchase_at", "2026-09-01T12:00:00.000Z"],
      ["eq", "has_account", false],
    ]);
  });

  it("pide compras previas cuando solo se filtra por fecha de última compra", () => {
    const { query, calls } = recorder();
    applySegmentFilters(query, { lastPurchaseWithinDays: 30 }, new Date("2026-11-30T00:00:00Z"));
    expect(calls).toContainEqual(["gt", "purchase_count", 0]);
    expect(calls).toContainEqual(["gte", "last_purchase_at", "2026-10-31T00:00:00.000Z"]);
  });

  it("para quienes nunca compraron filtra por cero compras", () => {
    const { query, calls } = recorder();
    applySegmentFilters(query, { purchase: "never" });
    expect(calls).toContainEqual(["eq", "purchase_count", 0]);
    expect(calls.some((call) => call[0] === "gt")).toBe(false);
  });

  it("describe el segmento en lenguaje claro", () => {
    expect(describeSegment({ purchase: "never", sources: ["Sorteo", "Web"] })).toEqual(["Origen: Sorteo, Web", "Nunca compraron"]);
    expect(describeSegment({})).toEqual([]);
  });

  it("divide en tandas sin perder a nadie", () => {
    expect(splitIntoBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitIntoBatches([], 80)).toEqual([]);
    expect(splitIntoBatches(Array.from({ length: 165 }, (_, index) => index), 82).map((batch) => batch.length)).toEqual([82, 82, 1]);
  });
});
