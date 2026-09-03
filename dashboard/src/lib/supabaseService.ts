import { supabase } from "./supabaseClient";
import type {
  CustomerProfile,
  DashboardData,
  DraftOrderItem,
  Product,
  ProductionItem,
} from "../types";

function getClient() {
  if (!supabase) {
    throw new Error("Cliente de Supabase no configurado.");
  }
  return supabase;
}

const cleanText = (value: unknown) => String(value ?? "").trim();
const cleanQuantity = (value: unknown) => Math.max(1, Number(value) || 1);
const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export async function fetchDashboardData(): Promise<DashboardData> {
  const client = getClient();
  const [settingsReq, productsReq, customersReq, linesReq] = await Promise.all([
    client.from("settings").select("*").eq("id", 1).maybeSingle(),
    client.from("products").select("*"),
    client.from("customers").select("*"),
    client.from("order_lines").select("*"),
  ]);

  if (settingsReq.error) throw settingsReq.error;
  if (productsReq.error) throw productsReq.error;
  if (customersReq.error) throw customersReq.error;
  if (linesReq.error) throw linesReq.error;

  const rawCustomers = (customersReq.data ?? []) as Array<{
    full_name: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }>;

  const rawProducts = (productsReq.data ?? []) as Array<{
    id: string | number;
    model: string;
    variant: string;
    rim_type?: string;
    leather_type?: string;
    price_arg?: number;
    price_uyu?: number;
  }>;

  const rawLines = (linesReq.data ?? []) as Array<{
    line_id: string;
    order_id: string | null;
    created_at?: string | null;
    customer: string;
    model: string;
    variant: string;
    quantity: number;
    status: string;
    completed_at?: string | null;
    unit_price_arg?: number | null;
    unit_price_uyu?: number | null;
    exchange_rate?: number | null;
    total_arg?: number | null;
    total_uyu?: number | null;
  }>;

  const exchangeRate = Number(settingsReq.data?.exchange_rate || 1);

  return {
    source: settingsReq.data?.source || "",
    generatedAt: settingsReq.data?.generated_at || "",
    exchangeRate,
    customers: rawCustomers.map((c) => c.full_name).sort((a, b) => a.localeCompare(b, "es")),
    customerProfiles: rawCustomers.map((c) => ({
      fullName: c.full_name,
      firstName: c.first_name || c.full_name.split(/\s+/)[0],
      lastName: c.last_name || c.full_name.split(/\s+/).slice(1).join(" "),
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
    })),
    products: rawProducts.map((p) => ({
      id: String(p.id),
      model: p.model,
      variant: p.variant,
      rimType: p.rim_type || "",
      leatherType: p.leather_type || "",
      priceArg: Number(p.price_arg) || 0,
      priceUyu: Number(p.price_uyu) || (Number(p.price_arg) || 0) * exchangeRate,
    })),
    production: rawLines
      .filter((l) => l.status === "Pendiente" || l.status === "En producción")
      .map((l) => ({
        lineId: l.line_id,
        orderId: l.order_id,
        createdAt: l.created_at || settingsReq.data?.generated_at || null,
        customer: l.customer,
        model: l.model,
        variant: l.variant,
        quantity: Number(l.quantity) || 1,
        status: (l.status === "En producción" ? "En producción" : "Pendiente") as "Pendiente" | "En producción",
        unitPriceArg: l.unit_price_arg != null ? Number(l.unit_price_arg) : undefined,
        unitPriceUyu: l.unit_price_uyu != null ? Number(l.unit_price_uyu) : undefined,
        exchangeRate: l.exchange_rate != null ? Number(l.exchange_rate) : undefined,
        totalArg: l.total_arg != null ? Number(l.total_arg) : undefined,
        totalUyu: l.total_uyu != null ? Number(l.total_uyu) : undefined,
      })),
    history: rawLines
      .map((l) => ({
        lineId: l.line_id,
        orderId: l.order_id,
        createdAt: l.created_at || settingsReq.data?.generated_at || null,
        customer: l.customer,
        model: l.model,
        variant: l.variant,
        quantity: Number(l.quantity) || 1,
        completedAt: l.completed_at || null,
        unitPriceArg: l.unit_price_arg != null ? Number(l.unit_price_arg) : undefined,
        unitPriceUyu: l.unit_price_uyu != null ? Number(l.unit_price_uyu) : undefined,
        exchangeRate: l.exchange_rate != null ? Number(l.exchange_rate) : undefined,
        totalArg: l.total_arg != null ? Number(l.total_arg) : undefined,
        totalUyu: l.total_uyu != null ? Number(l.total_uyu) : undefined,
      })),
  };
}

export async function createCustomer(customer: Partial<CustomerProfile>): Promise<DashboardData> {
  const client = getClient();
  const firstName = cleanText(customer.firstName);
  const lastName = cleanText(customer.lastName);
  const fullName = cleanText(customer.fullName || `${firstName} ${lastName}`);

  if (!fullName) {
    throw new Error("Ingresá el nombre del cliente.");
  }

  const profile = {
    full_name: fullName,
    first_name: firstName || fullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/)[0],
    last_name: lastName || fullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/).slice(1).join(" "),
    phone: cleanText(customer.phone),
    email: cleanText(customer.email),
    address: cleanText(customer.address),
    notes: cleanText(customer.notes),
  };

  const { error } = await client.from("customers").upsert(profile, { onConflict: "full_name" });
  if (error) throw error;

  return fetchDashboardData();
}

export async function mergeOrUpdateCustomer(
  previousName: string,
  customer: Partial<CustomerProfile>,
): Promise<DashboardData> {
  const client = getClient();
  const prevClean = cleanText(previousName);
  const firstName = cleanText(customer.firstName);
  const lastName = cleanText(customer.lastName);
  const targetFullName = cleanText(customer.fullName || `${firstName} ${lastName}`);

  if (!prevClean || !targetFullName) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  const isSame = prevClean.localeCompare(targetFullName, "es", { sensitivity: "base" }) === 0;

  if (isSame) {
    const profile = {
      full_name: targetFullName,
      first_name: firstName || targetFullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/)[0],
      last_name: lastName || targetFullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/).slice(1).join(" "),
      phone: cleanText(customer.phone),
      email: cleanText(customer.email),
      address: cleanText(customer.address),
      notes: cleanText(customer.notes),
    };
    const { error } = await client.from("customers").update(profile).eq("full_name", prevClean);
    if (error) throw error;
  } else {
    // Check if target customer already exists
    const { data: targetData, error: targetErr } = await client
      .from("customers")
      .select("*")
      .ilike("full_name", targetFullName)
      .maybeSingle();

    if (targetErr) throw targetErr;

    if (targetData) {
      // Reassign all order lines
      const { error: linesErr } = await client
        .from("order_lines")
        .update({ customer: targetData.full_name })
        .eq("customer", prevClean);
      if (linesErr) throw linesErr;

      // Merge notes and contact info
      const combinedNotes = [targetData.notes, cleanText(customer.notes)].filter(Boolean).join("createdAt: l.created_at || settingsReq.data?.generated_at || nulln");
      const updatedTarget = {
        phone: cleanText(customer.phone) || targetData.phone || "",
        email: cleanText(customer.email) || targetData.email || "",
        address: cleanText(customer.address) || targetData.address || "",
        notes: combinedNotes,
      };

      const { error: updateErr } = await client
        .from("customers")
        .update(updatedTarget)
        .eq("full_name", targetData.full_name);
      if (updateErr) throw updateErr;

      // Delete previous customer
      const { error: delErr } = await client.from("customers").delete().eq("full_name", prevClean);
      if (delErr) throw delErr;
    } else {
      // Target doesn't exist, update customer name and contact
      const profile = {
        full_name: targetFullName,
        first_name: firstName || targetFullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/)[0],
        last_name: lastName || targetFullName.split(/createdAt: l.created_at || settingsReq.data?.generated_at || nulls+/).slice(1).join(" "),
        phone: cleanText(customer.phone),
        email: cleanText(customer.email),
        address: cleanText(customer.address),
        notes: cleanText(customer.notes),
      };
      const { error: cErr } = await client.from("customers").update(profile).eq("full_name", prevClean);
      if (cErr) throw cErr;

      const { error: linesErr } = await client
        .from("order_lines")
        .update({ customer: targetFullName })
        .eq("customer", prevClean);
      if (linesErr) throw linesErr;
    }
  }

  return fetchDashboardData();
}

export async function createOrder(
  customer: string,
  items: DraftOrderItem[],
): Promise<{ data: DashboardData; orderId: string }> {
  const client = getClient();
  const cleanCust = cleanText(customer);
  if (!cleanCust || !items.length) {
    throw new Error("Cliente y artículos son obligatorios.");
  }

  const orderId = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
  const createdAt = new Date().toISOString();

  const { data: settings } = await client.from("settings").select("exchange_rate").eq("id", 1).maybeSingle();
  const rate = settings ? Number(settings.exchange_rate) : 1;

  const productIds = items.map((i) => String(i.productId));
  const { data: productsData, error: pError } = await client.from("products").select("*").in("id", productIds);
  if (pError) throw pError;

  const productsMap = new Map((productsData ?? []).map((p) => [String(p.id), p]));

  const newLines = items.map((item) => {
    const product = productsMap.get(String(item.productId));
    if (!product) throw new Error(`Producto inexistente: ${item.productId}`);
    const quantity = cleanQuantity(item.quantity);
    const unitPriceArg = Number(product.price_arg) || 0;
    const unitPriceUyu = Number(product.price_uyu) || (unitPriceArg * rate);
    const totalArg = unitPriceArg * quantity;
    const totalUyu = unitPriceUyu * quantity;

    return {
      line_id: makeId("line"),
      order_id: orderId,
      customer: cleanCust,
      model: product.model,
      variant: product.variant,
      quantity,
      status: "Pendiente",
      created_at: createdAt,
      unit_price_arg: unitPriceArg,
      unit_price_uyu: unitPriceUyu,
      exchange_rate: rate,
      total_arg: totalArg,
      total_uyu: totalUyu,
    };
  });

  const { error: insErr } = await client.from("order_lines").insert(newLines);
  if (insErr) throw insErr;

  const data = await fetchDashboardData();
  return { data, orderId };
}

export async function updateProductionLine(
  lineId: string,
  patch: Partial<ProductionItem>,
): Promise<DashboardData> {
  const client = getClient();
  const updates: Record<string, unknown> = {};

  if (patch.orderId !== undefined) updates.order_id = cleanText(patch.orderId) || null;
  if (patch.customer !== undefined) updates.customer = cleanText(patch.customer);
  if (patch.model !== undefined) updates.model = cleanText(patch.model);
  if (patch.variant !== undefined) updates.variant = cleanText(patch.variant);
  if (patch.quantity !== undefined) updates.quantity = cleanQuantity(patch.quantity);
  if (patch.status !== undefined) updates.status = patch.status === "En producción" ? "En producción" : "Pendiente";

  const { error } = await client.from("order_lines").update(updates).eq("line_id", lineId);
  if (error) throw error;

  return fetchDashboardData();
}

export async function completeProductionLine(lineId: string): Promise<DashboardData> {
  const client = getClient();
  const { error } = await client
    .from("order_lines")
    .update({
      status: "Completado",
      completed_at: new Date().toISOString(),
    })
    .eq("line_id", lineId);

  if (error) throw error;
  return fetchDashboardData();
}

export async function deleteProductionLine(lineId: string): Promise<DashboardData> {
  const client = getClient();
  const { data, error } = await client
    .from("order_lines")
    .delete()
    .eq("line_id", lineId)
    .select("line_id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("La línea no existe o no tenés permiso para eliminarla.");
  return fetchDashboardData();
}

export async function createProduct(product: {
  model: string;
  variant: string;
  rimType?: string;
  leatherType?: string;
  priceArg: number;
}): Promise<DashboardData> {
  const client = getClient();
  const model = cleanText(product.model);
  const variant = cleanText(product.variant);
  const rimType = cleanText(product.rimType);
  const leatherType = cleanText(product.leatherType);
  const priceArg = Math.max(0, Number(product.priceArg) || 0);

  if (!model || !variant) {
    throw new Error("Modelo y variante son obligatorios.");
  }

  const { data: settings } = await client.from("settings").select("exchange_rate").eq("id", 1).maybeSingle();
  const rate = settings ? Number(settings.exchange_rate) : 1;
  const priceUyu = priceArg * rate;

  const { data: productsData, error: pError } = await client.from("products").select("id");
  if (pError) throw pError;

  const maxId = productsData && productsData.length
    ? Math.max(...productsData.map((p) => Number(p.id) || 0), 0)
    : 0;
  const id = String(maxId + 1);

  const newProduct = {
    id,
    model,
    variant,
    rim_type: rimType,
    leather_type: leatherType,
    price_arg: priceArg,
    price_uyu: priceUyu,
  };

  const { error } = await client.from("products").insert(newProduct);
  if (error) throw error;

  return fetchDashboardData();
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<DashboardData> {
  const client = getClient();
  const { data: settings } = await client.from("settings").select("exchange_rate").eq("id", 1).maybeSingle();
  const rate = settings ? Number(settings.exchange_rate) : 1;

  const { data: prevProduct, error: getErr } = await client.from("products").select("*").eq("id", id).single();
  if (getErr) throw getErr;

  const priceArg = Math.max(0, Number(patch.priceArg ?? prevProduct.price_arg) || 0);

  const updates = {
    model: patch.model === undefined ? prevProduct.model : cleanText(patch.model) || prevProduct.model,
    variant: patch.variant === undefined ? prevProduct.variant : cleanText(patch.variant) || prevProduct.variant,
    rim_type: patch.rimType === undefined ? prevProduct.rim_type : cleanText(patch.rimType),
    leather_type: patch.leatherType === undefined ? prevProduct.leather_type : cleanText(patch.leatherType),
    price_arg: priceArg,
    price_uyu: priceArg * rate,
  };

  const { error } = await client.from("products").update(updates).eq("id", id);
  if (error) throw error;

  return fetchDashboardData();
}

export async function updateExchangeRate(rate: number): Promise<DashboardData> {
  const client = getClient();
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Tipo de cambio inválido.");
  }

  const { error: settingsErr } = await client.from("settings").update({ exchange_rate: rate }).eq("id", 1);
  if (settingsErr) throw settingsErr;

  const { data: products } = await client.from("products").select("id, price_arg");
  if (products && products.length > 0) {
    const updates = products.map((p) => ({
      id: p.id,
      price_uyu: Number(p.price_arg) * rate,
    }));
    await client.from("products").upsert(updates);
  }

  return fetchDashboardData();
}

export async function resetData(): Promise<DashboardData> {
  return fetchDashboardData();
}
