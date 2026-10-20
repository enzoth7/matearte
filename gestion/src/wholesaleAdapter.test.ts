import { describe, expect, it } from "vitest";
import { balance, orderName, paid, seed, total } from "./data";
import { adaptWholesale, summarizeWholesale, summarizeWholesaleCustomer, wholesaleLineValue } from "./wholesaleAdapter";
import { adaptCommerce } from "./commerceAdapter";
import { commerceFixture } from "./testing/commerce";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";

const line = (patch: Partial<WholesaleLine>): WholesaleLine => ({
  line_id: "line-1", order_id: "PED-123456", created_at: "2026-10-01T12:00:00Z", completed_at: null,
  customer: "Almacén Sur", model: "Torpedo", variant: "Negro", quantity: 2, status: "Pendiente",
  order_type: "normal", unit_price_arg: null, unit_price_uyu: null, exchange_rate: null,
  total_arg: null, total_uyu: null, ...patch,
});
const fixture = (): WholesaleSnapshot => ({
  exchangeRate: 0.027,
  images: [], categories: [],
  products: [{ id: "7", model: "Torpedo", variant: "Negro", rim_type: "Acero", leather_type: "Negro", price_arg: 10000, price_uyu: 270 }],
  customers: [{ full_name: "Almacén Sur", first_name: "Almacén", last_name: "Sur", phone: "", email: "", address: "", notes: "" }],
  lines: [],
});

describe("integración mayorista", () => {
  it("mantiene una sola ficha para el mayorista vinculado a una venta local, aunque no tenga correo", () => {
    const commerce = commerceFixture();
    commerce.localCustomers = [{ id: "local-wholesale", linked_customer_id: "wholesale:Almacén Sur", full_name: "Almacén Sur", email: null, phone: null, city: null, country: null, birth_date: null, first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "" }];
    commerce.localSales = [{ id: "sale-wholesale", sale_number: 99, customer_id: "local-wholesale", customer_name: "Almacén Sur", sold_on: "2026-10-16", payment_method: "Efectivo", total_minor: 0, currency: "UYU", created_at: "2026-10-16T12:00:00Z", local_sale_items: [] }];
    const state = adaptWholesale(adaptCommerce(commerce), fixture());
    expect(state.customers.filter((customer) => customer.id === "wholesale:Almacén Sur")).toHaveLength(1);
    expect(state.customers.find((customer) => customer.id === "wholesale:Almacén Sur")).toMatchObject({ localCustomerId: "local-wholesale", wholesaleName: "Almacén Sur" });
    expect(state.orders.find((order) => order.id === "sale-wholesale")?.customerId).toBe("wholesale:Almacén Sur");
  });
  it("muestra el nombre normalizado sin cambiar la clave histórica mayorista", () => {
    const source = fixture();
    source.customers[0].full_name = "JOAO";
    source.lines = [line({ customer: "JOAO" })];
    const state = adaptWholesale(seed(), source);
    expect(state.customers[0]).toMatchObject({ id: "wholesale:JOAO", wholesaleName: "JOAO", name: "Joao" });
    expect(state.orders[0].customerId).toBe("wholesale:JOAO");
  });
  it("agrega variantes y clientes como registros propios y conserva PED", () => {
    const source = fixture(); source.lines = [line({})];
    const state = adaptWholesale(seed(), source);
    expect(state.products[0].id).toBe("wholesale:7");
    expect(state.products[0].family).toBe("Mates");
    expect(state.products[0].priceArg).toBe(10000);
    expect(state.customers[0].wholesaleName).toBe("Almacén Sur");
    expect(orderName(state.orders[0])).toBe("PED-123456");
    expect(state.orders[0].channel).toBe("WhatsApp");
    expect(state.customers[0]).toMatchObject({ segment: "Mayorista", originChannel: "WhatsApp" });
    expect(state.records.monedas[0]).toMatchObject({ moneda: "ARS", valor: 0.027 });
  });
  it("muestra la foto principal y el encuadre de una variante mayorista en el catálogo", () => {
    const source = fixture();
    source.products[0].category_code = "mates";
    source.products[0].sku = "CRI-NEG";
    source.categories = [{ code: "mates", label_es: "Mates", active: true }];
    source.images = [
      { id: "second", product_id: "7", storage_path: "wholesale/7/second.jpg", original_name: "second.jpg", alt_text: "", mime_type: "image/jpeg", byte_size: 100, sort_order: 2, option_values: {} },
      { id: "first", product_id: "7", storage_path: "wholesale/7/first.jpg", original_name: "first.jpg", alt_text: "", mime_type: "image/jpeg", byte_size: 100, sort_order: 1, option_values: { cover_x: 12, cover_y: -4, cover_zoom: 1.2 } },
    ];
    const [product] = adaptWholesale(seed(), source, path => `https://example.invalid/${path}`).products;
    expect(product).toMatchObject({ sku: "CRI-NEG", family: "Mates", imageUrl: "https://example.invalid/wholesale/7/first.jpg", imageCrop: { x: 12, y: -4, zoom: 1.2 } });
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
  it("resume valores, estados y clientes de las líneas activas", () => {
    const source = fixture();
    source.lines = [
      line({}),
      line({ line_id: "line-2", customer: "Bazar Norte", quantity: 3, status: "En producción", unit_price_arg: 9000, unit_price_uyu: 243, total_arg: 27000, total_uyu: 729 }),
      line({ line_id: "line-3", status: "Completado", quantity: 9 }),
    ];
    const summary = summarizeWholesale(source);
    expect(summary).toMatchObject({ activeUnits: 5, pendingUnits: 2, inProductionUnits: 3, activeCustomers: 2, activeValueArg: 47000, activeValueUyu: 1269 });
    expect(summary.clientStats).toEqual([["Bazar Norte", 3], ["Almacén Sur", 2]]);
  });
  it("agrupa el histórico terminado del cliente por tipo de mate", () => {
    const source = fixture();
    source.lines = [
      line({ status: "Completado", completed_at: "2026-10-10T12:00:00Z" }),
      line({ line_id: "line-2", status: "Completado", completed_at: "2026-10-11T12:00:00Z", variant: "Marrón", quantity: 3 }),
      line({ line_id: "line-3", order_id: "PED-999999", status: "Pendiente", quantity: 4 }),
    ];
    const state = adaptWholesale(seed(), source);
    const history = summarizeWholesaleCustomer(state.orders, "wholesale:Almacén Sur");
    expect(history.rows).toEqual([{ id: "torpedo", model: "Torpedo", orders: 1, units: 5 }]);
    expect(history).toMatchObject({ currentOrders: 1, totalOrders: 1, totalUnits: 5, latestPurchase: "2026-10-01" });
  });
});
