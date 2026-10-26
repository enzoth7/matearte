import "server-only";

import { unstable_cache } from "next/cache";
import { getLocalizedProduct, getLocalizedProducts } from "@/content/catalog-localization";
import { createPublicSupabase } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";
import {
  mergeStorefrontProducts,
  storefrontProductFromRow,
  type StorefrontProductRow,
} from "@/lib/storefront-catalog-core";
import type { Locale } from "@/types/catalog";
import { DEFAULT_WHOLESALE_DISCOUNT_SETTINGS, type WholesaleDiscountSettings } from "@/lib/wholesale-pricing";
import { defaultCatalogTaxonomy } from "../../../shared/catalog-taxonomy";
import { loadPublicCatalogTaxonomy } from "@/lib/catalog-taxonomy-live";

const storefrontSelection = `
  id,
  created_at,
  updated_at,
  editorial_slug,
  name,
  name_en,
  name_pt,
  description_en,
  description_pt,
  category,
  category_code,
  attributes,
  description,
  sale_mode,
  published,
  catalog_filters,
  variants:commerce_variants(
    id,
    created_at,
    updated_at,
    sku,
    name,
    base_price_minor,
    price_minor,
    currency,
    active,
    available_web,
    color,
    weight_grams,
    option_values
  ),
  images:commerce_product_images(
    id,
    created_at,
    updated_at,
    storage_path,
    alt_text,
    sort_order,
    mime_type,
    variant_id,
    option_values
  )
`;

const legacyStorefrontSelection = `
  id, created_at, updated_at, editorial_slug, name, category, description, sale_mode, published, catalog_filters,
  variants:commerce_variants(id,created_at,updated_at,sku,name,price_minor,currency,active,color),
  images:commerce_product_images(id,created_at,updated_at,storage_path,alt_text,sort_order,mime_type,variant_id)
`;

function missingStructuredCatalogColumn(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "42703" || /category_code|attributes|option_values|weight_grams|base_price_minor|name_en|name_pt|description_en|description_pt/i.test(error.message ?? "")));
}

/** Segundos que se reutilizan los datos del catálogo antes de volver a consultar Supabase. */
const CATALOG_REVALIDATE_SECONDS = 120;

/**
 * Productos publicados con variantes y fotos, más la taxonomía, compartidos entre visitas durante
 * CATALOG_REVALIDATE_SECONDS. Un error no queda guardado: la próxima visita vuelve a consultar.
 */
const loadPublishedCatalog = unstable_cache(async () => {
  const client = createPublicSupabase();
  let { data, error }: { data: unknown; error: { message?: string; code?: string } | null } = await client
    .from("commerce_products")
    .select(storefrontSelection)
    .eq("published", true)
    .neq("category", "sandbox")
    .order("name", { ascending: true });
  if (missingStructuredCatalogColumn(error)) {
    ({ data, error } = await client
      .from("commerce_products")
      .select(legacyStorefrontSelection)
      .eq("published", true)
      .neq("category", "sandbox")
      .order("name", { ascending: true }));
  }
  if (error) throw error;
  const taxonomy = await loadPublicCatalogTaxonomy(client).catch(reason => {
    console.error("[storefront-catalog] No se pudo cargar la taxonomía pública.", reason);
    return defaultCatalogTaxonomy;
  });
  return { rows: (data ?? []) as unknown as StorefrontProductRow[], taxonomy };
}, ["storefront-published-catalog-v1"], { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] });

export async function getStorefrontProducts(locale: Locale) {
  const editorialProducts = getLocalizedProducts(locale);
  try {
    const { rows, taxonomy } = await loadPublishedCatalog();
    return mergeStorefrontProducts(editorialProducts, rows, supabaseUrl(), locale, taxonomy);
  } catch (reason) {
    console.error("[storefront-catalog] No se pudo cargar el catálogo comercial.", reason);
    return [];
  }
}

export async function getStorefrontProduct(slug: string, locale: Locale) {
  const editorialProduct = getLocalizedProduct(slug, locale);
  try {
    const { rows, taxonomy } = await loadPublishedCatalog();
    const row = rows.find((candidate) => candidate.editorial_slug === slug);
    if (!row) return null;
    const product = storefrontProductFromRow(row, supabaseUrl(), locale, editorialProduct, taxonomy);
    return product.variants.length ? product : null;
  } catch (reason) {
    console.error(`[storefront-catalog] No se pudo cargar el producto ${slug}.`, reason);
    return null;
  }
}

const loadExchangeRates = unstable_cache(async () => {
  const client = createPublicSupabase();
  const { data, error } = await client.from("commerce_exchange_rates").select("currency_code, rate_to_uyu");
  if (error) throw error;
  const rates: Record<string, number> = {};
  for (const row of data || []) rates[row.currency_code] = row.rate_to_uyu;
  return rates;
}, ["storefront-exchange-rates-v1"], { revalidate: 600, tags: ["catalog"] });

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    return await loadExchangeRates();
  } catch (reason) {
    console.error("[storefront-catalog] No se pudieron cargar las cotizaciones, usando fallbacks.", reason);
    return { USD: 41, BRL: 7.5 };
  }
}

export async function getWholesaleDiscountSettings(): Promise<WholesaleDiscountSettings> {
  try {
    const client = createPublicSupabase();
    const { data, error } = await client
      .from("commerce_settings")
      .select("wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories")
      .eq("singleton", true)
      .single();
    if (error) throw error;
    return data as WholesaleDiscountSettings;
  } catch (reason) {
    console.error("[storefront-catalog] No se pudo cargar la configuración de mayoreo.", reason);
    return DEFAULT_WHOLESALE_DISCOUNT_SETTINGS;
  }
}
