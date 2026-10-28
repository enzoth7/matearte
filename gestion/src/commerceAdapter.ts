import { catalogValueLabel, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { seed, type State, type Product, type Customer, type Order, type OrderLine, type Payment, type SalesChannel, type CustomerSourceChannel } from "./data";
import { commerceCustomerName, visibleInCommerceAdmin, type CommerceOrder, type CommerceProduct, type CommerceReference } from "./commerceSource";
import { imageForVariant } from "./catalogImages";
import type { LocalCustomer, LocalSale, LocalSaleReceipt } from "./localSource";
import type { WholesaleSnapshot } from "./wholesaleSource";
import { formatContactName } from "../../shared/contactName";
import { countryDisplayName } from "./location";

export type CommercePayment = { id: string; order_id: string; provider: string; status: string; amount_minor: number; currency: string; approved_at: string | null; created_at: string };
export type NationalRate = { id: string; name: string; rate_minor: number; is_pickup: boolean; active: boolean; departments: string[] };
export type LocalCustomerBirth = { source_user_id: string | null; email: string | null; birth_date: string | null };
export type WebCustomerProfile = { user_id: string; birth_date: string | null; city: string | null; country_code: string | null; company?: string | null; address_line1?: string | null; department?: string | null; postal_code?: string | null };
export type RuralRaffleEntry = { id: string; full_name: string | null; company_name?: string | null; address?: string | null; notes?: string | null; email: string; phone: string; city: string | null; country: string | null; department?: string | null; postal_code?: string | null; additional_phones?: string[]; inferred_category?: string | null; birth_date: string | null; product_interest: string; origin_channel?: CustomerSourceChannel; customer_type?: "Minorista" | "Mayorista"; created_at: string };
export type WebLead = { source_kind: "account" | "newsletter"; source_id: string; full_name: string | null; email: string; phone: string | null; city: string | null; country_code: string | null; birth_date: string | null; company: string | null; origin_channel: CustomerSourceChannel; customer_type: "Minorista" | "Mayorista"; created_at: string; address?: string | null; department?: string | null; postal_code?: string | null; notes?: string | null; additional_phones?: string[]; inferred_category?: string | null; product_interest?: string | null };
export type CommerceSnapshot = {
  products: CommerceProduct[]; orders: CommerceOrder[]; payments: CommercePayment[];
  reference: CommerceReference; nationalRates: NationalRate[]; customerBirthdays?: LocalCustomerBirth[]; customerProfiles?: WebCustomerProfile[];
  localCustomers?: LocalCustomer[]; localSales?: LocalSale[]; localReceipts?: LocalSaleReceipt[];
  /** Origen calculado en la base (primer canal de entrada); es el mismo que usa Marketing → Contactos. */
  contactOrigins?: { contact_key: string; origin: string }[];
  contactFirstSeen?: { contact_key: string; first_seen_at: string | null }[];
  ruralRaffleEntries?: RuralRaffleEntry[];
  webLeads?: WebLead[];
  wholesale?: WholesaleSnapshot;
};
const text = (source: Record<string, unknown> | undefined, ...keys: string[]) => {
  for (const key of keys) if (typeof source?.[key] === "string" && source[key]) return String(source[key]);
  return "";
};
const flattenSearch = (value: unknown, depth = 0): string[] => {
  if (value == null || depth > 3) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenSearch(item, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => flattenSearch(item, depth + 1));
  return [];
};
export const buildSearchText = (...sources: unknown[]) => sources.flatMap((source) => flattenSearch(source)).join(" ");
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const earliestTimestamp = (...values: (string | null | undefined)[]) => values.filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
  .reduce<string | undefined>((earliest, value) => !earliest || Date.parse(value) < Date.parse(earliest) ? value : earliest, undefined);
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
  personalizados: "Personalizados",
  botas: "Botas",
  carteras: "Carteras",
  "otros-articulos-cuero": "Otros artículos en cuero",
};

const catalogProductType = (categoryCode: string, attributes?: Record<string, unknown>) => {
  const key = categoryCode === "mates" ? "tipo-mate" : categoryCode === "materas" ? "forma" : categoryCode === "bombillas" ? "tipo-bombilla" : "";
  const code = key && typeof attributes?.[key] === "string" ? String(attributes[key]).trim() : "";
  return code ? catalogValueLabel(defaultCatalogTaxonomy, key, code) : undefined;
};

export function adaptCommerce(snapshot: CommerceSnapshot, imageUrl: (path: string) => string = () => ""): State {
  const state = seed();
  const birthByUser = new Map(snapshot.customerBirthdays?.filter((row) => row.source_user_id && row.birth_date).map((row) => [row.source_user_id!, row.birth_date!]) || []);
  const birthByEmail = new Map(snapshot.customerBirthdays?.filter((row) => row.email && row.birth_date).map((row) => [row.email!.trim().toLowerCase(), row.birth_date!]) || []);
  const webProfiles = new Map(snapshot.customerProfiles?.map((profile) => [profile.user_id, profile]) || []);
  const products: Product[] = snapshot.products.flatMap((product) => {
    const categoryCode = product.category_code || product.category;
    const category = snapshot.reference.categories.find((entry) => entry.code === categoryCode)?.label_es ?? categoryCode;
    const wholesaleCategory = (snapshot.reference.settings.wholesale_discount_categories || ["mates"]).includes(categoryCode.toLowerCase());
    // Un producto sin variantes sigue existiendo en el catálogo, sin precio inventado.
    const variants = product.commerce_variants.length ? product.commerce_variants : [null];
    return variants.map((variant) => {
      const cover = imageForVariant(product.commerce_product_images, variant);
      return ({
      id: variant?.id ?? product.id, sourceProductId: product.id,
      updatedAt: variant?.updated_at && variant.updated_at > product.updated_at ? variant.updated_at : product.updated_at,
      searchText: buildSearchText(product.description, product.attributes, variant?.option_values, variant?.color, variant?.rim_type, variant?.leather_type, category),
      weightGrams: Number(variant?.weight_grams) > 0 ? Number(variant?.weight_grams) : Number(product.peso) || 0,
      name: product.name, sku: variant?.sku ?? "", variant: variant?.name ?? "Sin variantes",
      options: variant ? { ...(variant.option_values || {}), ...(variant.color && !variant.option_values?.color ? { color: variant.color } : {}) } : undefined,
      attributes: product.attributes || {},
      categoryCode, family: category, catalogType: catalogProductType(categoryCode, product.attributes), personalizationType: product.attributes?.["tipo-personalizado"] === "matera" ? "matera" : product.attributes?.["tipo-personalizado"] === "mate" ? "mate" : undefined, rim: variant?.rim_type || text(variant?.option_values, "virola", "rim"), leather: variant?.leather_type || text(variant?.option_values, "cuero", "leather"),
      imageUrl: cover ? imageUrl(cover.storage_path) : undefined,
      imageCrop: cover ? { x: Number(cover.option_values?.cover_x) || 0, y: Number(cover.option_values?.cover_y) || 0, zoom: Number(cover.option_values?.cover_zoom) || 1 } : undefined,
      cost: 0, stock: 0, min: 0,
      priceArg: variant?.wholesale_price_arg == null ? undefined : Number(variant.wholesale_price_arg),
      basePrice: variant ? Number(variant.base_price_minor) / 100 : undefined,
      prices: {
        Local: variant ? Number(categoryCode === "servicios" ? variant.base_price_minor : variant.price_minor) / 100 : 0,
        Web: variant ? Number(variant.price_minor) / 100 : 0,
        Mayorista: variant && wholesaleCategory && snapshot.reference.settings.wholesale_mate_discount_enabled
          ? Math.round(Number(variant.base_price_minor) * (1 - Number(snapshot.reference.settings.wholesale_mate_discount_percent) / 100)) / 100
          : variant?.legacy_product_id ? Number(variant.base_price_minor) / 100 : 0,
      },
      availableChannels: variant ? [...(variant.available_local === false ? [] : ["Local" as const]), ...(!variant.active || variant.available_web === false ? [] : ["Web" as const]), ...(variant.available_wholesale === true ? ["Mayorista" as const] : [])] : [],
      wholesaleThreshold: variant && categoryCode.toLowerCase() === "mates" && snapshot.reference.settings.wholesale_mate_discount_enabled
        ? snapshot.reference.settings.wholesale_mate_quantity_threshold : undefined,
      active: Boolean(variant?.active && (categoryCode.toLowerCase() === "servicios" || variant.available_web !== false)), published: product.published,
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
      id: customerId, name: formatContactName(commerceCustomerName(contact)), email,
      phone: text(contact, "phone", "telephone", "celular", "whatsapp"),
      birthDate,
      companyName: webProfile?.company || text(contact, "company") || undefined,
      address: webProfile?.address_line1 || text(contact, "address") || undefined,
      department: webProfile?.department || text(contact, "department") || undefined,
      postalCode: webProfile?.postal_code || text(contact, "postalCode") || undefined,
      notes: text(contact, "notes") || undefined,
      agendaAdditionalPhones: Array.isArray(contact.additionalPhones) ? contact.additionalPhones.filter((phone): phone is string => typeof phone === "string") : [],
      agendaInferredCategory: text(contact, "inferredCategory") || undefined,
      raffleProductInterest: text(contact, "productInterest") || undefined,
      city: webProfile?.city || text(contact, "city") || text(destination, "city"),
      country: countryName(webProfile?.country_code || text(contact, "country", "countryCode", "country_code") || text(destination, "country", "countryCode", "country_code") || (!international ? "UY" : "")),
      segment: wholesale ? "Mayorista" : "Minorista",
      originChannel: "Web", createdAt: source.created_at,
    });
    else { if (wholesale) previous.segment = "Mayorista"; if (!previous.birthDate && birthDate) previous.birthDate = birthDate; previous.createdAt = earliestTimestamp(previous.createdAt, source.created_at); }
    const items: OrderLine[] = source.order_items.map((item) => {
      const catalog = products.find((product) => product.id === item.source_variant_id);
      const historical = object(item.immutable_snapshot);
      const variant = object(historical.variant);
      const historicalProduct = object(historical.product);
      const selectedOptions = object(historical.selectedOptions ?? historical.optionValues ?? historical.option_values_override);
      const options = { ...(text(variant, "color") ? { color: text(variant, "color") } : {}), ...object(variant.option_values), ...selectedOptions };
      return {
        id: item.id, productId: item.source_variant_id ?? item.id, title: item.title,
        productName: catalog?.name || text(historicalProduct, "name"), options: Object.keys(options).length ? options : catalog?.options,
        weightGrams: Number(historicalProduct.peso) > 0 ? Number(historicalProduct.peso) : catalog?.weightGrams,
        sku: item.sku || text(variant, "sku"), quantity: item.quantity,
        unitPrice: Number(item.unit_price_minor) / 100, amount: Number(item.total_minor) / 100,
        family: item.item_type === "design" ? "Personalizados" : catalog?.family || text(object(historical.product), "category") || "Sin categoría",
        variant: catalog?.variant || text(variant, "name"), rim: catalog?.rim || "Sin especificar", leather: catalog?.leather || "Sin especificar",
        productionStatus: source.status === "shipped" || source.status === "delivered" ? "completed" : item.production_status || "", reviewStatus: item.review_status, orderType: item.item_type,
      };
    });
    const production = items.length > 0 && items.every((item) => item.productionStatus === "completed") ? "Terminado"
      : items.some((item) => item.productionStatus === "in_production") ? "En producción" : "Pendiente";
    return {
      id: source.id, number: source.order_number, referenceCode: source.reference_code, status: source.status, paidAt: source.paid_at,
      customerId, productId: items[0]?.productId ?? source.id, quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      paymentAmountUsd: source.paypal_amount_usd_minor ? Number(source.paypal_amount_usd_minor) / 100 : undefined,
      items, totalAmount: Number(source.total_minor) / 100, shippingAmount: Number(source.shipping_minor) / 100,
      discountAmount: Number(source.discount_minor) / 100, feeAmount: Number(source.payment_fee_minor) / 100,
      channel: wholesale ? "Mayorista" : "Web", date: commerceDate(source.created_at), due: "",
      production, delivery: source.status === "shipped" ? "Enviado" : source.status === "delivered" ? "Entregado" : "Pendiente", method: source.shipping_method === "pickup" ? "Retiro" : "Envío",
      design: source.order_items.some((item) => item.requires_review),
      approved: source.order_items.filter((item) => item.requires_review).every((item) => item.review_status === "approved"),
      carrier: source.shipping_carrier || "", tracking: source.tracking_code || "",
    };
  });
  const orderIds = new Set(orders.map((order) => order.id));
  for (const lead of snapshot.webLeads || []) {
    const email = lead.email.trim().toLowerCase();
    const profile = lead.source_kind === "account" ? webProfiles.get(lead.source_id) : undefined;
    const existing = customers.get(lead.source_kind === "account" ? lead.source_id : `email:${email}`)
      || [...customers.values()].find((customer) => customer.email.trim().toLowerCase() === email);
    if (existing) {
      if (lead.source_kind === "account" || !existing.webLeadKind) {
        existing.webLeadKind = lead.source_kind;
        existing.webLeadId = lead.source_id;
      }
      if (!existing.createdAt || lead.created_at < existing.createdAt) {
        existing.originChannel = lead.origin_channel;
        existing.createdAt = lead.created_at;
      }
      if (lead.origin_channel === "Suscripción con desc." && existing.originChannel === "Web") {
        existing.originChannel = lead.origin_channel;
      }
      const leadName = formatContactName(lead.full_name || "");
      if (leadName && leadName.toLowerCase() !== email && (!existing.name || existing.name.trim().toLowerCase() === email || existing.name === "Cliente sin nombre")) {
        existing.name = leadName;
      }
      existing.phone ||= lead.phone || "";
      existing.city ||= lead.city || "";
      existing.country ||= countryName(lead.country_code || "");
      existing.birthDate ||= lead.birth_date || "";
      existing.companyName ||= lead.company || undefined;
      existing.address ||= profile?.address_line1 || lead.address || undefined;
      existing.department ||= profile?.department || lead.department || undefined;
      existing.postalCode ||= profile?.postal_code || lead.postal_code || undefined;
      existing.notes ||= lead.notes || undefined;
      if (!existing.agendaAdditionalPhones?.length) existing.agendaAdditionalPhones = lead.additional_phones || [];
      existing.agendaInferredCategory ||= lead.inferred_category || undefined;
      existing.raffleProductInterest ||= lead.product_interest || undefined;
      if (lead.customer_type === "Mayorista") existing.segment = "Mayorista";
    } else customers.set(lead.source_kind === "account" ? lead.source_id : `email:${email}`, {
      id: lead.source_kind === "account" ? lead.source_id : `email:${email}`,
      name: formatContactName(lead.full_name || "") || email, email, phone: lead.phone || "",
      city: lead.city || "", country: countryName(lead.country_code || ""),
      birthDate: lead.birth_date || "", companyName: lead.company || undefined,
      address: profile?.address_line1 || lead.address || undefined, department: profile?.department || lead.department || undefined,
      postalCode: profile?.postal_code || lead.postal_code || undefined,
      notes: lead.notes || undefined, agendaAdditionalPhones: lead.additional_phones || [],
      agendaInferredCategory: lead.inferred_category || undefined,
      raffleProductInterest: lead.product_interest || undefined,
      segment: lead.customer_type, originChannel: lead.origin_channel, createdAt: lead.created_at,
      webLeadKind: lead.source_kind, webLeadId: lead.source_id,
    });
  }
  const localCustomerIds = new Map<string, string>();
  const customerByEmail = new Map([...customers.values()].filter((customer) => customer.email).map((customer) => [customer.email.trim().toLowerCase(), customer]));
  for (const source of snapshot.localCustomers || []) {
    const email = source.email?.trim() || "";
    const emailKey = email ? `email:${email.toLowerCase()}` : "";
    const existing = (source.linked_customer_id && customers.get(source.linked_customer_id)) || (source.source_user_id && customers.get(source.source_user_id)) || (emailKey && customers.get(emailKey)) ||
      (email ? customerByEmail.get(email.toLowerCase()) : undefined);
    const canonicalId = existing?.id || source.linked_customer_id || source.source_user_id || emailKey || `local:${source.id}`;
    localCustomerIds.set(source.id, canonicalId);
    if (existing) {
      const linkedCopy = !!source.linked_customer_id;
      if (linkedCopy || source.origin_channel === "Agenda" || (!existing.createdAt || (source.created_at && source.created_at < existing.createdAt))) {
        existing.originChannel = source.origin_channel || (source.agenda_import_key ? "Agenda" : "Local");
      }
      existing.createdAt = earliestTimestamp(existing.createdAt, source.created_at);
      existing.localCustomerId = source.id;
      if (!linkedCopy) existing.name = source.full_name ? formatContactName(source.full_name) : existing.name;
      if (!linkedCopy || !existing.companyName) existing.companyName = source.company_name || undefined;
      existing.address = linkedCopy ? existing.address || source.address || undefined : source.address || existing.address;
      existing.email = linkedCopy ? existing.email || email : email || existing.email;
      if (existing.email) customerByEmail.set(existing.email.trim().toLowerCase(), existing);
      existing.phone = linkedCopy ? existing.phone || source.phone || "" : source.phone || existing.phone;
      existing.city = linkedCopy ? existing.city || source.city || "" : source.city || existing.city;
      existing.country = linkedCopy ? existing.country || countryDisplayName(source.country || "") : source.country ? countryDisplayName(source.country) : existing.country;
      existing.birthDate = linkedCopy ? existing.birthDate || source.birth_date || "" : source.birth_date || existing.birthDate;
      existing.firstPurchaseDate = source.first_purchase_date || "";
      existing.lastPurchaseDate = source.last_purchase_date || "";
      existing.notes = source.notes || "";
      existing.department = source.department || existing.department;
      existing.postalCode = source.postal_code || existing.postalCode;
      existing.raffleProductInterest = source.product_interest || existing.raffleProductInterest;
      existing.agendaInferredCategory = source.agenda_inferred_category || undefined;
      existing.agendaAdditionalPhones = source.agenda_additional_phones || [];
      if (source.agenda_import_key) existing.sourceChannels = [...new Set([...(existing.sourceChannels || []), "Agenda" as const])];
      if (linkedCopy && source.customer_type) existing.segment = source.customer_type;
      else if (source.customer_type === "Mayorista") existing.segment = "Mayorista";
    } else {
      const contact: Customer = {
        id: canonicalId, localCustomerId: source.id, name: formatContactName(source.full_name), companyName: source.company_name || undefined, email,
        phone: source.phone || "", birthDate: source.birth_date || "", address: source.address || undefined,
        firstPurchaseDate: source.first_purchase_date || "", lastPurchaseDate: source.last_purchase_date || "",
        notes: source.notes || "", city: source.city || "", country: countryDisplayName(source.country || ""),
        department: source.department || undefined, postalCode: source.postal_code || undefined,
        raffleProductInterest: source.product_interest || undefined,
        agendaInferredCategory: source.agenda_inferred_category || undefined,
        agendaAdditionalPhones: source.agenda_additional_phones || [],
        sourceChannels: source.agenda_import_key ? ["Agenda"] : [],
        originChannel: source.origin_channel || (source.agenda_import_key ? "Agenda" : "Local"),
        createdAt: source.created_at, segment: source.customer_type || "Minorista",
      };
      customers.set(canonicalId, contact);
      if (email) customerByEmail.set(email.toLowerCase(), contact);
    }
  }
  for (const source of snapshot.ruralRaffleEntries || []) {
    const email = source.email.trim().toLowerCase();
    const existing = customers.get(`sorteo:${source.id}`) || (email ? customerByEmail.get(email) : undefined);
    if (existing) {
      existing.raffleEntryId = source.id;
      existing.raffleProductInterest = source.product_interest;
      existing.companyName ||= source.company_name || undefined;
      existing.address ||= source.address || undefined;
      existing.phone ||= source.phone;
      existing.city ||= source.city || "";
      existing.country ||= countryDisplayName(source.country || "");
      existing.birthDate ||= source.birth_date || "";
      existing.department ||= source.department || undefined;
      existing.postalCode ||= source.postal_code || undefined;
      existing.agendaAdditionalPhones ||= source.additional_phones || [];
      existing.agendaInferredCategory ||= source.inferred_category || undefined;
      existing.sourceChannels = [...new Set<CustomerSourceChannel>([...(existing.sourceChannels || []), "Sorteo"])];
      if (!existing.createdAt || source.created_at < existing.createdAt) { existing.originChannel = "Sorteo"; existing.createdAt = source.created_at; }
      if (!existing.notes) existing.notes = `Interés del sorteo: ${ruralInterestLabel[source.product_interest] || source.product_interest}`;
      continue;
    }
    const contact: Customer = {
      id: `sorteo:${source.id}`,
      raffleEntryId: source.id,
      raffleProductInterest: source.product_interest,
      companyName: source.company_name || undefined,
      address: source.address || undefined,
      name: formatContactName(source.full_name || "Participante del sorteo"),
      email,
      phone: source.phone,
      birthDate: source.birth_date || "",
      city: source.city || "",
      country: countryDisplayName(source.country || ""),
      department: source.department || undefined, postalCode: source.postal_code || undefined,
      agendaAdditionalPhones: source.additional_phones || [], agendaInferredCategory: source.inferred_category || undefined,
      segment: source.customer_type || "Minorista",
      notes: source.notes || `Interés del sorteo: ${ruralInterestLabel[source.product_interest] || source.product_interest}`,
      sourceChannels: ["Sorteo"],
      originChannel: source.origin_channel || "Sorteo", createdAt: source.created_at,
    };
    customers.set(contact.id, contact);
    if (email) customerByEmail.set(email, contact);
  }
  // El origen es el primer canal por el que entró la persona: lo calcula la base para que Clientes y Marketing coincidan.
  const originByContact = new Map((snapshot.contactOrigins || []).map((row) => [row.contact_key, row.origin as CustomerSourceChannel]));
  const firstSeenByContact = new Map((snapshot.contactFirstSeen || []).map((row) => [row.contact_key, row.first_seen_at]));
  for (const customer of customers.values()) {
    const email = customer.email?.trim().toLowerCase();
    const phone = (customer.phone || "").replace(/[^0-9]+/g, "");
    const origin = (email && originByContact.get(`email:${email}`)) || (!email && phone ? originByContact.get(`phone:${phone}`) : undefined);
    if (origin) customer.originChannel = origin;
    customer.createdAt = earliestTimestamp(customer.createdAt, email ? firstSeenByContact.get(`email:${email}`) : undefined, phone ? firstSeenByContact.get(`phone:${phone}`) : undefined);
  }
  const localOrders: Order[] = (snapshot.localSales || []).map((source) => {
    if (source.currency !== "UYU") throw new Error(`La venta local #${source.sale_number} requiere conversión de ${source.currency}.`);
    const items: OrderLine[] = source.local_sale_items.map((item) => {
      const catalog = products.find((product) => product.id === item.variant_id);
      return {
        id: item.id, productId: item.variant_id || item.id, title: item.product_name,
        productName: item.product_name, options: catalog?.options, personalization: item.customization || undefined, productionNotes: item.production_notes || undefined,
        weightGrams: catalog?.weightGrams,
        sku: item.sku || "", quantity: item.quantity, unitPrice: Number(item.unit_price_minor) / 100,
        amount: Number(item.line_total_minor) / 100, family: item.customization ? "Personalizados" : catalog?.family || "",
        variant: item.variant_name, rim: catalog?.rim || "", leather: catalog?.leather || "",
        productionStatus: "", reviewStatus: null, orderType: item.customization ? "local_design" : undefined,
      };
    });
    const charged = Number(source.total_minor) / 100;
    const itemsAmount = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      id: source.id, number: source.sale_number, referenceCode: source.reference_code, source: "local", status: "local_sale",
      customerId: source.customer_id ? localCustomerIds.get(source.customer_id) || `local:${source.customer_id}` : `local-anon:${source.id}`,
      customerName: source.customer_name, productId: items[0]?.productId || source.id,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0), unitPrice: 0,
      items, totalAmount: source.deposit_minor != null || source.payment_method === "Seña" ? Math.max(charged, itemsAmount) : charged,
      localItemsAmount: itemsAmount, depositAmount: source.deposit_minor == null ? (source.payment_method === "Seña" ? charged : undefined) : Number(source.deposit_minor) / 100, paymentMethod: source.payment_method,
      channel: source.channel && ["Feria", "Instagram", "Facebook", "WhatsApp"].includes(source.channel) ? source.channel : "Local", date: source.sold_on, due: "", production: "No aplica", delivery: "No aplica", method: "No aplica",
      design: false, approved: true,
    };
  });
  return {
    ...state, products, orders: [...orders, ...localOrders].sort((a, b) => b.date.localeCompare(a.date)), customers: [...customers.values()],
    payments: snapshot.payments.filter((payment) => payment.status === "approved" && orderIds.has(payment.order_id)).map((payment): Payment => {
      const order = snapshot.orders.find((order) => order.id === payment.order_id)!;
      const originalMinor = Number(payment.amount_minor);
      const historicalUsd = Number(order.paypal_amount_usd_minor);
      const baseUyu = Number(order.total_minor);
      const validAmount = Number.isSafeInteger(originalMinor) && originalMinor >= 0;
      const canConvert = payment.currency === "USD" && order.currency === "UYU"
        && Number.isSafeInteger(historicalUsd) && historicalUsd > 0 && Number.isSafeInteger(baseUyu) && baseUyu > 0;
      const amount = !validAmount ? null : payment.currency === "UYU" ? originalMinor / 100
        : canConvert ? Math.round(originalMinor * baseUyu / historicalUsd) / 100 : null;
      return {
        id: payment.id, orderId: payment.order_id, amount,
        sourceCurrency: payment.currency, sourceAmount: originalMinor / 100,
        reconciliationRequired: amount == null || (payment.currency === "USD" && originalMinor !== historicalUsd),
        date: commerceDate(payment.approved_at || payment.created_at), method: payment.provider,
      };
    }).concat((snapshot.localSales || []).filter((sale) => Number(sale.total_minor) > 0).map((sale) => ({
      id: `local:${sale.id}`, orderId: sale.id, amount: Number(sale.total_minor) / 100,
      date: sale.sold_on, method: sale.payment_method,
    })), (snapshot.localReceipts || []).map((receipt) => ({
      id: `local-receipt:${receipt.id}`, orderId: receipt.sale_id, amount: Number(receipt.amount_minor) / 100,
      date: receipt.paid_on, method: receipt.payment_method,
    }))),
    records: {
      monedas: snapshot.reference.exchangeRates.map((rate) => ({ id: rate.currency_code, moneda: rate.currency_code, valor: Number(rate.rate_to_uyu) })),
      "marketing/descuentos": snapshot.reference.discounts.map((discount) => ({ id: discount.id, codigo: discount.code, tipo: discount.discount_type === "percentage" ? "Porcentaje" : "Monto UYU", valor: discount.discount_type === "percentage" ? Number(discount.value) : Number(discount.value) / 100, desde: discount.valid_from, fecha: discount.valid_until, estado: discount.enabled ? "Activo" : "Pausado" })),
      "productos/categorias": snapshot.reference.categories.map((category) => ({ id: category.code, nombre: category.label_es, atributos: "", variantes: "", estado: category.active ? "Activa" : "Inactiva" })),
      "administracion/canales": [
        { id: "commerce_enabled", nombre: "Comercio web", tipo: "Canal", detalle: "", estado: snapshot.reference.settings.commerce_enabled ? "Habilitado" : "Deshabilitado" },
        { id: "mercado_pago_enabled", nombre: "Mercado Pago", tipo: "Medio de pago", detalle: "", estado: snapshot.reference.settings.mercado_pago_enabled ? "Habilitado" : "Deshabilitado" },
        { id: "paypal_enabled", nombre: "PayPal", tipo: "Medio de pago", detalle: "", estado: snapshot.reference.settings.paypal_enabled ? "Habilitado" : "Deshabilitado" },
      ],
    },
  };
}
