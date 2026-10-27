import { commerceSource, type CommerceImage, type CommerceVariant } from "./commerceSource";
import { imageForVariant } from "./catalogImages";
import { GENERIC_WHOLESALE_VARIANT, genericVariantPriceConflict } from "./wholesaleSaleSelection";
import { applyDiscount } from "./wholesaleDiscount";

export type WholesaleProduct = {
  id: string; model: string; variant: string; rim_type: string | null;
  leather_type: string | null; price_arg: number; price_uyu: number;
  category_code?: string | null; description?: string | null;
  sku?: string | null; weight_grams?: number | null;
  available_local?: boolean; available_web?: boolean; available_wholesale?: boolean;
  catalog_attributes?: Record<string, unknown>;
  commerce_product_id?: string | null; commerce_variant_id?: string | null;
  image_path?: string | null; image_crop?: Record<string, unknown>;
};
export type WholesaleProductImage = {
  id: string; product_id: string; storage_path: string; original_name: string;
  alt_text: string; mime_type: string; byte_size: number; sort_order: number;
  option_values: Record<string, unknown>;
};
export type WholesaleCustomer = {
  full_name: string; first_name: string | null; last_name: string | null;
  phone: string | null; email: string | null; address: string | null; notes: string | null;
  company_name?: string | null; birth_date?: string | null; city?: string | null; country?: string | null;
  department?: string | null; postal_code?: string | null; additional_phones?: string[];
  inferred_category?: string | null; product_interest?: string | null;
  origin_channel?: "Local" | "Web" | "WhatsApp" | "Instagram" | "Facebook" | "Feria" | "Agenda" | "Sorteo";
  customer_type?: "Minorista" | "Mayorista";
};
export type WholesaleLine = {
  line_id: string; order_id: string | null; created_at: string | null;
  completed_at: string | null; customer: string; model: string; variant: string;
  quantity: number; status: string; order_type: string | null;
  unit_price_arg: number | null; unit_price_uyu: number | null;
  exchange_rate: number | null; total_arg: number | null; total_uyu: number | null;
  sale_channel?: "Local" | "Web" | "WhatsApp" | "Instagram" | "Facebook" | "Feria";
  discount_percent?: number | null;
};
export type WholesaleSnapshot = {
  products: WholesaleProduct[]; customers: WholesaleCustomer[];
  lines: WholesaleLine[]; images: WholesaleProductImage[];
  categories: { code: string; label_es: string; active: boolean }[];
  exchangeRate: number;
};

const client = () => {
  if (!commerceSource) throw new Error("No está configurada la conexión con Supabase.");
  return commerceSource;
};
const clean = (value: string) => value.trim();
const quantity = (value: number) => {
  if (!Number.isInteger(value) || value < 1) throw new Error("La cantidad debe ser un entero positivo.");
  return value;
};
async function pages<T>(table: string, order: string): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; ; start += 100) {
    const { data, count, error } = await client().from(table).select("*", { count: "exact" }).order(order).range(start, start + 99);
    if (error) throw error;
    result.push(...(data || []) as T[]);
    if (result.length >= (count ?? result.length)) return result;
    if (!data?.length) throw new Error(`La lectura de ${table} quedó incompleta.`);
  }
}
const CATALOG_SELECT = "id,name,category,category_code,description,attributes,commerce_variants(id,sku,name,active,base_price_minor,wholesale_price_arg,available_local,available_web,available_wholesale,weight_grams,rim_type,leather_type,color,option_values),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id,option_values)";
type CatalogVariantRow = Omit<CommerceVariant, "wholesale_price_arg"> & { wholesale_price_arg: number | string | null; available_local?: boolean | null; available_web?: boolean | null; available_wholesale?: boolean | null; weight_grams?: number | null; rim_type?: string | null; leather_type?: string | null };
type CatalogRow = { id: string; name: string; category: string | null; category_code: string | null; description: string | null; attributes: Record<string, unknown> | null; commerce_variants: CatalogVariantRow[]; commerce_product_images: (CommerceImage & { original_name?: string; mime_type?: string; byte_size?: number })[] };
async function readCatalogRows(): Promise<CatalogRow[]> {
  const result: CatalogRow[] = [];
  for (let start = 0; ; start += 100) {
    const { data, count, error } = await client().from("commerce_products").select(CATALOG_SELECT, { count: "exact" }).order("id").range(start, start + 99);
    if (error) throw error;
    result.push(...(data || []) as unknown as CatalogRow[]);
    if (result.length >= (count ?? result.length)) return result;
    if (!data?.length) throw new Error("La lectura del catálogo quedó incompleta.");
  }
}
/** El mayorista lee el catálogo único: cada variante con mayorista activo es un producto mayorista. */
export function wholesaleFromCatalog(rows: CatalogRow[], rate: number): { products: WholesaleProduct[]; images: WholesaleProductImage[] } {
  const products: WholesaleProduct[] = [];
  const images: WholesaleProductImage[] = [];
  for (const row of rows) {
    for (const variant of row.commerce_variants || []) {
      if (variant.available_wholesale !== true) continue;
      const priceArg = Number(variant.wholesale_price_arg) || 0;
      products.push({
        id: variant.id, model: row.name, variant: variant.name, rim_type: variant.rim_type ?? null, leather_type: variant.leather_type ?? null,
        price_arg: priceArg, price_uyu: priceArg * rate, category_code: row.category_code || row.category, description: row.description,
        sku: variant.sku, weight_grams: variant.weight_grams ?? null, available_local: variant.available_local !== false, available_web: variant.available_web !== false,
        available_wholesale: true, catalog_attributes: row.attributes || {}, commerce_product_id: row.id, commerce_variant_id: variant.id,
      });
      const cover = imageForVariant(row.commerce_product_images || [], variant as unknown as CommerceVariant) as (typeof row.commerce_product_images)[number] | undefined;
      if (cover) images.push({ id: cover.id, product_id: variant.id, storage_path: cover.storage_path, original_name: cover.original_name ?? "", alt_text: cover.alt_text, mime_type: cover.mime_type ?? "", byte_size: cover.byte_size ?? 0, sort_order: cover.sort_order, option_values: cover.option_values || {} });
    }
  }
  return { products, images };
}
export async function readWholesale(): Promise<WholesaleSnapshot> {
  const [catalog, customers, lines, categories, settings] = await Promise.all([
    readCatalogRows(),
    pages<WholesaleCustomer>("customers", "full_name"),
    pages<WholesaleLine>("order_lines", "line_id"),
    client().from("commerce_categories").select("code,label_es,active").order("sort_order"),
    client().from("settings").select("exchange_rate").eq("id", 1).single(),
  ]);
  if (settings.error) throw settings.error;
  if (categories.error) throw categories.error;
  const exchangeRate = Number(settings.data.exchange_rate);
  const { products, images } = wholesaleFromCatalog(catalog, exchangeRate);
  return { products, customers, lines, images, categories: categories.data || [], exchangeRate };
}
export async function saveWholesaleCustomer(input: WholesaleCustomer, previousName?: string) {
  const name = clean(input.full_name);
  if (!name) throw new Error("Ingresá el nombre del cliente.");
  const parts = name.split(/\s+/);
  const payload = { ...input, full_name: name, first_name: clean(input.first_name || "") || parts[0], last_name: clean(input.last_name || "") || parts.slice(1).join(" ") };
  if (!previousName) {
    const { error } = await client().from("customers").insert(payload).select("full_name").single();
    if (error) throw error;
  } else {
    const { error } = await client().from("customers").update(payload).eq("full_name", previousName).select("full_name").single();
    if (error) throw error;
  }
}
export async function countWholesaleCustomerLines(fullName: string): Promise<number> {
  const { count, error } = await client().from("order_lines")
    .select("line_id", { count: "exact", head: true }).eq("customer", fullName);
  if (error) throw error;
  if (typeof count !== "number") throw new Error("No se pudo comprobar el historial del cliente. Intentá de nuevo.");
  return count;
}
export async function deleteWholesaleCustomer(fullName: string): Promise<void> {
  if (!clean(fullName)) throw new Error("No se identificó el cliente que querés eliminar.");
  const lines = await countWholesaleCustomerLines(fullName);
  if (lines > 0) throw new Error(`No se puede eliminar este cliente: tiene ${lines} ${lines === 1 ? "línea de pedido vinculada" : "líneas de pedido vinculadas"}. La ficha y el historial se conservaron.`);
  const { error } = await client().from("customers").delete().eq("full_name", fullName).select("full_name").single();
  if (error?.code === "23503") throw new Error("No se puede eliminar este cliente porque ya tiene pedidos vinculados. La ficha y el historial se conservaron.");
  if (error) throw error;
}
const imageBucket = () => client().storage.from("product-images");
export const wholesaleProductImageUrl = (path: string) => imageBucket().getPublicUrl(path).data.publicUrl;

export async function createWholesaleOrder(customer: string, items: { productId: string; quantity: number; noCost: boolean; generic?: boolean }[], saleChannel: WholesaleLine["sale_channel"] = "WhatsApp", discountPercent = 0) {
  if (!clean(customer) || !items.length) throw new Error("Seleccioná cliente y al menos un artículo.");
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error("El descuento tiene que estar entre 0% y 100%.");
  const { data: settings, error: rateError } = await client().from("settings").select("exchange_rate").eq("id", 1).single();
  if (rateError) throw rateError;
  const rate = Number(settings.exchange_rate);
  const catalog = wholesaleFromCatalog(await readCatalogRows(), rate).products;
  const byId = new Map(catalog.map((item) => [item.id, item]));
  for (const model of new Set(items.filter((item) => item.generic).map((item) => byId.get(item.productId)?.model).filter((value): value is string => !!value))) {
    if (genericVariantPriceConflict(catalog.filter((item) => item.model === model))) throw new Error(`Los colores de "${model}" tienen precios distintos: elegí una variante concreta.`);
  }
  // El número del pedido (#M001…) lo asigna la base con la misma secuencia de los pedidos mayoristas de la web.
  const { data: orderId, error: codeError } = await client().rpc("gestion_next_wholesale_order_code");
  if (codeError || typeof orderId !== "string" || !orderId) throw new Error("No se pudo asignar un número de pedido. Reintentá.");
  const now = new Date().toISOString();
  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || product.available_wholesale === false) throw new Error("Uno de los productos ya no está disponible para mayoristas. Actualizá el catálogo.");
    const count = quantity(item.quantity);
    const priceArg = item.noCost ? 0 : Number(product.price_arg) || 0;
    const priceUyu = item.noCost ? 0 : Number(product.price_uyu) || priceArg * rate;
    return { line_id: `line-${crypto.randomUUID()}`, order_id: orderId, created_at: now, customer: clean(customer), model: product.model, variant: item.generic ? GENERIC_WHOLESALE_VARIANT : product.variant, quantity: count, status: "Pendiente", order_type: item.noCost ? "no_cost" : "normal", sale_channel: saleChannel, unit_price_arg: priceArg, unit_price_uyu: priceUyu, exchange_rate: rate, total_arg: applyDiscount(priceArg * count, discountPercent), total_uyu: applyDiscount(priceUyu * count, discountPercent), discount_percent: discountPercent || null };
  });
  const { error } = await client().from("order_lines").insert(lines);
  if (error) throw error;
  return orderId;
}
export async function updateWholesaleLine(line: WholesaleLine, changes: { quantity: number; status: string; model: string; variant: string; customer: string; orderId: string }) {
  const count = quantity(changes.quantity);
  const nextStatus = changes.status === "En producción" ? "En producción" : "Pendiente";
  const patch: Record<string, unknown> = { quantity: count, status: nextStatus, model: clean(changes.model), variant: clean(changes.variant), customer: clean(changes.customer), order_id: clean(changes.orderId) || null };
  if (!patch.model || !patch.variant) throw new Error("Modelo y variante son obligatorios.");
  if (!patch.customer) throw new Error("El cliente es obligatorio.");
  // Una línea histórica sin snapshot adopta el precio actual al editarse, como en el dashboard.
  if (count !== Number(line.quantity)) {
    let arg = line.order_type === "no_cost" ? 0 : line.unit_price_arg;
    let uyu = line.order_type === "no_cost" ? 0 : line.unit_price_uyu;
    let rate = line.exchange_rate;
    if (arg == null || uyu == null) {
      const snapshot = await readWholesale();
      const match = snapshot.products.find((item) => item.model.trim().localeCompare(changes.model.trim(), "es", { sensitivity: "base" }) === 0 && item.variant.trim().localeCompare(changes.variant.trim(), "es", { sensitivity: "base" }) === 0);
      if (!match) throw new Error("No se encontró el producto para recalcular el total.");
      arg = Number(match.price_arg); uyu = Number(match.price_uyu); rate = rate ?? snapshot.exchangeRate;
    }
    patch.unit_price_arg = arg; patch.unit_price_uyu = uyu; patch.exchange_rate = rate;
    // El descuento del pedido se mantiene al cambiar la cantidad.
    const discount = Number(line.discount_percent) || 0;
    patch.total_arg = applyDiscount(Number(arg) * count, discount); patch.total_uyu = applyDiscount(Number(uyu) * count, discount);
  }
  const { error } = await client().from("order_lines").update(patch).eq("line_id", line.line_id);
  if (error) throw error;
}
export type WholesaleDiscountRow = { lineId: string; quantity: number; noCost: boolean; unitArg: number; unitUyu: number; exchangeRate: number };
/** Aplica (o quita, con 0) el descuento a todas las líneas del pedido, recalculando desde el precio unitario. */
export async function setWholesaleOrderDiscount(rows: WholesaleDiscountRow[], percent: number) {
  if (!rows.length) throw new Error("El pedido no tiene líneas.");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("El descuento tiene que estar entre 0% y 100%.");
  for (const row of rows) {
    const patch = row.noCost
      ? { discount_percent: percent || null }
      : { unit_price_arg: row.unitArg, unit_price_uyu: row.unitUyu, exchange_rate: row.exchangeRate, total_arg: applyDiscount(row.unitArg * row.quantity, percent), total_uyu: applyDiscount(row.unitUyu * row.quantity, percent), discount_percent: percent || null };
    const { data, error } = await client().from("order_lines").update(patch).eq("line_id", row.lineId).select("line_id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Una de las líneas ya no existe. Actualizá el pedido e intentá de nuevo.");
  }
}
export async function completeWholesaleLine(lineId: string) {
  const { error } = await client().from("order_lines").update({ status: "Completado", completed_at: new Date().toISOString() }).eq("line_id", lineId);
  if (error) throw error;
}
export async function deleteWholesaleLine(lineId: string) {
  const { data, error } = await client().from("order_lines").delete().eq("line_id", lineId).select("line_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La línea no existe o no tenés permiso para eliminarla.");
}
export async function saveWholesaleExchangeRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("La cotización debe ser positiva.");
  const { error } = await client().from("settings").update({ exchange_rate: rate }).eq("id", 1);
  if (error) throw error;
}
