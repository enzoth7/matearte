import { seed, type State, type Product, type Customer, type Order, type OrderLine, type SalesChannel } from "./data";
import { commerceCustomerName, visibleInCommerceAdmin, type CommerceOrder, type CommerceProduct, type CommerceReference } from "./commerceSource";
import { imageForVariant } from "./catalogImages";
import type { LocalCustomer, LocalSale } from "./localSource";
import type { WholesaleSnapshot } from "./wholesaleSource";

export type CommercePayment = { id: string; order_id: string; provider: string; status: string; amount_minor: number; currency: string; approved_at: string | null; created_at: string };
export type NationalRate = { id: string; name: string; rate_minor: number; is_pickup: boolean; active: boolean; departments: string[] };
export type LocalCustomerBirth = { source_user_id: string | null; email: string | null; birth_date: string | null };
export type WebCustomerProfile = { user_id: string; birth_date: string | null; city: string | null; country_code: string | null };
export type RuralRaffleEntry = { id: string; full_name: string | null; email: string; phone: string; city: string | null; country: string | null; birth_date: string | null; product_interest: string; created_at: string };
export type CommerceSnapshot = {
  products: CommerceProduct[]; orders: CommerceOrder[]; payments: CommercePayment[];
  reference: CommerceReference; nationalRates: NationalRate[]; customerBirthdays?: LocalCustomerBirth[]; customerProfiles?: WebCustomerProfile[];
  localCustomers?: LocalCustomer[]; localSales?: LocalSale[];
  ruralRaffleEntries?: RuralRaffleEntry[];
  wholesale?: WholesaleSnapshot;
};
const text = (source: Record<string, unknown> | undefined, ...keys: string[]) => {
  for (const key of keys) if (typeof source?.[key] === "string" && source[key]) return String(source[key]);
  return "";
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function commerceDate(iso: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const countryName = (country: string) => {
  try { return /^[A-Za-z]{2}$/.test(country) ? new Intl.DisplayNames(["es"], { type: "region" }).of(country.toUpperCase()) || country : country; }
  catch { return country; }
};
const ruralInterestLabel: Record<string, string> = {
  mates: "Mates",
  bombillas: "Bombillas",
  materas: "Materas",
  termos: "Termos",
  personalizados: "Productos personalizados",
  botas: "Botas",
  carteras: "Carteras",
  "otros-articulos-cuero": "Otros artículos en cuero",
};

export function adaptCommerce(snapshot: CommerceSnapshot, imageUrl: (path: string) => string = () => ""): State {
  const state = seed();
  const birthByUser = new Map(snapshot.customerBirthdays?.filter((row) => row.source_user_id && row.birth_date).map((row) => [row.source_user_id!, row.birth_date!]) || []);
  const birthByEmail = new Map(snapshot.customerBirthdays?.filter((row) => row.email && row.birth_date).map((row) => [row.email!.trim().toLowerCase(), row.birth_date!]) || []);
  const webProfiles = new Map(snapshot.customerProfiles?.map((profile) => [profile.user_id, profile]) || []);
  const products: Product[] = snapshot.products.flatMap((product) => {
    const category = snapshot.reference.categories.find((entry) => entry.code === product.category)?.label_es ?? product.category;
    // Un producto sin variantes sigue existiendo en el catálogo, sin precio inventado.
    const variants = product.commerce_variants.length ? product.commerce_variants : [null];
    return variants.map((variant) => {
      const cover = imageForVariant(product.commerce_product_images, variant);
      return ({
      id: variant?.id ?? product.id, sourceProductId: product.id,
      name: product.name, sku: variant?.sku ?? "", variant: variant?.name ?? "Sin variantes",
      family: category, rim: text(variant?.option_values, "virola", "rim"), leather: text(variant?.option_values, "cuero", "leather"),
      imageUrl: cover ? imageUrl(cover.storage_path) : undefined,
      imageCrop: cover ? { x: Number(cover.option_values?.cover_x) || 0, y: Number(cover.option_values?.cover_y) || 0, zoom: Number(cover.option_values?.cover_zoom) || 1 } : undefined,
      cost: 0, stock: 0, min: 0,
      prices: {
        Local: variant ? Number(variant.base_price_minor) / 100 : 0,
        Web: variant ? Number(variant.price_minor) / 100 : 0,
        Mayorista: variant && product.category.toLowerCase() === "mates" && snapshot.reference.settings.wholesale_mate_discount_enabled
          ? Math.round(Number(variant.price_minor) * (1 - Number(snapshot.reference.settings.wholesale_mate_discount_percent) / 100)) / 100
          : 0,
      },
      availableChannels: variant ? ["Local", "Web", ...(product.category.toLowerCase() === "mates" && snapshot.reference.settings.wholesale_mate_discount_enabled ? ["Mayorista" as const] : [])] : [],
      wholesaleThreshold: variant && product.category.toLowerCase() === "mates" && snapshot.reference.settings.wholesale_mate_discount_enabled
        ? snapshot.reference.settings.wholesale_mate_quantity_threshold : undefined,
      active: variant?.active ?? false, published: product.published,
      });
    });
  });
  const customers = new Map<string, Customer>();
  const orders: Order[] = snapshot.orders.filter(visibleInCommerceAdmin).map((source) => {
    if (source.currency !== "UYU") throw new Error(`El pedido #${source.order_number} requiere conversión de ${source.currency}.`);
    const contact = source.customer_snapshot ?? {};
    const shipping = source.shipping_snapshot ?? {};
    const international = ["international_shipping", "international_coordination"].includes(source.shipping_method);
    const destination = international ? shipping : contact;
    const email = text(contact, "email");
    const customerId = source.user_id || (email ? `email:${email.trim().toLowerCase()}` : `order:${source.id}`);
    const webProfile = source.user_id ? webProfiles.get(source.user_id) : undefined;
    const birthDate = webProfile?.birth_date || text(contact, "birthDate", "birth_date", "birthday") || (source.user_id ? birthByUser.get(source.user_id) : undefined) || birthByEmail.get(email.trim().toLowerCase()) || "";
    const wholesale = contact.purchaseFlow === "wholesale_bank_transfer";
    const previous = customers.get(customerId);
    if (!previous) customers.set(customerId, {
      id: customerId, name: commerceCustomerName(contact), email,
      phone: text(contact, "phone", "telephone", "celular", "whatsapp"),
      birthDate,
      city: text(destination, "city") || webProfile?.city || "",
      country: countryName(text(destination, "country", "countryCode", "country_code") || webProfile?.country_code || (!international ? "UY" : "")),
      segment: wholesale ? "Mayorista" : "Minorista",
    });
    else { if (wholesale) previous.segment = "Mayorista"; if (!previous.birthDate && birthDate) previous.birthDate = birthDate; }
    const items: OrderLine[] = source.order_items.map((item) => {
      const catalog = products.find((product) => product.id === item.source_variant_id);
      const historical = object(item.immutable_snapshot);
      const variant = object(historical.variant);
      return {
        id: item.id, productId: item.source_variant_id ?? item.id, title: item.title,
        sku: item.sku || text(variant, "sku"), quantity: item.quantity,
        unitPrice: Number(item.unit_price_minor) / 100, amount: Number(item.total_minor) / 100,
        family: catalog?.family || text(object(historical.product), "category") || "Sin categoría",
        variant: catalog?.variant || text(variant, "name"), rim: catalog?.rim || "Sin especificar", leather: catalog?.leather || "Sin especificar",
        productionStatus: item.production_status || "", reviewStatus: item.review_status,
      };
    });
    const production = items.length > 0 && items.every((item) => item.productionStatus === "completed") ? "Terminado"
      : items.some((item) => item.productionStatus === "in_production") ? "En producción" : "Pendiente";
    return {
      id: source.id, number: source.order_number, referenceCode: source.reference_code, status: source.status, paidAt: source.paid_at,
      customerId, productId: items[0]?.productId ?? source.id, quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      items, totalAmount: Number(source.total_minor) / 100, shippingAmount: Number(source.shipping_minor) / 100,
      discountAmount: Number(source.discount_minor) / 100, feeAmount: Number(source.payment_fee_minor) / 100,
      channel: wholesale ? "Mayorista" : "Web", date: commerceDate(source.created_at), due: "",
      production, delivery: source.status === "shipped" ? "Enviado" : "Pendiente", method: source.shipping_method === "pickup" ? "Retiro" : "Envío",
      design: source.order_items.some((item) => item.requires_review),
      approved: source.order_items.filter((item) => item.requires_review).every((item) => item.review_status === "approved"),
      carrier: source.shipping_carrier || "", tracking: source.tracking_code || "",
    };
  });
  const orderIds = new Set(orders.map((order) => order.id));
  const localCustomerIds = new Map<string, string>();
  for (const source of snapshot.localCustomers || []) {
    const email = source.email?.trim() || "";
    const emailKey = email ? `email:${email.toLowerCase()}` : "";
    const existing = (source.source_user_id && customers.get(source.source_user_id)) || (emailKey && customers.get(emailKey)) ||
      [...customers.values()].find((customer) => email && customer.email.toLowerCase() === email.toLowerCase());
    const canonicalId = existing?.id || source.source_user_id || emailKey || `local:${source.id}`;
    localCustomerIds.set(source.id, canonicalId);
    if (existing) {
      existing.localCustomerId = source.id;
      existing.name = source.full_name || existing.name;
      existing.email = email || existing.email;
      existing.phone = source.phone || existing.phone;
      existing.city = source.city || existing.city;
      existing.country = source.country || existing.country;
      existing.birthDate = source.birth_date || existing.birthDate;
      existing.firstPurchaseDate = source.first_purchase_date || "";
      existing.lastPurchaseDate = source.last_purchase_date || "";
      existing.notes = source.notes || "";
    } else customers.set(canonicalId, {
      id: canonicalId, localCustomerId: source.id, name: source.full_name, email,
      phone: source.phone || "", birthDate: source.birth_date || "",
      firstPurchaseDate: source.first_purchase_date || "", lastPurchaseDate: source.last_purchase_date || "",
      notes: source.notes || "", city: source.city || "", country: source.country || "", segment: "Minorista",
    });
  }
  for (const source of snapshot.ruralRaffleEntries || []) {
    const email = source.email.trim().toLowerCase();
    const existing = [...customers.values()].find((customer) => customer.email.trim().toLowerCase() === email);
    if (existing) {
      existing.raffleEntryId = source.id;
      existing.phone ||= source.phone;
      existing.city ||= source.city || "";
      existing.country ||= source.country || "";
      existing.birthDate ||= source.birth_date || "";
      existing.sourceChannels = [...new Set<SalesChannel>([...(existing.sourceChannels || []), "Sorteo"])];
      if (!existing.notes) existing.notes = `Interés del sorteo: ${ruralInterestLabel[source.product_interest] || source.product_interest}`;
      continue;
    }
    customers.set(`sorteo:${source.id}`, {
      id: `sorteo:${source.id}`,
      raffleEntryId: source.id,
      raffleProductInterest: source.product_interest,
      name: source.full_name || "Participante del sorteo",
      email,
      phone: source.phone,
      birthDate: source.birth_date || "",
      city: source.city || "",
      country: source.country || "",
      segment: "Minorista",
      notes: `Interés del sorteo: ${ruralInterestLabel[source.product_interest] || source.product_interest}`,
      sourceChannels: ["Sorteo"],
    });
  }
  const localOrders: Order[] = (snapshot.localSales || []).map((source) => {
    if (source.currency !== "UYU") throw new Error(`La venta local #${source.sale_number} requiere conversión de ${source.currency}.`);
    const items: OrderLine[] = source.local_sale_items.map((item) => {
      const catalog = products.find((product) => product.id === item.variant_id);
      return {
        id: item.id, productId: item.variant_id || item.id, title: item.product_name,
        sku: item.sku, quantity: item.quantity, unitPrice: Number(item.unit_price_minor) / 100,
        amount: Number(item.line_total_minor) / 100, family: catalog?.family || "",
        variant: item.variant_name, rim: catalog?.rim || "", leather: catalog?.leather || "",
        productionStatus: "", reviewStatus: null,
      };
    });
    const charged = Number(source.total_minor) / 100;
    const itemsAmount = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      id: source.id, number: source.sale_number, referenceCode: source.reference_code, source: "local", status: "local_sale",
      customerId: source.customer_id ? localCustomerIds.get(source.customer_id) || `local:${source.customer_id}` : `local-anon:${source.id}`,
      customerName: source.customer_name, productId: items[0]?.productId || source.id,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      items, totalAmount: source.payment_method === "Seña" ? Math.max(charged, itemsAmount) : charged,
      localItemsAmount: itemsAmount, paymentMethod: source.payment_method,
      channel: source.channel && ["Instagram", "Facebook", "WhatsApp"].includes(source.channel) ? source.channel : "Local", date: source.sold_on, due: "", production: "No aplica", delivery: "No aplica", method: "No aplica",
      design: false, approved: true,
    };
  });
  return {
    ...state, products, orders: [...orders, ...localOrders].sort((a, b) => b.date.localeCompare(a.date)), customers: [...customers.values()],
    payments: snapshot.payments.filter((payment) => payment.status === "approved" && payment.currency === "UYU" && orderIds.has(payment.order_id)).map((payment) => ({
      id: payment.id, orderId: payment.order_id, amount: Number(payment.amount_minor) / 100,
      date: commerceDate(payment.approved_at || payment.created_at), method: payment.provider,
    })).concat((snapshot.localSales || []).filter((sale) => Number(sale.total_minor) > 0).map((sale) => ({
      id: `local:${sale.id}`, orderId: sale.id, amount: Number(sale.total_minor) / 100,
      date: sale.sold_on, method: sale.payment_method,
    }))),
    records: {
      monedas: snapshot.reference.exchangeRates.map((rate) => ({ id: rate.currency_code, moneda: rate.currency_code, valor: Number(rate.rate_to_uyu) })),
      "comercial/descuentos": snapshot.reference.discounts.map((discount) => ({ id: discount.id, codigo: discount.code, tipo: discount.discount_type === "percentage" ? "Porcentaje" : "Monto UYU", valor: discount.discount_type === "percentage" ? Number(discount.value) : Number(discount.value) / 100, desde: discount.valid_from, fecha: discount.valid_until, estado: discount.enabled ? "Activo" : "Pausado" })),
      "productos/categorias": snapshot.reference.categories.map((category) => ({ id: category.code, nombre: category.label_es, atributos: "", variantes: "", estado: category.active ? "Activa" : "Inactiva" })),
      "administracion/canales": [
        { id: "commerce_enabled", nombre: "Comercio web", tipo: "Canal", detalle: "", estado: snapshot.reference.settings.commerce_enabled ? "Habilitado" : "Deshabilitado" },
        { id: "mercado_pago_enabled", nombre: "Mercado Pago", tipo: "Medio de pago", detalle: "", estado: snapshot.reference.settings.mercado_pago_enabled ? "Habilitado" : "Deshabilitado" },
        { id: "paypal_enabled", nombre: "PayPal", tipo: "Medio de pago", detalle: "", estado: snapshot.reference.settings.paypal_enabled ? "Habilitado" : "Deshabilitado" },
      ],
    },
  };
}
