import { describe, expect, it } from "vitest";
import { balance, orderName, paid, seed, total, wholesaleBalanceArs, wholesalePaidArs } from "./data";
import { adaptWholesale, summarizeWholesale, summarizeWholesaleCustomer, wholesaleLineValue } from "./wholesaleAdapter";
import { wholesaleExportRows } from "./wholesaleExports";
import { adaptCommerce } from "./commerceAdapter";
import { commerceFixture } from "./testing/commerce";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";

const line = (patch: Partial<WholesaleLine>): WholesaleLine => ({
  line_id: "line-1", order_id: "#M001", created_at: "2026-10-01T12:00:00Z", completed_at: null,
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
  it("agrega variantes y clientes como registros propios y conserva el código del pedido", () => {
    const source = fixture(); source.lines = [line({})];
    const state = adaptWholesale(seed(), source);
    expect(state.products[0].id).toBe("wholesale:7");
    expect(state.products[0].family).toBe("Mates");
    expect(state.products[0].priceArg).toBe(10000);
    expect(state.customers[0].wholesaleName).toBe("Almacén Sur");
    expect(orderName(state.orders[0])).toBe("#M001");
    expect(state.orders[0].channel).toBe("Mayorista");
    expect(state.customers[0]).toMatchObject({ segment: "Mayorista", originChannel: "WhatsApp" });
    expect(state.records.monedas[0]).toMatchObject({ moneda: "ARS", valor: 0.027 });
  });
  it("una línea genérica toma el primer SKU del producto como referencia y conserva Genérico como variante", () => {
    const source = fixture();
    source.products = [
      { id: "8", model: "Torpedo", variant: "Marrón", rim_type: "Acero", leather_type: "Marrón", price_arg: 10000, price_uyu: 270, category_code: "mates", sku: "210", weight_grams: 90 },
      { id: "7", model: "Torpedo", variant: "Negro", rim_type: "Acero", leather_type: "Negro", price_arg: 10000, price_uyu: 270, category_code: "mates", sku: "209", weight_grams: 80 },
    ];
    source.categories = [{ code: "mates", label_es: "Mates", active: true }];
    source.lines = [line({ variant: "Genérico", quantity: 3, unit_price_arg: 10000, unit_price_uyu: 270, total_arg: 30000, total_uyu: 810 })];
    const item = adaptWholesale(seed(), source).orders[0].items![0];
    expect(item).toMatchObject({ sku: "209", variant: "Genérico", family: "Mates", weightGrams: 80 });
  });
  it("usa el SKU Liso como referencia cuando el nombre histórico omite el diseño", () => {
    const source = fixture();
    source.products = [
      { id: "575", model: "Mate Imperial Fleje Liso Pelos", variant: "Negro", rim_type: null, leather_type: null, price_arg: 43900, price_uyu: 1185, sku: "575" },
      { id: "348", model: "Mate Imperial Fleje Liso Pelos", variant: "Negro/Blanco", rim_type: null, leather_type: null, price_arg: 43900, price_uyu: 1185, sku: "348" },
    ];
    source.lines = [line({ model: "Mate Imperial Fleje con Pelos", variant: "Genérico", quantity: 3, unit_price_arg: 43900, total_arg: 131700 })];
    const item = adaptWholesale(seed(), source).orders[0].items![0];
    expect(item).toMatchObject({ sku: "348", variant: "Genérico", quantity: 3 });
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
  it("agrupa líneas sin inventar cobros a partir del estado de producción", () => {
    const source = fixture(); source.lines = [line({ unit_price_arg: 10000, unit_price_uyu: 270, total_arg: 20000, total_uyu: 540 }), line({ line_id: "line-2", status: "Completado", completed_at: "2026-10-10T12:00:00Z", unit_price_arg: 8000, unit_price_uyu: 216, total_arg: 16000, total_uyu: 432 })];
    const state = adaptWholesale(seed(), source);
    const order = state.orders[0];
    expect(state.orders).toHaveLength(1);
    expect(order.quantity).toBe(4);
    expect(total(order)).toBe(972);
    expect(paid(state, order)).toBe(0);
    expect(balance(state, order)).toBe(972);
    expect(order.production).toBe("Pendiente");
    expect(state.payments).toHaveLength(0);
  });
  it("mantiene un pedido terminado como pendiente de cobro hasta registrar dinero real", () => {
    const source = fixture(); source.lines = [line({ status: "Completado", completed_at: "2026-10-10T12:00:00Z", unit_price_arg: 10000, total_arg: 20000, total_uyu: 540 })];
    const state = adaptWholesale(seed(), source);
    expect(state.orders[0]).toMatchObject({ production: "Terminado", delivery: "Enviado" });
    expect(balance(state, state.orders[0])).toBe(540);
  });
  it("separa el saldo anterior conciliado de los cobros nuevos y usa el total guardado del pedido", () => {
    const source = fixture(); source.lines = [line({ unit_price_arg: 10000, total_arg: 20000, total_uyu: 540 })];
    source.orderRecords = [{ id: "sale-1", reference_code: "#M001", customer_name: "Almacén Sur", total_minor: 52000 }];
    source.paymentOpenings = [{ sale_id: "sale-1", collected_minor: 13500, collected_arg_minor: 500000 }];
    source.receipts = [{ id: "receipt-1", sale_id: "sale-1", amount_minor: 15000, source_amount_minor: 500000, currency: "ARS", payment_method: "Transferencia", paid_on: "2026-10-05" }];
    const state = adaptWholesale(seed(), source);
    const order = state.orders[0];
    expect(total(order)).toBe(540);
    expect(paid(state, order)).toBe(285);
    expect(wholesalePaidArs(state, order)).toBe(10000);
    expect(wholesaleBalanceArs(state, order)).toBe(10000);
    expect(balance(state, order)).toBe(270);
    expect(state.payments).toMatchObject([{ orderId: order.id, amount: 150, sourceCurrency: "ARS", sourceAmount: 5000 }]);
  });
  it("usa el precio ARS descontado y el equivalente UYU neto, no el total UYU de lista", () => {
    const source = fixture();
    source.lines = [line({ unit_price_arg: 10000, unit_price_uyu: 270, total_arg: 18000, total_uyu: 486, discount_percent: 10 })];
    source.orderRecords = [{ id: "sale-1", reference_code: "#M001", customer_name: "Almacén Sur", total_minor: 54000 }];
    source.paymentOpenings = [{ sale_id: "sale-1", collected_minor: 0, collected_arg_minor: 0 }];
    const state = adaptWholesale(seed(), source);
    expect(state.orders[0].wholesaleTotalArg).toBe(18000);
    expect(total(state.orders[0])).toBe(486);
    expect(wholesaleBalanceArs(state, state.orders[0])).toBe(18000);
    expect(balance(state, state.orders[0])).toBe(486);
    const [exported] = wholesaleExportRows(source.lines, source);
    expect(exported["Total ARS"]).toBe(18000);
    expect(exported).not.toHaveProperty("Total UYU");
    expect(wholesaleExportRows([line({ status: "Completado" })], source)[0].Estado).toBe("Terminado");
  });
  it("no convierte en deuda exacta un pedido anterior todavía sin conciliar", () => {
    const source = fixture(); source.lines = [line({})];
    source.orderRecords = [{ id: "sale-1", reference_code: "#M001", customer_name: "Almacén Sur", total_minor: 52000 }];
    source.paymentOpenings = [{ sale_id: "sale-1", collected_minor: null }];
    const state = adaptWholesale(seed(), source);
    expect(state.orders[0].wholesaleOpeningPaid).toBeNull();
    expect(balance(state, state.orders[0])).toBe(0);
    expect(wholesaleExportRows(source.lines, source)[0]["Total ARS"]).toBe("Por conciliar");
    source.paymentOpenings![0].paid_in_full_without_price = true;
    const settled = adaptWholesale(seed(), source);
    expect(wholesaleBalanceArs(settled, settled.orders[0])).toBe(0);
    expect(settled.orders[0].wholesaleTotalArg).toBeNull();
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
    expect(summary).toMatchObject({ activeUnits: 5, pendingUnits: 2, inProductionUnits: 3, activeCustomers: 2, activeValueArg: 27000, activeValueUyu: 0 });
    expect(summary.clientStats).toEqual([["Bazar Norte", 3], ["Almacén Sur", 2]]);
  });
  it("agrupa el histórico terminado del cliente por tipo de mate", () => {
    const source = fixture();
    source.lines = [
      line({ status: "Completado", completed_at: "2026-10-10T12:00:00Z" }),
      line({ line_id: "line-2", status: "Completado", completed_at: "2026-10-11T12:00:00Z", variant: "Marrón", quantity: 3 }),
      line({ line_id: "line-3", order_id: "#M099", status: "Pendiente", quantity: 4 }),
    ];
    const state = adaptWholesale(seed(), source);
    const history = summarizeWholesaleCustomer(state.orders, "wholesale:Almacén Sur");
    expect(history.rows).toEqual([{ id: "torpedo", model: "Torpedo", orders: 1, units: 5 }]);
    expect(history).toMatchObject({ currentOrders: 1, totalOrders: 1, totalUnits: 5, latestPurchase: "2026-10-01" });
  });
});
