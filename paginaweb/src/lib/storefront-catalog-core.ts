import type { Locale, MediaAsset, Product, ProductVariant } from "@/types/catalog";
import { normalizeCatalogAttributes } from "../../../shared/catalog-taxonomy";

export type StorefrontVariantRow = {
  id: string;
  sku: string;
  name: string;
  price_minor: number;
  currency: "UYU";
  inventory_tracked: boolean;
  stock_on_hand: number;
  stock_reserved: number;
  active: boolean;
};

export type StorefrontImageRow = {
  id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  mime_type: string;
  variant_id: string | null;
};

export type StorefrontProductRow = {
  id: string;
  editorial_slug: string;
  name: string;
  category: string;
  description: string;
  sale_mode: "standard" | "made_to_order";
  published: boolean;
  catalog_filters?: unknown;
  variants: StorefrontVariantRow[] | null;
  images: StorefrontImageRow[] | null;
};

const fallbackImage = (name: string): MediaAsset => ({
  src: "/assets/matearte/01-marca/LogoOriginal-4k.png",
  alt: name,
  width: 4096,
  height: 4096,
  source: "provided",
  sourceUrl: "/assets/matearte/01-marca/LogoOriginal-4k.png",
  rightsStatus: "brand-public",
});

const genericCopy: Record<Locale, { eyebrow: string; summary: string }> = {
  es: { eyebrow: "Producto MateArte", summary: "Producto disponible en el catálogo de MateArte Uruguay." },
  en: { eyebrow: "MateArte product", summary: "Product available in the MateArte Uruguay catalog." },
  pt: { eyebrow: "Produto MateArte", summary: "Produto disponível no catálogo da MateArte Uruguai." },
};

function publicStorageUrl(supabaseBaseUrl: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseBaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${encodedPath}`;
}

function mapImages(row: StorefrontProductRow, supabaseBaseUrl: string, existing?: Product): MediaAsset[] {
  const images = [...(row.images ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  if (images.length === 0) return existing?.images.length ? existing.images : [fallbackImage(row.name)];
  return images.map((image) => {
    const src = publicStorageUrl(supabaseBaseUrl, image.storage_path);
    return {
      src,
      alt: image.alt_text.trim() || `Foto de ${row.name}`,
      width: 1200,
      height: 1200,
      source: "supabase" as const,
      sourceUrl: src,
      rightsStatus: "brand-public" as const,
      variantId: image.variant_id,
    };
  });
}

function mapVariants(row: StorefrontProductRow): ProductVariant[] {
  return (row.variants ?? [])
    .filter((variant) => variant.active && variant.price_minor > 0)
    .sort((a, b) => a.price_minor - b.price_minor || a.name.localeCompare(b.name))
    .map((variant) => ({
      id: variant.id,
      label: variant.name,
      value: variant.sku,
      commerceId: variant.id,
      price: { amountMinor: variant.price_minor, currency: variant.currency },
      available: !variant.inventory_tracked || variant.stock_on_hand - variant.stock_reserved > 0,
    }));
}

export function storefrontProductFromRow(
  row: StorefrontProductRow,
  supabaseBaseUrl: string,
  locale: Locale,
  existing?: Product,
): Product {
  const variants = mapVariants(row);
  const minimumPrice = variants.length > 0
    ? Math.min(...variants.map((variant) => variant.price!.amountMinor)) / 100
    : existing?.filterData.priceUYU;
  const keepEditorialTranslation = locale !== "es" && Boolean(existing);
  const description = keepEditorialTranslation
    ? existing!.description
    : row.description.trim() || existing?.description || genericCopy[locale].summary;
  const summary = keepEditorialTranslation
    ? existing!.summary
    : row.description.trim() || existing?.summary || genericCopy[locale].summary;
  const storedAttributes = normalizeCatalogAttributes(row.catalog_filters);
  const existingProductTypes = existing?.filterData.productTypes
    ?? (existing?.filterData.mateType ? [existing.filterData.mateType] : []);

  return {
    id: existing?.id ?? row.id,
    slug: row.editorial_slug,
    name: keepEditorialTranslation ? existing!.name : row.name,
    category: row.category,
    eyebrow: existing?.eyebrow ?? genericCopy[locale].eyebrow,
    summary,
    description,
    materials: existing?.materials ?? [],
    filterData: {
      materials: storedAttributes.materials.length > 0 ? storedAttributes.materials : existing?.filterData.materials ?? [],
      productTypes: storedAttributes.productTypes.length > 0 ? storedAttributes.productTypes : existingProductTypes,
      colors: storedAttributes.colors.length > 0 ? storedAttributes.colors : existing?.filterData.colors ?? [],
      priceUYU: minimumPrice,
    },
    images: mapImages(row, supabaseBaseUrl, existing),
    variants,
    featured: existing?.featured,
    editorial: false,
  };
}

export function mergeStorefrontProducts(
  editorialProducts: Product[],
  commerceProducts: StorefrontProductRow[],
  supabaseBaseUrl: string,
  locale: Locale,
) {
  const published = commerceProducts.filter((product) => product.published && product.category !== "sandbox");
  const editorialBySlug = new Map(editorialProducts.map((product) => [product.slug, product]));

  return published.map((product) => storefrontProductFromRow(
    product,
    supabaseBaseUrl,
    locale,
    editorialBySlug.get(product.editorial_slug),
  ));
}
