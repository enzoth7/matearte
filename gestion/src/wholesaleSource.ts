import { commerceSource } from "./commerceSource";

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
export async function readWholesale(): Promise<WholesaleSnapshot> {
  const [products, customers, lines, images, categories, settings] = await Promise.all([
    pages<WholesaleProduct>("products", "id"),
    pages<WholesaleCustomer>("customers", "full_name"),
    pages<WholesaleLine>("order_lines", "line_id"),
    pages<WholesaleProductImage>("wholesale_product_images", "id"),
    client().from("commerce_categories").select("code,label_es,active").order("sort_order"),
    client().from("settings").select("exchange_rate").eq("id", 1).single(),
  ]);
  if (settings.error) throw settings.error;
  if (categories.error) throw categories.error;
  return { products, customers, lines, images, categories: categories.data || [], exchangeRate: Number(settings.data.exchange_rate) };
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
export async function saveWholesaleProduct(input: WholesaleProduct, previousId?: string) {
  if (!clean(input.model) || !clean(input.variant)) throw new Error("Modelo y variante son obligatorios.");
  if (!Number.isFinite(input.price_arg) || input.price_arg < 0) throw new Error("El precio ARS debe ser válido.");
  if (input.weight_grams != null && (!Number.isInteger(input.weight_grams) || input.weight_grams < 0)) throw new Error("El peso debe ser un entero no negativo.");
  const payload = { id: input.id, model: clean(input.model), variant: clean(input.variant), rim_type: clean(input.rim_type || ""), leather_type: clean(input.leather_type || ""), price_arg: input.price_arg, category_code: clean(input.category_code || "") || null, description: clean(input.description || ""), sku: clean(input.sku || "") || null, weight_grams: input.weight_grams ?? null, available_local: input.available_local === true, available_web: input.available_web === true, available_wholesale: input.available_wholesale !== false, catalog_attributes: input.catalog_attributes || {} };
  if (previousId) {
    const { data: previous, error: previousError } = await client().from("products").select("price_arg,model,variant").eq("id", previousId).single();
    if (previousError) throw previousError;
    const { id: _id, price_arg: _priceArg, ...changes } = payload;
    let priceChange: { price_arg?: number; price_uyu?: number } = {};
    if (Number(previous.price_arg) !== input.price_arg) {
      const { data: settings, error: rateError } = await client().from("settings").select("exchange_rate").eq("id", 1).single();
      if (rateError) throw rateError;
      priceChange = { price_arg: input.price_arg, price_uyu: input.price_arg * Number(settings.exchange_rate) };
    }
    const { data, error } = await client().from("products").update({ ...changes, ...priceChange }).eq("id", previousId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar el producto mayorista. Verificá tus permisos y volvé a intentar.");
    if (previous.model !== payload.model || previous.variant !== payload.variant) {
      const { error: historyError } = await client().from("order_lines")
        .update({ model: payload.model, variant: payload.variant })
        .eq("model", previous.model).eq("variant", previous.variant);
      if (historyError) throw new Error("El producto se guardó, pero no se pudieron actualizar sus nombres en el dashboard.");
    }
  } else {
    const { data: settings, error: rateError } = await client().from("settings").select("exchange_rate").eq("id", 1).single();
    if (rateError) throw rateError;
    const { error } = await client().from("products").insert({ ...payload, price_uyu: input.price_arg * Number(settings.exchange_rate) }).select("id").single();
    if (error) throw error;
  }
}
const imageBucket = () => client().storage.from("product-images");
export const wholesaleProductImageUrl = (path: string) => imageBucket().getPublicUrl(path).data.publicUrl;

export async function uploadWholesaleProductImages(productId: string, files: File[], startOrder: number, altText: string): Promise<number> {
  let uploaded = 0;
  for (const [index, file] of files.entries()) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`“${file.name}” no es PNG, JPEG ni WebP.`);
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error(`“${file.name}” supera el máximo de 10 MB o está vacío.`);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `wholesale/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await imageBucket().upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: rowError } = await client().from("wholesale_product_images").insert({ product_id: productId, storage_path: path, original_name: file.name.slice(0, 240), alt_text: altText, mime_type: file.type, byte_size: file.size, sort_order: startOrder + index });
    if (rowError) {
      await imageBucket().remove([path]);
      throw rowError;
    }
    uploaded += 1;
  }
  return uploaded;
}

export async function setWholesaleProductImageCover(image: WholesaleProductImage, firstOrder: number) {
  const { error } = await client().from("wholesale_product_images").update({ sort_order: firstOrder - 1 }).eq("id", image.id).eq("product_id", image.product_id).select("id").single();
  if (error) throw error;
}

export async function saveWholesaleProductImageCrop(image: WholesaleProductImage, crop: { x: number; y: number; zoom: number }) {
  const optionValues = { ...image.option_values, cover_x: Math.round(crop.x * 100) / 100, cover_y: Math.round(crop.y * 100) / 100, cover_zoom: Math.round(crop.zoom * 100) / 100 };
  const { error } = await client().from("wholesale_product_images").update({ option_values: optionValues }).eq("id", image.id).eq("product_id", image.product_id).select("id").single();
  if (error) throw error;
}

export async function saveWholesaleProductImageColor(image: WholesaleProductImage, color: string) {
  const optionValues = { ...image.option_values };
  if (color) optionValues.color = color;
  else delete optionValues.color;
  const { error } = await client().from("wholesale_product_images").update({ option_values: optionValues }).eq("id", image.id).eq("product_id", image.product_id).select("id").single();
  if (error) throw error;
}

export async function moveWholesaleProductImage(image: WholesaleProductImage, target: WholesaleProduct, nextOrder: number): Promise<boolean> {
  if (image.product_id === target.id) throw new Error("Elegí otro producto para mover la foto.");
  const extension = image.mime_type === "image/png" ? "png" : image.mime_type === "image/webp" ? "webp" : "jpg";
  const nextPath = `wholesale/${target.id}/${crypto.randomUUID()}.${extension}`;
  const { error: copyError } = await imageBucket().copy(image.storage_path, nextPath);
  if (copyError) throw copyError;
  const { error: rowError } = await client().from("wholesale_product_images").update({
    product_id: target.id,
    storage_path: nextPath,
    alt_text: `Foto de ${target.model} · ${target.variant}`,
    sort_order: nextOrder,
  }).eq("id", image.id).eq("product_id", image.product_id).select("id").single();
  if (rowError) {
    await imageBucket().remove([nextPath]);
    throw rowError;
  }
  const { error: cleanupError } = await imageBucket().remove([image.storage_path]);
  return Boolean(cleanupError);
}

export async function deleteWholesaleProductImage(image: WholesaleProductImage) {
  const { error: rowError } = await client().from("wholesale_product_images").delete().eq("id", image.id).eq("product_id", image.product_id).select("id").single();
  if (rowError) throw rowError;
  const { error: storageError } = await imageBucket().remove([image.storage_path]);
  if (storageError) throw new Error("La foto se quitó de la ficha, pero el archivo requiere limpieza manual.");
}
export async function nextWholesaleProductId() {
  const products = await pages<{ id: string }>("products", "id");
  return String(Math.max(0, ...products.map((item) => Number(item.id) || 0)) + 1);
}
export async function createWholesaleOrder(customer: string, items: { productId: string; quantity: number; noCost: boolean }[], saleChannel: WholesaleLine["sale_channel"] = "WhatsApp") {
  if (!clean(customer) || !items.length) throw new Error("Seleccioná cliente y al menos un artículo.");
  const { data: settings, error: rateError } = await client().from("settings").select("exchange_rate").eq("id", 1).single();
  if (rateError) throw rateError;
  const rate = Number(settings.exchange_rate);
  const productIds = [...new Set(items.map((item) => item.productId))];
  const { data: products, error: productError } = await client().from("products").select("*").in("id", productIds);
  if (productError) throw productError;
  const byId = new Map((products as WholesaleProduct[]).map((item) => [String(item.id), item]));
  // El identificador visible conserva el formato del dashboard anterior.
  let orderId = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
    const { count, error } = await client().from("order_lines").select("line_id", { count: "exact", head: true }).eq("order_id", candidate);
    if (error) throw error;
    if (!count) { orderId = candidate; break; }
  }
  if (!orderId) throw new Error("No se pudo asignar un número de pedido. Reintentá.");
  const now = new Date().toISOString();
  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || product.available_wholesale === false) throw new Error("Uno de los productos ya no está disponible para mayoristas. Actualizá el catálogo.");
    const count = quantity(item.quantity);
    const priceArg = item.noCost ? 0 : Number(product.price_arg) || 0;
    const priceUyu = item.noCost ? 0 : Number(product.price_uyu) || priceArg * rate;
    return { line_id: `line-${crypto.randomUUID()}`, order_id: orderId, created_at: now, customer: clean(customer), model: product.model, variant: product.variant, quantity: count, status: "Pendiente", order_type: item.noCost ? "no_cost" : "normal", sale_channel: saleChannel, unit_price_arg: priceArg, unit_price_uyu: priceUyu, exchange_rate: rate, total_arg: priceArg * count, total_uyu: priceUyu * count };
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
    patch.total_arg = Number(arg) * count; patch.total_uyu = Number(uyu) * count;
  }
  const { error } = await client().from("order_lines").update(patch).eq("line_id", line.line_id);
  if (error) throw error;
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
  const products = await pages<WholesaleProduct>("products", "id");
  for (const product of products) {
    const { error: productError } = await client().from("products").update({ price_uyu: Number(product.price_arg) * rate }).eq("id", product.id);
    if (productError) throw productError;
  }
}
