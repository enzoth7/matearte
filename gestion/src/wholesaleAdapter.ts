import { buildSearchText, commerceDate } from "./commerceAdapter";
import { GENERIC_WHOLESALE_VARIANT, firstWholesaleReferenceVariant } from "./wholesaleSaleSelection";
import type { Customer, Order, OrderLine, Payment, Product, State } from "./data";
import { wholesaleProductImageUrl, type WholesaleLine, type WholesaleProduct, type WholesaleSnapshot } from "./wholesaleSource";
import { formatContactName } from "../../shared/contactName";
import { canonicalCategoryCode, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { countryDisplayName } from "./location";
import { naturalCaseName } from "./productionPresentation";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const productKey = (model: string, variant: string) => `${normalized(model)}\u0000${normalized(variant)}`;
const number = (value: number | null | undefined) => value == null ? null : Number(value);
const mateModels = new Set(["imperial", "camionero", "criollo", "torpedo"]);
const isMateModel = (model: string) => normalized(model).split(/\s+/).some((part) => mateModels.has(part));
const wholesaleCategory = (product: WholesaleProduct, snapshot: WholesaleSnapshot) => {
  const categoryCode = canonicalCategoryCode(product.category_code || "");
  return snapshot.categories.find((category) => category.code === categoryCode)?.label_es
    || defaultCatalogTaxonomy.categories.find((category) => category.code === categoryCode)?.label_es
    || (isMateModel(product.model) ? "Mates" : "Sin categoría");
};

export function wholesaleLineValue(line: WholesaleLine, product: WholesaleProduct | undefined, rate: number) {
  if (line.order_type === "no_cost") return { arg: 0, uyu: 0, unitArg: 0, unitUyu: 0, grossArg: 0, grossUyu: 0 };
  const quantity = Number(line.quantity) || 0;
  const unitArg = number(line.unit_price_arg) ?? Number(product?.price_arg || 0);
  const arg = number(line.total_arg) ?? unitArg * quantity;
  const unitUyu = number(line.unit_price_uyu) ?? Number(product?.price_uyu ?? unitArg * (number(line.exchange_rate) ?? rate));
  const uyu = number(line.total_uyu) ?? (line.unit_price_uyu != null ? unitUyu * quantity : line.total_arg != null ? arg * (number(line.exchange_rate) ?? rate) : unitUyu * quantity);
  // gross: importe a precio de lista, antes del descuento del pedido.
  return { arg, uyu, unitArg, unitUyu, grossArg: unitArg * quantity, grossUyu: unitUyu * quantity };
}
export const hasWholesaleOriginalArs = (line: WholesaleLine) => line.order_type === "no_cost" || line.total_arg != null && Number.isFinite(Number(line.total_arg));

export function summarizeWholesale(snapshot: WholesaleSnapshot) {
  const byProduct = new Map(snapshot.products.map((product) => [productKey(product.model, product.variant), product]));
  const activeLines = snapshot.lines.filter((line) => line.status !== "Completado");
  const pendingUnits = activeLines
    .filter((line) => line.status === "Pendiente")
    .reduce((sum, line) => sum + Number(line.quantity), 0);
  const inProductionUnits = activeLines
    .filter((line) => line.status === "En producción")
    .reduce((sum, line) => sum + Number(line.quantity), 0);
  const activeValue = activeLines.reduce((totals, line) => {
    const value = wholesaleLineValue(line, byProduct.get(productKey(line.model, line.variant)), snapshot.exchangeRate);
    if (hasWholesaleOriginalArs(line)) totals.arg += value.arg;
    totals.uyu += value.uyu;
    return totals;
  }, { arg: 0, uyu: 0 });
  const clientStats = [...activeLines.reduce((groups, line) => {
    groups.set(line.customer, (groups.get(line.customer) || 0) + Number(line.quantity));
    return groups;
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, 6);

  return {
    activeValueArg: activeValue.arg,
    activeValueUyu: activeValue.uyu,
    activeUnits: pendingUnits + inProductionUnits,
    pendingUnits,
    inProductionUnits,
    activeCustomers: new Set(activeLines.map((line) => normalized(line.customer))).size,
    clientStats,
  };
}

export function summarizeWholesaleCustomer(orders: Order[], customerId: string) {
  const customerOrders = orders.filter((order) => order.source === "wholesale" && order.customerId === customerId);
  const completedItems = customerOrders.flatMap((order) =>
    (order.items || [])
      .filter((item) => item.productionStatus === "Completado")
      .map((item) => ({ orderId: order.id, item })),
  );
  const grouped = completedItems.reduce((groups, { orderId, item }) => {
    const model = item.title?.trim() || item.productName?.trim() || item.family?.trim() || "Sin modelo";
    const key = normalized(model);
    const current = groups.get(key) || { id: key, model, orders: new Set<string>(), units: 0 };
    current.orders.add(orderId);
    current.units += Number(item.quantity);
    groups.set(key, current);
    return groups;
  }, new Map<string, { id: string; model: string; orders: Set<string>; units: number }>());
  const latestPurchase = customerOrders
    .flatMap((order) => [order.date, ...(order.items || []).map((item) => item.createdAt || "")])
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0]?.slice(0, 10) || null;

  return {
    rows: [...grouped.values()]
      .map((row) => ({ id: row.id, model: row.model, orders: row.orders.size, units: row.units }))
      .sort((a, b) => b.units - a.units || a.model.localeCompare(b.model, "es")),
    currentOrders: new Set(customerOrders
      .filter((order) => (order.items || []).some((item) => item.productionStatus !== "Completado"))
      .map((order) => order.id)).size,
    totalOrders: new Set(completedItems.map(({ orderId }) => orderId)).size,
    totalUnits: completedItems.reduce((sum, { item }) => sum + Number(item.quantity), 0),
    latestPurchase,
  };
}

export function adaptWholesale(state: State, snapshot: WholesaleSnapshot, imageUrl: (path: string) => string = wholesaleProductImageUrl): State {
  const byProduct = new Map(snapshot.products.map((product) => [productKey(product.model, product.variant), product]));
  const contactByName = new Map((snapshot.contacts || []).map((entry) => [entry.wholesale_name, entry.id]));
  const orderRecordByCode = new Map((snapshot.orderRecords || []).filter((entry) => entry.reference_code).map((entry) => [entry.reference_code!, entry]));
  const openingBySaleId = new Map((snapshot.paymentOpenings || []).map((entry) => [entry.sale_id, entry]));
  const products: Product[] = snapshot.products.filter(source => !source.commerce_variant_id).map((source) => {
    const cover = snapshot.images.filter(image => image.product_id === source.id).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))[0];
    const crop = cover?.option_values || {};
    return ({
    id: `wholesale:${source.id}`, wholesaleProductId: source.id,
    name: [source.model.trim(), source.variant.trim()].filter(Boolean).join(" · "), sku: source.sku || source.id, categoryCode: source.category_code || undefined, family: wholesaleCategory(source, snapshot), variant: source.variant,
    searchText: buildSearchText(source.description, source.catalog_attributes, source.rim_type, source.leather_type),
    rim: source.rim_type || "", leather: source.leather_type || "", cost: 0,
    imageUrl: cover ? imageUrl(cover.storage_path) : undefined,
    imageCrop: cover ? { x: Number(crop.cover_x) || 0, y: Number(crop.cover_y) || 0, zoom: Number(crop.cover_zoom) || 1 } : undefined,
    prices: { Local: 0, Web: 0, Mayorista: Number(source.price_uyu) }, basePrice: Number(source.price_uyu), priceArg: Number(source.price_arg),
    stock: 0, min: 0, published: source.available_web === true, active: true, availableChannels: [
      ...(source.available_local === true ? ["Local" as const] : []),
      ...(source.available_web === true ? ["Web" as const] : []),
      ...(source.available_wholesale === false ? [] : ["Mayorista" as const]),
    ],
  });
  });
  const customers: Customer[] = snapshot.customers.map((source) => ({
    id: `wholesale:${source.full_name}`, wholesaleName: source.full_name, contactId: contactByName.get(source.full_name), name: formatContactName(source.full_name),
    email: source.email || "", phone: source.phone || "", address: source.address || "",
    notes: source.notes || "", companyName: source.company_name || "", birthDate: source.birth_date || "",
    city: source.city || "", country: countryDisplayName(source.country || ""),
    department: source.department || undefined, postalCode: source.postal_code || undefined,
    agendaAdditionalPhones: source.additional_phones || [], agendaInferredCategory: source.inferred_category || undefined,
    raffleProductInterest: source.product_interest || undefined,
    segment: source.customer_type || "Mayorista",
    originChannel: source.origin_channel || "WhatsApp",
  }));
  const knownCustomers = new Map(state.customers.map((customer) => [customer.id, customer]));
  const additionalCustomers: Customer[] = [];
  const customerIdByWholesaleName = new Map<string, string>();
  for (const customer of customers) {
    const linked = knownCustomers.get(customer.id) || (customer.email ? state.customers.find((entry) => entry.email && entry.email.toLowerCase() === customer.email.toLowerCase()) : undefined);
    customerIdByWholesaleName.set(customer.wholesaleName!, linked?.id || customer.id);
    if (linked) {
      linked.wholesaleName = customer.wholesaleName;
      linked.contactId ||= customer.contactId;
      linked.companyName ||= customer.companyName;
      linked.email ||= customer.email;
      linked.phone ||= customer.phone;
      linked.address ||= customer.address;
      linked.department ||= customer.department;
      linked.postalCode ||= customer.postalCode;
      linked.agendaAdditionalPhones ||= customer.agendaAdditionalPhones;
      linked.agendaInferredCategory ||= customer.agendaInferredCategory;
      linked.raffleProductInterest ||= customer.raffleProductInterest;
      linked.notes ||= customer.notes;
      linked.city ||= customer.city;
      linked.country ||= customer.country;
      linked.segment = customer.segment;
      linked.originChannel ||= customer.originChannel;
    } else additionalCustomers.push(customer);
  }
  const grouped = new Map<string, WholesaleLine[]>();
  for (const line of snapshot.lines) {
    const key = line.order_id?.trim() || `line:${line.line_id}`;
    grouped.set(key, [...(grouped.get(key) || []), line]);
  }
  const orders: Order[] = [];
  const payments: Payment[] = [];
  const idBySaleId = new Map<string, string>();
  for (const [key, lines] of grouped) {
    const first = lines[0];
    const id = `wholesale:${key}`;
    const recorded = orderRecordByCode.get(first.order_id || "");
    if (recorded) idBySaleId.set(recorded.id, id);
    const items: OrderLine[] = lines.map((line) => {
      const exact = byProduct.get(productKey(line.model, line.variant));
      const isGeneric = normalized(line.variant) === normalized(GENERIC_WHOLESALE_VARIANT);
      // Genérico conserva la descripción del pedido y usa el primer SKU existente como referencia.
      const match = exact ?? (isGeneric ? firstWholesaleReferenceVariant(snapshot.products, line.model) : undefined);
      const catalogProduct = match?.commerce_variant_id
        ? state.products.find((product) => product.id === match.commerce_variant_id)
        : products.find((product) => product.wholesaleProductId === match?.id);
      const productName = match?.commerce_variant_id && catalogProduct?.name ? catalogProduct.name : naturalCaseName(line.model);
      const value = wholesaleLineValue(line, match, snapshot.exchangeRate);
      return {
        id: line.line_id, wholesaleLineId: line.line_id, productId: catalogProduct?.id || (match ? `wholesale:${match.id}` : `wholesale-missing:${line.line_id}`),
        title: productName, productName, sku: catalogProduct?.sku || match?.id || "", quantity: Number(line.quantity),
        weightGrams: catalogProduct?.weightGrams || (Number(match?.weight_grams) > 0 ? Number(match?.weight_grams) : undefined),
        unitPrice: value.unitUyu, amount: value.uyu, family: catalogProduct?.family || line.model, variant: isGeneric ? GENERIC_WHOLESALE_VARIANT : catalogProduct?.variant || line.variant,
        rim: catalogProduct?.rim || match?.rim_type || "", leather: catalogProduct?.leather || match?.leather_type || "",
        productionStatus: line.status, reviewStatus: null, orderType: line.order_type || "normal",
        priceArg: hasWholesaleOriginalArs(line) ? value.arg : undefined, createdAt: line.created_at, completedAt: line.completed_at,
      };
    });
    const date = [...lines].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))[0]?.created_at || "";
    const production = lines.every((line) => line.status === "Completado") ? "Terminado" : lines.some((line) => line.status === "En producción") ? "En producción" : "Pendiente";
    const originalArsKnown = lines.every(hasWholesaleOriginalArs);
    const originalUyuKnown = lines.every((line) => line.order_type === "no_cost" || line.total_uyu != null && Number.isFinite(Number(line.total_uyu)));
    const totalArg = originalArsKnown ? lines.reduce((sum, line) => sum + Number(line.total_arg || 0), 0) : null;
    const totalUyu = originalUyuKnown ? lines.reduce((sum, line) => sum + (line.order_type === "no_cost" ? 0 : Number(line.total_uyu || 0)), 0) : null;
    const opening = recorded ? openingBySaleId.get(recorded.id) : undefined;
    const order: Order = {
      id, source: "wholesale", referenceCode: first.order_id || null,
      contactId: recorded?.contact_id || contactByName.get(first.customer),
      wholesaleSaleId: recorded?.id,
      wholesaleOpeningPaid: opening ? opening.collected_minor == null ? null : Number(opening.collected_minor) / 100 : 0,
      wholesaleOpeningPaidArg: opening ? opening.collected_arg_minor != null ? Number(opening.collected_arg_minor) / 100
        : opening.collected_minor === 0 ? 0 : null : 0,
      wholesalePaidInFullWithoutPrice: opening?.paid_in_full_without_price === true,
      wholesaleTotalArg: totalArg, wholesaleTotalUyu: totalUyu,
      status: "wholesale_sale", customerId: customerIdByWholesaleName.get(first.customer) || `wholesale:${first.customer}`,
      customerName: first.customer, productId: items[0]?.productId || "",
      quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      items, totalAmount: totalUyu ?? (recorded ? Number(recorded.total_minor) / 100 : items.reduce((sum, item) => sum + item.amount, 0)),
      channel: "Mayorista", date: date ? commerceDate(date) : "", due: "",
      production, delivery: production === "Terminado" ? "Enviado" : "No aplica", method: "No aplica", design: false, approved: true,
    };
    orders.push(order);
  }
  for (const receipt of snapshot.receipts || []) {
    const orderId = idBySaleId.get(receipt.sale_id);
    if (!orderId) continue;
    payments.push({
      id: `wholesale-receipt:${receipt.id}`, orderId, amount: Number(receipt.amount_minor) / 100,
      sourceCurrency: receipt.currency, sourceAmount: Number(receipt.source_amount_minor) / 100,
      date: receipt.paid_on, method: receipt.payment_method,
    });
  }
  return {
    ...state,
    products: [...state.products, ...products],
    customers: [...state.customers, ...additionalCustomers],
    orders: [...state.orders, ...orders].sort((a, b) => b.date.localeCompare(a.date)),
    payments: [...state.payments, ...payments],
    records: { ...state.records, monedas: [...(state.records.monedas || []), { id: "ARS", moneda: "ARS", valor: snapshot.exchangeRate }] },
  };
}
