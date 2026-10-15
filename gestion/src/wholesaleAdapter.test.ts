import { describe, expect, it } from "vitest";
import { balance, orderName, paid, seed, total } from "./data";
import { adaptWholesale, wholesaleLineValue } from "./wholesaleAdapter";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";

const line = (patch: Partial<WholesaleLine>): WholesaleLine => ({
  line_id: "line-1", order_id: "PED-123456", created_at: "2026-10-01T12:00:00Z", completed_at: null,
  customer: "Almacén Sur", model: "Torpedo", variant: "Negro", quantity: 2, status: "Pendiente",
  order_type: "normal", unit_price_arg: null, unit_price_uyu: null, exchange_rate: null,
  total_arg: null, total_uyu: null, ...patch,
});
const fixture = (): WholesaleSnapshot => ({
  exchangeRate: 0.027,
  products: [{ id: "7", model: "Torpedo", variant: "Negro", rim_type: "Acero", leather_type: "Negro", price_arg: 10000, price_uyu: 270 }],
  customers: [{ full_name: "Almacén Sur", first_name: "Almacén", last_name: "Sur", phone: "", email: "", address: "", notes: "" }],
  lines: [],
});

describe("integración mayorista", () => {
  it("agrega variantes y clientes como registros propios y conserva PED", () => {
    const source = fixture(); source.lines = [line({})];
    const state = adaptWholesale(seed(), source);
    expect(state.products[0].id).toBe("wholesale:7");
    expect(state.products[0].priceArg).toBe(10000);
    expect(state.customers[0].wholesaleName).toBe("Almacén Sur");
    expect(orderName(state.orders[0])).toBe("PED-123456");
    expect(state.records.monedas[0]).toMatchObject({ moneda: "ARS", valor: 0.027 });
  });
  it("agrupa líneas de un pedido y calcula 50/100 por ciento según el estado", () => {
    const source = fixture(); source.lines = [line({}), line({ line_id: "line-2", status: "Completado", completed_at: "2026-10-10T12:00:00Z", unit_price_arg: 8000, unit_price_uyu: 216, total_arg: 16000, total_uyu: 432 })];
    const state = adaptWholesale(seed(), source);
    const order = state.orders[0];
    expect(state.orders).toHaveLength(1);
    expect(order.quantity).toBe(4);
    expect(total(order)).toBe(972);
    expect(paid(state, order)).toBe(702);
    expect(balance(state, order)).toBe(270);
    expect(order.production).toBe("Pendiente");
    expect(state.payments).toHaveLength(3);
    expect(state.payments.every((payment) => payment.derived)).toBe(true);
  });
  it("usa el catálogo para líneas antiguas, cero para las no coincidentes y respeta sin costo", () => {
    const source = fixture(); source.lines = [line({ order_id: null }), line({ line_id: "line-2", order_id: null, model: "Otro", variant: "Sin variante" }), line({ line_id: "line-3", order_id: null, order_type: "no_cost", total_uyu: 100 })];
    const state = adaptWholesale(seed(), source);
    expect(state.orders).toHaveLength(3);
    expect(state.orders.map(total).sort((a, b) => a - b)).toEqual([0, 0, 540]);
    expect(orderName(state.orders.find((order) => total(order) === 540)!)).toBe("Línea line-1");
    expect(wholesaleLineValue(source.lines[2], source.products[0], source.exchangeRate).uyu).toBe(0);
  });
});
