import "server-only";

import { getLocalizedProduct, getLocalizedProducts } from "@/content/catalog-localization";
import { createPublicSupabase } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";
import {
  mergeStorefrontProducts,
  storefrontProductFromRow,
  type StorefrontProductRow,
} from "@/lib/storefront-catalog-core";
import type { Locale } from "@/types/catalog";

const storefrontSelection = `
  id,
  editorial_slug,
  name,
  category,
  description,
  sale_mode,
  published,
  catalog_filters,
  variants:commerce_variants(
    id,
    sku,
    name,
    price_minor,
    currency,
    inventory_tracked,
    stock_on_hand,
    stock_reserved,
    active
  ),
  images:commerce_product_images(
    id,
    storage_path,
    alt_text,
    sort_order,
    mime_type,
    variant_id
  )
`;

const legacyStorefrontSelection = storefrontSelection.replace("  catalog_filters,\n", "");

function missingCatalogFiltersColumn(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "42703" || /catalog_filters/i.test(error.message ?? "")));
}

export async function getStorefrontProducts(locale: Locale) {
  const editorialProducts = getLocalizedProducts(locale);
  try {
    const client = createPublicSupabase();
    let { data, error }: { data: unknown; error: { message?: string; code?: string } | null } = await client
      .from("commerce_products")
      .select(storefrontSelection)
      .eq("published", true)
      .neq("category", "sandbox")
      .order("created_at", { ascending: true });
    if (missingCatalogFiltersColumn(error)) {
      ({ data, error } = await client
        .from("commerce_products")
        .select(legacyStorefrontSelection)
        .eq("published", true)
        .neq("category", "sandbox")
        .order("created_at", { ascending: true }));
    }
    if (error) throw error;
    return mergeStorefrontProducts(
      editorialProducts,
      (data ?? []) as unknown as StorefrontProductRow[],
      supabaseUrl(),
      locale,
    );
  } catch (reason) {
    console.error("[storefront-catalog] No se pudo cargar el catálogo comercial.", reason);
    return [];
  }
}

export async function getStorefrontProduct(slug: string, locale: Locale) {
  const editorialProduct = getLocalizedProduct(slug, locale);
  try {
    const client = createPublicSupabase();
    let { data, error }: { data: unknown; error: { message?: string; code?: string } | null } = await client
      .from("commerce_products")
      .select(storefrontSelection)
      .eq("editorial_slug", slug)
      .eq("published", true)
      .neq("category", "sandbox")
      .maybeSingle();
    if (missingCatalogFiltersColumn(error)) {
      ({ data, error } = await client
        .from("commerce_products")
        .select(legacyStorefrontSelection)
        .eq("editorial_slug", slug)
        .eq("published", true)
        .neq("category", "sandbox")
        .maybeSingle());
    }
    if (error) throw error;
    return data
      ? storefrontProductFromRow(data as unknown as StorefrontProductRow, supabaseUrl(), locale, editorialProduct)
      : null;
  } catch (reason) {
    console.error(`[storefront-catalog] No se pudo cargar el producto ${slug}.`, reason);
    return null;
  }
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const client = createPublicSupabase();
    const { data, error } = await client.from("commerce_exchange_rates").select("currency_code, rate_to_uyu");
    if (error) throw error;
    const rates: Record<string, number> = {};
    for (const row of data || []) rates[row.currency_code] = row.rate_to_uyu;
    return rates;
  } catch (reason) {
    console.error("[storefront-catalog] No se pudieron cargar las cotizaciones, usando fallbacks.", reason);
    return { USD: 41, BRL: 7.5 };
  }
}
