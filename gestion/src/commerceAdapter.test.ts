import { describe, expect, it } from "vitest";
import { adaptCommerce, commerceDate } from "./commerceAdapter";
import { commerceFixture } from "./testing/commerce";
import { total, balance, orderName } from "./data";
import { overviewScope } from "./overview";
import { buildFinanceProjection } from "./financeProjection";
import { buildRevenueForecast } from "./revenueForecast";
import { readAllPages } from "./useCommerce";

describe("integración de commerce en el estado compartido", () => {
  it("incluye cobros USD con su equivalencia histórica sin usar la cotización actual", () => {
    const fixture = commerceFixture();
    fixture.orders[0].paypal_amount_usd_minor = 10000;
    fixture.payments[0] = { ...fixture.payments[0], currency: "USD", amount_minor: 10000, provider: "paypal" };
    const state = adaptCommerce(fixture);
    expect(state.payments[0]).toMatchObject({ amount: 4101, sourceCurrency: "USD", sourceAmount: 100, reconciliationRequired: false });
    expect(state.orders[0].paymentAmountUsd).toBe(100);
    expect(buildFinanceProjection(state, { asOf: state.payments[0].date })[0].actualIncome).toBe(4101);
  });
  it("conserva un cobro sin cotización histórica y señala la conciliación", () => {
    const fixture = commerceFixture();
    fixture.payments[0] = { ...fixture.payments[0], currency: "USD", amount_minor: 10000, provider: "paypal" };
    const state = adaptCommerce(fixture);
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0]).toMatchObject({ amount: null, sourceCurrency: "USD", sourceAmount: 100, reconciliationRequired: true });
  });
  it("convierte importes distintos con la relación histórica y pide conciliarlos", () => {
    const fixture = commerceFixture();
    fixture.orders[0].paypal_amount_usd_minor = 10000;
    fixture.payments[0] = { ...fixture.payments[0], currency: "USD", amount_minor: 5000, provider: "paypal" };
    expect(adaptCommerce(fixture).payments[0]).toMatchObject({ amount: 2050.5, sourceAmount: 50, reconciliationRequired: true });
  });
  it("incluye cuentas y suscriptores Web sin compras, sin duplicarlos por correo", () => {
    const fixture = commerceFixture();
    fixture.orders = [];
    fixture.customerProfiles = [{ user_id: "user-1", birth_date: null, city: "Paysandú", country_code: "UY", address_line1: "Artigas 100", department: "Paysandú", postal_code: "60000" }];
    fixture.webLeads = [
      { source_kind: "newsletter", source_id: "lead-1", full_name: "Ana", email: "ana@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-01T12:00:00Z" },
      { source_kind: "account", source_id: "user-1", full_name: "Ana Pérez", email: "ana@example.com", phone: "099123456", city: "Paysandú", country_code: "UY", birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-02T12:00:00Z" },
    ];
    const state = adaptCommerce(fixture);
    expect(state.customers).toHaveLength(1);
    expect(state.customers[0]).toMatchObject({ originChannel: "Web", webLeadKind: "account", webLeadId: "user-1", phone: "099123456", address: "Artigas 100", postalCode: "60000" });
  });
  it("mantiene el canal Local aunque la variante esté oculta en la web", () => {
    const fixture = commerceFixture();
    fixture.products[0].commerce_variants[0].active = false;
    fixture.products[0].commerce_variants[0].available_local = true;
    fixture.products[0].commerce_variants[0].available_web = true;
    const product = adaptCommerce(fixture).products.find((item) => item.sku === "SKU-1")!;
    expect(product.active).toBe(false);
    expect(product.availableChannels).toContain("Local");
    expect(product.availableChannels).not.toContain("Web");
  });
  it("conserva el origen de la suscripción con descuento cuando la cuenta ya existía", () => {
    const fixture = commerceFixture();
    fixture.orders = [];
    fixture.webLeads = [
      { source_kind: "account", source_id: "user-1", full_name: "Ana Pérez", email: "ana@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-01T12:00:00Z" },
      { source_kind: "newsletter", source_id: "lead-1", full_name: "Ana", email: "ana@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Suscripción con desc.", customer_type: "Minorista", created_at: "2026-10-02T12:00:00Z" },
    ];
    const state = adaptCommerce(fixture);
    expect(state.customers).toHaveLength(1);
    expect(state.customers[0].originChannel).toBe("Suscripción con desc.");
    expect(state.customers[0].name).toBe("Ana Pérez");
  });
  it("usa el nombre de la suscripción si la cuenta web solo tenía el correo", () => {
    const fixture = commerceFixture();
    fixture.orders = [];
    fixture.webLeads = [
      { source_kind: "account", source_id: "user-1", full_name: null, email: "persona@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-24T00:47:01Z" },
      { source_kind: "newsletter", source_id: "lead-1", full_name: "Nombre Apellido", email: "persona@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Suscripción con desc.", customer_type: "Minorista", created_at: "2026-10-24T00:47:02Z" },
    ];
    const state = adaptCommerce(fixture);
    expect(state.customers).toHaveLength(1);
    expect(state.customers[0]).toMatchObject({ name: "Nombre Apellido", email: "persona@example.com", originChannel: "Suscripción con desc." });
  });
  it("mantiene Agenda como primer origen cuando el contacto compra después", () => {
    const fixture = commerceFixture();
    fixture.localCustomers = [{ id: "agenda-1", full_name: "Contacto antiguo", email: "old@example.com", phone: "099123456", city: null, country: null, birth_date: null, first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "", agenda_import_key: "legacy-1", origin_channel: "Agenda" }];
    const state = adaptCommerce(fixture);
    expect(state.customers.find((customer) => customer.localCustomerId === "agenda-1")?.originChannel).toBe("Agenda");
  });
  it("muestra referencias nuevas por canal y conserva los números anteriores", () => {
    const fixture = commerceFixture();
    expect(orderName(adaptCommerce(fixture).orders[0])).toBe("#9001");
    fixture.orders[0].reference_code = "#W001";
    expect(orderName(adaptCommerce(fixture).orders[0])).toBe("#W001");
    fixture.orders[0].customer_snapshot.purchaseFlow = "wholesale_bank_transfer";
    fixture.orders[0].reference_code = "#M001";
    expect(orderName(adaptCommerce(fixture).orders[0])).toBe("#M001");
    expect(adaptCommerce(fixture).orders[0].channel).toBe("Mayorista");
    expect(adaptCommerce(fixture).customers[0].segment).toBe("Mayorista");
    fixture.localSales = [{ id: "social-1", sale_number: 20, reference_code: "#R001", channel: "Instagram", customer_id: null, customer_name: "Cliente", sold_on: "2026-10-14", payment_method: "Efectivo", total_minor: 10000, currency: "UYU", created_at: "2026-10-14T12:00:00Z", local_sale_items: [] }];
    const social = adaptCommerce(fixture).orders.find((order) => order.id === "social-1")!;
    expect(social.channel).toBe("Instagram");
    expect(orderName(social)).toBe("#R001");
  });
  it("mantiene todos los artículos, importes y relaciones de un pedido", () => {
    const state = adaptCommerce(commerceFixture()); const order = state.orders[0];
    expect(order.items).toHaveLength(2); expect(order.quantity).toBe(3);
    expect(total(order)).toBe(4101); expect(order.items![0].unitPrice).toBe(1000.5);
    expect(order.items!.reduce((sum, item) => sum + item.amount, 0) - order.discountAmount! + order.shippingAmount! + order.feeAmount!).toBe(total(order));
    expect(balance(state, order)).toBe(0); expect(state.payments[0].orderId).toBe(order.id);
    expect(state.customers[0].id).toBe(order.customerId); expect(order.production).toBe("Pendiente");
    expect(overviewScope(state, "14d", "2026-10-13").orders.reduce((sum, order) => sum + order.quantity, 0)).toBe(3);
  });
  it("interpreta un pedido web enviado como producción terminada aunque sus artículos conserven un estado viejo", () => {
    const fixture = commerceFixture();
    fixture.orders[0].status = "shipped";
    const order = adaptCommerce(fixture).orders[0];
    expect(order).toMatchObject({ production: "Terminado", delivery: "Enviado" });
    expect(order.items?.every((item) => item.productionStatus === "completed")).toBe(true);
  });
  it("clasifica un diseño web sin variante de catálogo como Personalizados", () => {
    const fixture = commerceFixture();
    fixture.orders[0].order_items = [{
      ...fixture.orders[0].order_items[0],
      id: "design-1", item_type: "design", source_variant_id: null, title: "Mate Camionero personalizado",
    }];
    const item = adaptCommerce(fixture).orders[0].items?.[0];
    expect(item).toMatchObject({ family: "Personalizados", orderType: "design" });
  });
  it("usa el precio publicado en Local y conserva el precio base original", () => {
    const fixture = commerceFixture();
    fixture.products[0].commerce_variants[0].base_price_minor = 88000;
    const state = adaptCommerce(fixture);
    expect(state.products[0].availableChannels).toEqual(["Local", "Web"]);
    expect(state.products[0].prices.Local).toBe(1000.5);
    expect(state.products[0].prices.Web).toBe(1000.5);
    expect(state.products[0].basePrice).toBe(880);
    expect(state.expenses).toEqual([]); expect(state.hours).toEqual([]); expect(state.draft).toEqual({});
    expect(state.records["marketing/descuentos"][0].valor).toBe(150);
    expect(buildRevenueForecast(state, { asOf: "2026-10-13" }).months).toEqual([]);
    expect(buildFinanceProjection(state, { asOf: "2026-10-13" }).slice(1).every((month) => month.estimatedIncome === 0)).toBe(true);
  });
  it("clasifica y filtra productos con el código real de categoría", () => {
    const fixture = commerceFixture();
    fixture.products[0].category = "categoría-legada";
    fixture.products[0].category_code = "mates";
    const [product] = adaptCommerce(fixture).products;
    expect(product.categoryCode).toBe("mates");
    expect(product.family).toBe("Mates");
  });
  it("calcula el precio mayorista desde el precio base para las categorías seleccionadas", () => {
    const fixture = commerceFixture();
    fixture.reference.settings.wholesale_mate_discount_enabled = true;
    fixture.reference.settings.wholesale_mate_quantity_threshold = 30;
    fixture.reference.settings.wholesale_mate_discount_percent = 30;
    fixture.products[0].commerce_variants[0].base_price_minor = 88000;
    const [mate] = adaptCommerce(fixture).products;
    expect(mate.prices.Local).toBe(1000.5);
    expect(mate.basePrice).toBe(880);
    expect(mate.prices.Web).toBe(1000.5);
    expect(mate.prices.Mayorista).toBe(616);
    expect(mate.wholesaleThreshold).toBe(30);
    fixture.products[0].category = "bombillas";
    expect(adaptCommerce(fixture).products[0].availableChannels).toEqual(["Local", "Web"]);
    fixture.reference.settings.wholesale_discount_categories = ["mates", "bombillas"];
    expect(adaptCommerce(fixture).products[0].prices.Mayorista).toBe(616);
    expect(adaptCommerce(fixture).products[0].availableChannels).toEqual(["Local", "Web"]);
  });
  it("descuenta también el artículo mayorista migrado y conserva su precio ARS", () => {
    const fixture = commerceFixture();
    fixture.reference.settings.wholesale_mate_discount_enabled = true;
    fixture.reference.settings.wholesale_mate_discount_percent = 30;
    Object.assign(fixture.products[0].commerce_variants[0], {
      legacy_product_id: "45", wholesale_price_arg: 10500,
      available_local: false, available_web: false, available_wholesale: true,
    });
    const [product] = adaptCommerce(fixture).products;
    expect(product.priceArg).toBe(10500);
    expect(product.prices.Mayorista).toBe(700.35);
    expect(product.availableChannels).toEqual(["Mayorista"]);
    fixture.products[0].category_code = "materas";
    expect(adaptCommerce(fixture).products[0].prices.Mayorista).toBe(1000.5);
  });
  it("elige la imagen vinculada a cada variante y evita mostrar la foto de otro color", () => {
    const fixture = commerceFixture();
    fixture.products[0].commerce_variants[0].option_values = {color:"negro"};
    fixture.products[0].commerce_variants[1].option_values = {color:"blanco"};
    fixture.products[0].commerce_product_images = [
      {id:"general",storage_path:"general.png",alt_text:"",sort_order:0,variant_id:null,option_values:{}},
      {id:"negra",storage_path:"negra.png",alt_text:"",sort_order:1,variant_id:null,option_values:{color:"negro",cover_zoom:1.3}},
      {id:"blanca",storage_path:"blanca.png",alt_text:"",sort_order:2,variant_id:"variant-2",option_values:{}},
    ];
    const products = adaptCommerce(fixture,path=>`/${path}`).products;
    expect(products.map(product=>product.imageUrl)).toEqual(["/negra.png","/blanca.png"]);
    expect(products[0].imageCrop?.zoom).toBe(1.3);
    fixture.products[0].commerce_product_images = fixture.products[0].commerce_product_images.filter(image=>image.id!=="blanca");
    expect(adaptCommerce(fixture,path=>`/${path}`).products[1].imageUrl).toBe("/general.png");
    fixture.products[0].commerce_product_images = fixture.products[0].commerce_product_images.filter(image=>image.id!=="general");
    expect(adaptCommerce(fixture).products[1].imageUrl).toBeUndefined();
  });
  it("consolida pedidos del mismo cliente y excluye cancelados de ventas", () => {
    const fixture = commerceFixture();
    fixture.orders.push({ ...fixture.orders[0], id: "order-2", order_number: 9002, status: "cancelled", paid_at: null });
    const state = adaptCommerce(fixture);
    expect(state.customers).toHaveLength(1); expect(state.orders).toHaveLength(2);
    expect(overviewScope(state, "14d", "2026-10-13").orders).toHaveLength(1);
    expect(balance(state, state.orders[1])).toBe(0);
  });
  it("incorpora ventas y clientes del local sin duplicar los clientes web", () => {
    const fixture = commerceFixture();
    fixture.localCustomers = [
      { id: "local-1", full_name: "Cliente de prueba", email: "TEST@example.invalid", phone: "099111222", city: "Paysandú", country: "Uruguay", birth_date: "1993-04-05", first_purchase_date: "2026-10-10", last_purchase_date: "2026-10-13", source_user_id: null, notes: "Prefiere retiro" },
      { id: "local-2", full_name: "Cliente solo local", email: null, phone: "099333444", city: "Paysandú", country: "Uruguay", birth_date: null, first_purchase_date: "2026-10-13", last_purchase_date: "2026-10-13", source_user_id: null, notes: "" },
    ];
    fixture.localSales = [
      { id: "sale-1", sale_number: 19, customer_id: "local-1", customer_name: "Cliente de prueba", sold_on: "2026-10-13", payment_method: "Transferencia", total_minor: 410000, currency: "UYU", created_at: "2026-10-13T14:00:00Z", local_sale_items: [
        { id: "local-item-1", variant_id: "variant-1", sku: "SKU-1", product_name: "Mate de catálogo", variant_name: "Cuero negro", quantity: 1, unit_price_minor: 4100000, line_total_minor: 4100000 },
      ] },
      { id: "sale-2", sale_number: 20, customer_id: "local-2", customer_name: "Cliente solo local", sold_on: "2026-10-13", payment_method: "Seña", total_minor: 10000, currency: "UYU", created_at: "2026-10-13T15:00:00Z", local_sale_items: [
        { id: "local-item-2", variant_id: "variant-2", sku: "SKU-2", product_name: "Mate de catálogo", variant_name: "Cuero marrón", quantity: 2, unit_price_minor: 50000, line_total_minor: 100000 },
      ] },
    ];
    const state = adaptCommerce(fixture);
    expect(state.customers).toHaveLength(2);
    expect(state.customers.find(customer => customer.id === "customer-1")).toMatchObject({ localCustomerId: "local-1", phone: "099111222", notes: "Prefiere retiro" });
    expect(state.customers.find(customer => customer.id === "customer-1")?.originChannel).toBe("Web");
    expect(state.orders.filter(order => order.channel === "Local")).toHaveLength(2);
    const regular = state.orders.find(order => order.id === "sale-1")!;
    expect(regular.customerId).toBe("customer-1");
    expect(total(regular)).toBe(4100);
    expect(balance(state, regular)).toBe(0);
    expect(regular.localItemsAmount).toBe(41000);
    const deposit = state.orders.find(order => order.id === "sale-2")!;
    expect(deposit.customerId).toBe("local:local-2");
    expect(total(deposit)).toBe(1000);
    expect(balance(state, deposit)).toBe(900);
    expect(state.payments.find(payment => payment.orderId === deposit.id)?.amount).toBe(100);
    expect(overviewScope(state, "14d", "2026-10-13").orders.reduce((sum, order) => sum + order.quantity, 0)).toBe(6);
  });
  it("conserva el medio de pago y el saldo cuando una venta tiene seña", () => {
    const fixture = commerceFixture();
    fixture.localSales = [{
      id: "sale-debit-deposit", sale_number: 21, customer_id: null, customer_name: "Cliente",
      sold_on: "2026-10-13", payment_method: "Débito", total_minor: 25000, deposit_minor: 25000,
      currency: "UYU", created_at: "2026-10-13T15:00:00Z", local_sale_items: [{
        id: "local-debit-item", variant_id: "variant-1", sku: "SKU-1", product_name: "Mate de catálogo",
        variant_name: "Cuero negro", quantity: 1, unit_price_minor: 110050, line_total_minor: 110050,
      }],
    }];
    const state = adaptCommerce(fixture);
    const sale = state.orders.find(order => order.id === "sale-debit-deposit")!;
    expect(sale.paymentMethod).toBe("Débito");
    expect(sale.depositAmount).toBe(250);
    expect(total(sale)).toBe(1100.5);
    expect(balance(state, sale)).toBe(850.5);
    expect(state.payments.find(payment => payment.orderId === sale.id)?.amount).toBe(250);
  });
  it("separa la seña del cobro posterior sin duplicar la venta en el flujo de caja", () => {
    const fixture = commerceFixture();
    fixture.localSales = [{
      id: "sale-36", sale_number: 36, customer_id: null, customer_name: "Cliente",
      sold_on: "2026-10-24", payment_method: "Transferencia", total_minor: 200000, deposit_minor: 200000,
      currency: "UYU", created_at: "2026-10-24T12:00:00Z", local_sale_items: [{
        id: "item-36", variant_id: "variant-1", sku: "SKU-1", product_name: "Cartera Matera",
        variant_name: "Negro/Blanco", quantity: 1, unit_price_minor: 450000, line_total_minor: 450000,
      }],
    }];
    fixture.localReceipts = [{ id: "receipt-36", sale_id: "sale-36", amount_minor: 250000,
      payment_method: "Efectivo", paid_on: "2026-11-02", created_at: "2026-11-02T12:00:00Z" }];
    const state = adaptCommerce(fixture);
    const sale = state.orders.find(order => order.id === "sale-36")!;
    expect(total(sale)).toBe(4500);
    expect(state.orders.filter(order => order.id === "sale-36")).toHaveLength(1);
    expect(state.payments.filter(payment => payment.orderId === sale.id).map(payment => payment.amount)).toEqual([2000, 2500]);
    expect(balance(state, sale)).toBe(0);
    const months = buildFinanceProjection(state, { asOf: "2026-10-24" });
    expect(months[0].actualIncome - buildFinanceProjection(adaptCommerce({ ...fixture, localSales: [], localReceipts: [] }), { asOf: "2026-10-24" })[0].actualIncome).toBe(2000);
    expect(months[1].actualIncome - buildFinanceProjection(adaptCommerce({ ...fixture, localSales: [], localReceipts: [] }), { asOf: "2026-10-24" })[1].actualIncome).toBe(2500);
  });
  it("incorpora participantes del sorteo a clientes con su canal e interés", () => {
    const fixture = commerceFixture();
    fixture.ruralRaffleEntries = [{ id: "raffle-1", full_name: "Ana Pérez", email: "sorteo@example.com", phone: "+59899123456", city: "Paysandú", country: "Uruguay", birth_date: "1995-04-12", product_interest: "carteras", created_at: "2026-10-15T12:00:00Z" }];
    const raffleCustomer = adaptCommerce(fixture).customers.find((customer) => customer.raffleEntryId === "raffle-1");
    expect(raffleCustomer).toMatchObject({
      name: "Ana Pérez",
      email: "sorteo@example.com",
      phone: "+59899123456",
      city: "Paysandú",
      country: "Uruguay",
      birthDate: "1995-04-12",
      raffleProductInterest: "carteras",
      sourceChannels: ["Sorteo"],
      notes: "Interés del sorteo: Carteras",
    });
  });
  it("incorpora la agenda sin inventar pedidos y conserva otros celulares", () => {
    const fixture = commerceFixture();
    fixture.localCustomers = [{ id: "agenda-1", full_name: "Ana Imperial", company_name: "Panz", email: null, phone: "+59899123456", city: null, country: "Uruguay", birth_date: null, first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "", agenda_import_key: "key", agenda_additional_phones: ["+59899234567"], agenda_inferred_category: "Mates" }];
    const state = adaptCommerce(fixture);
    const contact = state.customers.find((entry) => entry.localCustomerId === "agenda-1")!;
    expect(contact).toMatchObject({ companyName: "Panz", sourceChannels: ["Agenda"], agendaInferredCategory: "Mates", agendaAdditionalPhones: ["+59899234567"], lastPurchaseDate: "" });
    expect(state.orders.some((order) => order.customerId === contact.id)).toBe(false);
  });
  it("muestra cumpleaños real asociado sin inventar fechas para los demás", () => {
    const fixture = commerceFixture();
    fixture.customerBirthdays = [{ source_user_id: "customer-1", email: "test@example.invalid", birth_date: "1993-04-05" }];
    const customer = adaptCommerce(fixture).customers[0];
    expect(customer.birthDate).toBe("1993-04-05");
    fixture.customerBirthdays = [];
    expect(adaptCommerce(fixture).customers[0].birthDate).toBe("");
    fixture.customerProfiles = [{ user_id: "customer-1", birth_date: "1990-01-02", city: "Montevideo", country_code: "UY" }];
    expect(adaptCommerce(fixture).customers[0].birthDate).toBe("1990-01-02");
  });
  it("usa el origen calculado en la base, el mismo que ve Marketing", () => {
    const fixture = commerceFixture();
    const before = adaptCommerce(fixture).customers[0];
    expect(before.originChannel).toBe("Web");
    fixture.contactOrigins = [{ contact_key: `email:${before.email.toLowerCase()}`, origin: "Agenda" }];
    expect(adaptCommerce(fixture).customers[0].originChannel).toBe("Agenda");
  });
  it("conserva la primera alta real aunque una ficha local vinculada se haya creado después", () => {
    const fixture = commerceFixture();
    fixture.orders[0].created_at = "2026-10-24T18:23:04Z";
    fixture.webLeads = [{ source_kind: "account", source_id: "customer-1", full_name: "Cliente de prueba", email: "test@example.invalid", phone: "099000000", city: null, country_code: "UY", birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-24T16:15:00Z" }];
    fixture.localCustomers = [{ id: "linked-local", full_name: "Cliente de prueba", email: "test@example.invalid", phone: "099000000", city: null, country: "Uruguay", birth_date: null, first_purchase_date: null, last_purchase_date: null, source_user_id: "customer-1", linked_customer_id: "customer-1", notes: "", origin_channel: "Local", created_at: "2026-10-24T17:15:24Z" }];
    fixture.contactFirstSeen = [{ contact_key: "email:test@example.invalid", first_seen_at: "2026-10-24T16:14:43Z" }];
    expect(adaptCommerce(fixture).customers.find((entry) => entry.id === "customer-1")?.createdAt).toBe("2026-10-24T16:14:43Z");
    fixture.contactFirstSeen = [];
    expect(adaptCommerce(fixture).customers.find((entry) => entry.id === "customer-1")?.createdAt).toBe("2026-10-24T16:15:00Z");
  });
  it("respeta paid_at sin fabricar una transacción de pago", () => {
    const fixture = commerceFixture(); fixture.payments = [];
    const state = adaptCommerce(fixture);
    expect(state.payments).toEqual([]); expect(balance(state, state.orders[0])).toBe(0);
  });
  it("no suma monedas distintas como si fueran pesos", () => {
    const fixture = commerceFixture(); fixture.orders[0].currency = "USD";
    expect(() => adaptCommerce(fixture)).toThrow("conversión");
  });
  it("interpreta fechas en Uruguay", () => expect(commerceDate("2026-10-13T01:00:00Z")).toBe("2026-10-12"));
  it("lee todas las páginas y detecta lecturas incompletas", async () => {
    expect(await readAllPages(async (page) => ({ rows: page < 2 ? [page] : [], count: 2 }))).toEqual([0, 1]);
    await expect(readAllPages(async () => ({ rows: [], count: 1 }))).rejects.toThrow("incompleta");
  });
});
