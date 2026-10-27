import { describe, expect, it } from "vitest";
import { applyDiscount, discountSummary, orderDiscountPercent, parseDiscountPercent } from "./wholesaleDiscount";
import { wholesaleLineValue } from "./wholesaleAdapter";
import { createWholesaleOrderPdf } from "./wholesaleOrderPdf";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";

const line = (patch: Partial<WholesaleLine>): WholesaleLine => ({
  line_id: "line-1", order_id: "#M101", created_at: "2026-10-01T12:00:00Z", completed_at: null,
  customer: "Anahi Berruti", model: "Torpedo", variant: "Negro", quantity: 10, status: "Pendiente",
  order_type: "normal", unit_price_arg: 30000, unit_price_uyu: 810, exchange_rate: 0.027,
  total_arg: 300000, total_uyu: 8100, discount_percent: null, ...patch,
});
const snapshot: WholesaleSnapshot = {
  exchangeRate: 0.027, images: [], categories: [], customers: [], lines: [],
  products: [{ id: "7", model: "Torpedo", variant: "Negro", rim_type: null, leather_type: null, price_arg: 30000, price_uyu: 810, sku: "309" }],
};

describe("descuento de pedidos mayoristas", () => {
  it("aplica el porcentaje y redondea a centavos", () => {
    expect(applyDiscount(1050000, 15)).toBe(892500);
    expect(applyDiscount(100, 0)).toBe(100);
    expect(applyDiscount(100.01, 33.3)).toBe(66.71);
  });

  it("limita el porcentaje a 0-100 y tolera texto inválido", () => {
    expect(parseDiscountPercent("12.5")).toBe(12.5);
    expect(parseDiscountPercent("150")).toBe(100);
    expect(parseDiscountPercent("-5")).toBe(0);
    expect(parseDiscountPercent("")).toBe(0);
    expect(parseDiscountPercent("abc")).toBe(0);
  });

  it("toma el porcentaje del pedido de sus líneas", () => {
    expect(orderDiscountPercent([{ discount_percent: null }, { discount_percent: 10 }])).toBe(10);
    expect(orderDiscountPercent([{}, { discount_percent: null }])).toBe(0);
  });

  it("calcula subtotal, descuento y total", () => {
    expect(discountSummary([{ gross: 300000, net: 270000 }, { gross: 150000, net: 135000 }])).toEqual({ subtotal: 450000, discount: 45000, total: 405000 });
    expect(discountSummary([{ gross: 500, net: 500 }])).toEqual({ subtotal: 500, discount: 0, total: 500 });
  });

  it("expone el importe a precio de lista aunque la línea ya tenga el total descontado", () => {
    const discounted = line({ discount_percent: 10, total_arg: 270000, total_uyu: 7290 });
    expect(wholesaleLineValue(discounted, snapshot.products[0], snapshot.exchangeRate)).toMatchObject({ arg: 270000, uyu: 7290, grossArg: 300000, grossUyu: 8100 });
    expect(wholesaleLineValue(line({ order_type: "no_cost" }), snapshot.products[0], snapshot.exchangeRate)).toMatchObject({ arg: 0, grossArg: 0 });
  });

  it("genera el PDF del cliente con descuento sin romper el armado", async () => {
    const lines = [line({ discount_percent: 10, total_arg: 270000, total_uyu: 7290 })];
    const input = { reference: "#M101", date: "2026-10-01", customerName: "Anahi Berruti", lines, snapshot, currency: "ARS" as const };
    const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const withDiscount = (await createWholesaleOrderPdf("customer", input, logo)).output();
    expect(withDiscount).toContain("Subtotal");
    expect(withDiscount).toContain("Descuento \\(10%\\)");
    expect(withDiscount).toContain("ARS 300.000");
    expect(withDiscount).toContain("ARS 270.000");
    const plain = (await createWholesaleOrderPdf("customer", { ...input, lines: [line({})] }, logo)).output();
    expect(plain).not.toContain("Subtotal");
    const workshop = (await createWholesaleOrderPdf("workshop", input, logo)).output();
    expect(workshop).not.toContain("Subtotal");
  });
});
