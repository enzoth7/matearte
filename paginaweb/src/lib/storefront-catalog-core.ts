import type {
  CatalogColorId,
  CatalogMaterialId,
  CatalogProductTypeId,
  Locale,
  MediaAsset,
  Product,
  ProductVariant,
} from "@/types/catalog";
import {
  catalogCollectionIds,
  canonicalCategoryCode,
  catalogMaterialIds,
  catalogProductTypeIds,
  normalizeCatalogAttributes,
  normalizeCatalogValueMap,
  catalogAttributeDetails,
  catalogPurchaseAxes,
  catalogValueLabel,
  defaultCatalogTaxonomy,
  type CatalogTaxonomy,
} from "../../../shared/catalog-taxonomy";
import { buildProductDescription } from "@/lib/product-description";

export type StorefrontVariantRow = {
  id: string;
  created_at?: string;
  updated_at?: string;
  sku: string;
  name: string;
  price_minor: number;
  base_price_minor?: number;
  currency: "UYU";
  active: boolean;
  available_web?: boolean;
  color?: string | null;
  weight_grams?: number | null;
  option_values?: unknown;
};

export type StorefrontImageRow = {
  id: string;
  created_at?: string;
  updated_at?: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  mime_type: string;
  variant_id: string | null;
  option_values?: unknown;
};

export type StorefrontProductRow = {
  id: string;
  created_at?: string;
  updated_at?: string;
  editorial_slug: string;
  name: string;
  name_en?: string | null;
  name_pt?: string | null;
  category: string;
  category_code?: string | null;
  description: string;
  description_en?: string | null;
  description_pt?: string | null;
  sale_mode: "standard" | "made_to_order";
  published: boolean;
  catalog_filters?: unknown;
  attributes?: unknown;
  variants: StorefrontVariantRow[] | null;
  images: StorefrontImageRow[] | null;
};

const fallbackImage = (name: string): MediaAsset => ({
  src: "/assets/matearte/01-marca/LogoOriginal-4k.webp",
  alt: name,
  width: 4096,
  height: 4096,
  source: "provided",
  sourceUrl: "/assets/matearte/01-marca/LogoOriginal-4k.webp",
  rightsStatus: "brand-public",
});

const genericCopy: Record<Locale, { eyebrow: string }> = {
  es: { eyebrow: "Producto MateArte" },
  en: { eyebrow: "MateArte product" },
  pt: { eyebrow: "Produto MateArte" },
};

function publicStorageUrl(supabaseBaseUrl: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseBaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${encodedPath}`;
}

function crawlableProductImageUrl(path: string) {
  return `/imagenes/productos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function mapImages(row: StorefrontProductRow, supabaseBaseUrl: string, existing?: Product): MediaAsset[] {
  const images = [...(row.images ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  if (images.length === 0) return existing?.images.length ? existing.images : [fallbackImage(row.name)];
  return images.map((image) => {
    const sourceUrl = publicStorageUrl(supabaseBaseUrl, image.storage_path);
    return {
      src: crawlableProductImageUrl(image.storage_path),
      alt: image.alt_text.trim() || `Foto de ${row.name}`,
      width: 1200,
      height: 1200,
      source: "supabase" as const,
      sourceUrl,
      rightsStatus: "brand-public" as const,
      variantId: image.variant_id,
      optionValues: normalizeCatalogValueMap(image.option_values),
    };
  });
}

function mapVariants(row: StorefrontProductRow): ProductVariant[] {
  return (row.variants ?? [])
    .filter((variant) => variant.active && variant.available_web !== false && variant.price_minor > 0)
    .sort((a, b) => a.price_minor - b.price_minor || a.name.localeCompare(b.name))
    .map((variant) => {
      const options = normalizeCatalogValueMap(variant.option_values);
      const structuredColor = typeof options.color === "string" ? options.color as CatalogColorId : undefined;
      return ({
      id: variant.id,
      label: variant.name,
      value: variant.sku,
      commerceId: variant.id,
      price: { amountMinor: variant.price_minor, currency: variant.currency },
      basePrice: { amountMinor: variant.base_price_minor ?? variant.price_minor, currency: variant.currency },
      available: true,
      color: structuredColor || (variant.color as CatalogColorId) || undefined,
      options,
      weightGrams: variant.weight_grams,
    });
    });
}

function mergeCommercialValues<T extends string>(stored: T[], structured: unknown): T[] {
  return [...new Set([...stored, ...(typeof structured === "string" ? [structured as T] : [])])];
}

function lastModifiedAt(row: StorefrontProductRow): number {
  const dates = [
    row.created_at,
    row.updated_at,
    ...(row.variants ?? []).flatMap((variant) => [variant.created_at, variant.updated_at]),
    ...(row.images ?? []).flatMap((image) => [image.created_at, image.updated_at]),
  ];
  return Math.max(0, ...dates.map((date) => date ? Date.parse(date) : NaN).filter(Number.isFinite));
}

export function storefrontProductFromRow(
  row: StorefrontProductRow,
  supabaseBaseUrl: string,
  locale: Locale,
  existing?: Product,
  taxonomy: CatalogTaxonomy = defaultCatalogTaxonomy,
): Product {
  const variants = mapVariants(row);
  const minimumPrice = variants.length > 0
    ? Math.min(...variants.map((variant) => variant.price!.amountMinor)) / 100
    : existing?.filterData.priceUYU;
  const keepEditorialTranslation = locale !== "es" && Boolean(existing);
  const storedAttributes = normalizeCatalogAttributes(row.catalog_filters);
  const attributes = normalizeCatalogValueMap(row.attributes);
  const categoryCode = canonicalCategoryCode(row.category_code || row.category);
  const attributeDetails = catalogAttributeDetails(taxonomy, attributes);
  const authoredText = row.description.trim();
  // Sin texto cargado en Gestión se arma uno con las características del producto.
  const generated = authoredText ? null : buildProductDescription({
    name: row.name,
    category: categoryCode,
    details: attributeDetails,
    colors: [...new Set(variants.map(variant => variant.color).filter((color): color is CatalogColorId => Boolean(color)))]
      .map(color => catalogValueLabel(taxonomy, "color", color)),
    madeToOrder: row.sale_mode === "made_to_order",
  }, locale);
  // La descripción de Gestión es la que se muestra en todos los idiomas.
  // En inglés y portugués se usa la traducción cargada en la base; sin traducción, el texto en español.
  const translatedText = locale === "en" ? row.description_en?.trim() : locale === "pt" ? row.description_pt?.trim() : "";
  const translatedName = locale === "en" ? row.name_en?.trim() : locale === "pt" ? row.name_pt?.trim() : "";
  const description = translatedText || authoredText || generated!.description;
  const summary = translatedText || authoredText || generated!.summary;
  const existingProductTypes = existing?.filterData.productTypes
    ?? (existing?.filterData.mateType ? [existing.filterData.mateType] : []);
  const structuredMaterial = typeof attributes.material === "string" && catalogMaterialIds.includes(attributes.material as CatalogMaterialId)
    ? attributes.material as CatalogMaterialId
    : undefined;
  const structuredProductType = typeof attributes["tipo-mate"] === "string" && catalogProductTypeIds.includes(attributes["tipo-mate"] as CatalogProductTypeId)
    ? attributes["tipo-mate"] as CatalogProductTypeId
    : undefined;
  const structuredCollection = typeof attributes.coleccion === "string" && catalogCollectionIds.includes(attributes.coleccion as (typeof catalogCollectionIds)[number])
    ? attributes.coleccion as (typeof catalogCollectionIds)[number]
    : undefined;
  const commercialMaterials = mergeCommercialValues(storedAttributes.materials, structuredMaterial);
  const commercialProductTypes = mergeCommercialValues(storedAttributes.productTypes, structuredProductType);

  return {
    id: existing?.id ?? row.id,
    slug: row.editorial_slug,
    name: translatedName || (keepEditorialTranslation ? existing!.name : row.name),
    category: categoryCode,
    attributes,
    attributeDetails,
    purchaseAxes: catalogPurchaseAxes(taxonomy, categoryCode, attributes, row.name),
    eyebrow: existing?.eyebrow ?? genericCopy[locale].eyebrow,
    summary,
    description,
    materials: existing?.materials ?? [],
    filterData: {
      collection: structuredCollection ?? existing?.filterData.collection,
      materials: commercialMaterials.length > 0 ? commercialMaterials : existing?.filterData.materials ?? [],
      productTypes: commercialProductTypes.length > 0 ? commercialProductTypes : existingProductTypes,
      colors: [...new Set(variants.map(variant => variant.color).filter((color): color is CatalogColorId => Boolean(color)))],
      priceUYU: minimumPrice,
    },
    images: mapImages(row, supabaseBaseUrl, existing),
    variants,
    lastModifiedAt: lastModifiedAt(row),
    featured: existing?.featured,
    editorial: false,
  };
}

export function mergeStorefrontProducts(
  editorialProducts: Product[],
  commerceProducts: StorefrontProductRow[],
  supabaseBaseUrl: string,
  locale: Locale,
  taxonomy: CatalogTaxonomy = defaultCatalogTaxonomy,
) {
  const published = commerceProducts.filter((product) => product.published && product.category !== "sandbox" && product.category !== "regalos");
  const editorialBySlug = new Map(editorialProducts.map((product) => [product.slug, product]));

  return published
    .map((product) => storefrontProductFromRow(
      product,
      supabaseBaseUrl,
      locale,
      editorialBySlug.get(product.editorial_slug),
      taxonomy,
    ))
    .filter((product) => product.variants.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
