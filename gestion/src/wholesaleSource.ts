import { commerceSource } from "./commerceSource";

export type WholesaleProduct = {
  id: string; model: string; variant: string; rim_type: string | null;
  leather_type: string | null; price_arg: number; price_uyu: number;
};
export type WholesaleCustomer = {
  full_name: string; first_name: string | null; last_name: string | null;
  phone: string | null; email: string | null; address: string | null; notes: string | null;
};
export type WholesaleLine = {
  line_id: string; order_id: string | null; created_at: string | null;
  completed_at: string | null; customer: string; model: string; variant: string;
  quantity: number; status: string; order_type: string | null;
  unit_price_arg: number | null; unit_price_uyu: number | null;
  exchange_rate: number | null; total_arg: number | null; total_uyu: number | null;
};
export type WholesaleSnapshot = {
  products: WholesaleProduct[]; customers: WholesaleCustomer[];
  lines: WholesaleLine[]; exchangeRate: number;
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
  const [products, customers, lines, settings] = await Promise.all([
    pages<WholesaleProduct>("products", "id"),
    pages<WholesaleCustomer>("customers", "full_name"),
    pages<WholesaleLine>("order_lines", "line_id"),
    client().from("settings").select("exchange_rate").eq("id", 1).single(),
  ]);
  if (settings.error) throw settings.error;
  return { products, customers, lines, exchangeRate: Number(settings.data.exchange_rate) };
}
export async function saveWholesaleCustomer(input: WholesaleCustomer, previousName?: string) {
  const name = clean(input.full_name);
  if (!name) throw new Error("Ingresá el nombre del cliente.");
  const parts = name.split(/\s+/);
  const payload = { ...input, full_name: name, first_name: clean(input.first_name || "") || parts[0], last_name: clean(input.last_name || "") || parts.slice(1).join(" ") };
  if (!previousName) {
    const { error } = await client().from("customers").insert(payload);
    if (error) throw error;
  } else {
    const { error } = await client().from("customers").update(payload).eq("full_name", previousName);
    if (error) throw error;
  }
}
export async function saveWholesaleProduct(input: WholesaleProduct, previousId?: string) {
  if (!clean(input.model) || !clean(input.variant)) throw new Error("Modelo y variante son obligatorios.");
  if (!Number.isFinite(input.price_arg) || input.price_arg < 0) throw new Error("El precio ARS debe ser válido.");
  const { data: settings, error: rateError } = await client().from("settings").select("exchange_rate").eq("id", 1).single();
  if (rateError) throw rateError;
  const rate = Number(settings.exchange_rate);
  const payload = { id: input.id, model: clean(input.model), variant: clean(input.variant), rim_type: clean(input.rim_type || ""), leather_type: clean(input.leather_type || ""), price_arg: input.price_arg, price_uyu: input.price_arg * rate };
  if (previousId) {
    const { id: _id, ...changes } = payload;
    const { error } = await client().from("products").update(changes).eq("id", previousId);
    if (error) throw error;
  } else {
    const { error } = await client().from("products").insert(payload);
    if (error) throw error;
  }
}
export async function nextWholesaleProductId() {
  const products = await pages<{ id: string }>("products", "id");
  return String(Math.max(0, ...products.map((item) => Number(item.id) || 0)) + 1);
}
export async function createWholesaleOrder(customer: string, items: { productId: string; quantity: number; noCost: boolean }[]) {
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
    if (!product) throw new Error("Uno de los productos ya no existe. Actualizá el catálogo.");
    const count = quantity(item.quantity);
    const priceArg = item.noCost ? 0 : Number(product.price_arg) || 0;
    const priceUyu = item.noCost ? 0 : Number(product.price_uyu) || priceArg * rate;
    return { line_id: `line-${crypto.randomUUID()}`, order_id: orderId, created_at: now, customer: clean(customer), model: product.model, variant: product.variant, quantity: count, status: "Pendiente", order_type: item.noCost ? "no_cost" : "normal", unit_price_arg: priceArg, unit_price_uyu: priceUyu, exchange_rate: rate, total_arg: priceArg * count, total_uyu: priceUyu * count };
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
