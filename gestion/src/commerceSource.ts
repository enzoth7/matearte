import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clean = (value?: string) => (value || "").replace(/\\[rn]/g, "").trim();
const url = clean(import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL);
const key = clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Los datos de producción se leen con la sesión del usuario y las políticas RLS existentes.
// No se usa service_role ni se guardan registros comerciales en el estado local de Gestión.
export const commerceSource: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { storageKey: "matearte-gestion-commerce-auth", persistSession: true } })
  : null;

export type CommerceVariant = {
  id: string;
  sku: string;
  name: string;
  price_minor: number;
  base_price_minor: number;
  active: boolean;
  available_local?: boolean;
  available_web?: boolean;
  available_wholesale?: boolean;
  wholesale_price_arg?: number | null;
  legacy_product_id?: string | null;
  rim_type?: string;
  leather_type?: string;
  weight_grams: number | null;
  color?: string | null;
  option_values?: Record<string, unknown>;
};
export type CommerceImage = {
  option_values?: Record<string, unknown>;
  id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  variant_id?: string | null;
};
export type CommerceProduct = {
  id: string;
  name: string;
  editorial_slug: string;
  category: string;
  category_code?: string | null;
  published: boolean;
  sale_mode: string;
  peso: number;
  updated_at: string;
  description?: string | null;
  attributes?: Record<string, unknown>;
  commerce_variants: CommerceVariant[];
  commerce_product_images: CommerceImage[];
};
export type CommerceOrderItem = {
  id: string;
  item_type: string;
  title: string;
  quantity: number;
  total_minor: number;
  requires_review: boolean;
  review_status: string | null;
  production_status: string | null;
  source_variant_id: string | null;
  sku: string | null;
  unit_price_minor: number;
  immutable_snapshot: Record<string, unknown>;
};
export type CommerceOrder = {
  id: string;
  order_number: number;
  reference_code?: string | null;
  user_id: string | null;
  paid_at: string | null;
  currency: string;
  shipping_minor: number;
  discount_minor: number;
  payment_fee_minor: number;
  shipping_snapshot: Record<string, unknown>;
  status: string;
  shipping_method: string;
  shipping_carrier: string | null;
  tracking_code: string | null;
  total_minor: number;
  created_at: string;
  customer_snapshot: Record<string, unknown>;
  order_items: CommerceOrderItem[];
  commerce_bank_transfer_receipts: { id: string; status: string; submitted_at: string }[];
};
export type CommerceDiscount = {
  id: string;
  code: string;
  discount_type: string;
  value: number;
  valid_from: string;
  valid_until: string;
  enabled: boolean;
};
export type CommerceShippingRate = {
  row_order: number;
  weight_label: string;
  weight_min_g: number;
  weight_max_g: number;
  argentina: number;
  suramerica: number;
  estados_unidos: number;
  resto_america: number;
  espana: number;
  resto_europa: number;
  resto_mundo: number;
};
export type CommerceSettings = {
  commerce_enabled: boolean;
  mercado_pago_enabled: boolean;
  paypal_enabled: boolean;
  catalog_price_adjustment_enabled: boolean;
  catalog_price_adjustment_percent: number;
  wholesale_mate_discount_enabled: boolean;
  wholesale_mate_quantity_threshold: number;
  wholesale_mate_discount_percent: number;
  wholesale_discount_categories: string[];
};
export type CommerceReference = {
  discounts: CommerceDiscount[];
  shippingRates: CommerceShippingRate[];
  exchangeRates: { currency_code: string; rate_to_uyu: number; updated_at: string }[];
  categories: { code: string; label_es: string; active: boolean }[];
  settings: CommerceSettings;
};

export const commercePageSize = 30;

export function commerceCustomerName(snapshot: Record<string, unknown>): string {
  for (const field of ["fullName", "full_name", "name", "email"]) {
    const value = snapshot?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Cliente sin nombre";
}

export function visibleInCommerceAdmin(order: CommerceOrder): boolean {
  return order.customer_snapshot?.purchaseFlow !== "international_paypal"
    || !["pending_payment", "payment_failed", "cancelled"].includes(order.status);
}

export function commerceMoney(minor: number): string {
  return commercePesos(Number(minor) / 100);
}

export function commercePesos(amount: number): string {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));
}

export async function readCommerceProducts(client: SupabaseClient, page: number) {
  const start = page * commercePageSize;
  let result: { data: unknown[] | null; count: number | null; error: { code?: string; message: string } | null } = await client.from("commerce_products")
    .select("id,name,editorial_slug,category,category_code,description,published,sale_mode,peso,updated_at,attributes,commerce_variants(id,sku,name,price_minor,base_price_minor,active,available_local,available_web,available_wholesale,wholesale_price_arg,legacy_product_id,rim_type,leather_type,weight_grams,color,option_values),commerce_product_images(id,storage_path,alt_text,sort_order,variant_id,option_values)", { count: "exact" })
    .order("name").order("id").range(start, start + commercePageSize - 1);
  if (result.error?.code === "42703" && /available_wholesale|wholesale_price_arg|legacy_product_id/i.test(result.error.message)) {
    result = await client.from("commerce_products")
      .select("id,name,editorial_slug,category,category_code,description,published,sale_mode,peso,updated_at,attributes,commerce_variants(id,sku,name,price_minor,base_price_minor,active,available_local,available_web,rim_type,leather_type,weight_grams,color,option_values),commerce_product_images(id,storage_path,alt_text,sort_order,variant_id,option_values)", { count: "exact" })
      .order("name").order("id").range(start, start + commercePageSize - 1);
  }
  const { data, count, error } = result;
  if (error) throw error;
  return { rows: (data || []) as CommerceProduct[], count: count ?? 0 };
}

export async function readCommerceOrders(client: SupabaseClient, page: number) {
  const start = page * commercePageSize;
  const { data, count, error } = await client.from("orders")
    .select("id,order_number,reference_code,user_id,paid_at,currency,status,shipping_method,shipping_carrier,tracking_code,total_minor,shipping_minor,discount_minor,payment_fee_minor,shipping_snapshot,created_at,customer_snapshot,order_items(id,item_type,title,quantity,unit_price_minor,total_minor,source_variant_id,sku,immutable_snapshot,requires_review,review_status,production_status),commerce_bank_transfer_receipts(id,status,submitted_at)", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(start, start + commercePageSize - 1);
  if (error) throw error;
  return { rows: (data || []) as CommerceOrder[], count: count ?? 0 };
}

export async function readCommerceReference(client: SupabaseClient): Promise<CommerceReference> {
  const [discounts, shippingRates, exchangeRates, categories, settings] = await Promise.all([
    client.from("commerce_discounts").select("id,code,discount_type,value,valid_from,valid_until,enabled").order("code"),
    client.from("commerce_international_shipping_rates").select("row_order,weight_label,weight_min_g,weight_max_g,argentina,suramerica,estados_unidos,resto_america,espana,resto_europa,resto_mundo").order("row_order"),
    client.from("commerce_exchange_rates").select("currency_code,rate_to_uyu,updated_at").order("currency_code"),
    client.from("commerce_categories").select("code,label_es,active").order("sort_order"),
    client.from("commerce_settings").select("commerce_enabled,mercado_pago_enabled,paypal_enabled,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories").eq("singleton", true).single(),
  ]);
  for (const result of [discounts, shippingRates, exchangeRates, categories, settings]) {
    if (result.error) throw result.error;
  }
  return {
    discounts: (discounts.data || []) as CommerceDiscount[],
    shippingRates: (shippingRates.data || []) as CommerceShippingRate[],
    exchangeRates: (exchangeRates.data || []) as CommerceReference["exchangeRates"],
    categories: (categories.data || []) as CommerceReference["categories"],
    settings: settings.data as CommerceSettings,
  };
}
