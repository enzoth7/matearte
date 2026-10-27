import type { Product, ProductVariant } from "@/types/catalog";

const BRAND = "MateArte";
const FALLBACK_PRODUCT_IMAGE = "/assets/matearte/01-marca/LogoOriginal-4k.webp";

// Packaged-weight fallbacks for products whose catalog variant does not yet have a measured weight.
// Real variant weights always take precedence. Values intentionally round up to avoid understating
// international shipping costs in Merchant Center.
const fallbackShippingWeightGrams: Record<string, number> = {
  bandolera: 1500,
  billeteras: 500,
  bombillas: 500,
  botas: 3000,
  carona: 5000,
  carteras: 1500,
  cintos: 1000,
  cuchillos: 1500,
  "kits-materos": 2500,
  materas: 1500,
  mates: 500,
  personalizados: 1000,
  pinchos: 1000,
  "porta-rollos": 1500,
  "posa-mates": 500,
  recado: 5000,
  servilleteros: 1000,
  "tablas-de-picar": 3000,
  tarjeteros: 500,
  termos: 2000,
  vainas: 1000,
  zapatos: 2500,
  zuecos: 2500,
};

const DEFAULT_FALLBACK_SHIPPING_WEIGHT_GRAMS = 2000;

const categoryLabels: Record<string, string> = {
  bandolera: "Bandoleras",
  billeteras: "Billeteras",
  bombillas: "Bombillas",
  botas: "Botas",
  carteras: "Carteras",
  cintos: "Cintos",
  cuchillos: "Cuchillos",
  "kits-materos": "Kits materos",
  materas: "Materas",
  mates: "Mates",
  "posa-mates": "Posa mates",
  personalizados: "Productos personalizados",
  tarjeteros: "Tarjeteros",
  termos: "Termos",
  zapatos: "Zapatos",
  zuecos: "Zuecos",
  "tablas-de-picar": "Tablas de picar",
  pinchos: "Pinchos",
  servilleteros: "Servilleteros",
  "porta-rollos": "Porta rollos",
  vainas: "Vainas",
  recado: "Recado",
  carona: "Carona",
};

function xml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cleanText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function absoluteUrl(siteUrl: string, path: string) {
  return new URL(path, `${siteUrl.replace(/\/$/, "")}/`).toString();
}

function formatPrice(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function preferredVariant(product: Product): ProductVariant | undefined {
  return product.variants
    .filter((variant) => variant.available !== false && variant.price && variant.price.amountMinor > 0)
    .sort((left, right) => left.price!.amountMinor - right.price!.amountMinor || left.value.localeCompare(right.value))[0];
}

function productImages(product: Product, siteUrl: string) {
  return product.images
    .filter((image) => image.src && !image.src.includes(FALLBACK_PRODUCT_IMAGE))
    .map((image) => absoluteUrl(siteUrl, image.src))
    .filter((url, index, urls) => /^https?:\/\//.test(url) && urls.indexOf(url) === index)
    .slice(0, 11);
}

function readableCategory(category: string) {
  return categoryLabels[category]
    ?? category.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function shippingWeightGrams(product: Product, variant: ProductVariant) {
  if (variant.weightGrams && variant.weightGrams > 0) return Math.round(variant.weightGrams);
  return fallbackShippingWeightGrams[product.category] ?? DEFAULT_FALLBACK_SHIPPING_WEIGHT_GRAMS;
}

function itemXml(product: Product, siteUrl: string) {
  const variant = preferredVariant(product);
  const images = productImages(product, siteUrl);
  const title = cleanText(product.name, 150);
  const description = cleanText(product.description || product.summary, 5000);
  if (!variant?.price || !title || !description || images.length === 0) return null;

  const link = absoluteUrl(siteUrl, `/producto/${encodeURIComponent(product.slug)}`);
  const id = cleanText(product.id, 50);
  if (!id) return null;

  const weightGrams = shippingWeightGrams(product, variant);

  const fields = [
    `    <g:id>${xml(id)}</g:id>`,
    `    <g:title>${xml(title)}</g:title>`,
    `    <g:description>${xml(description)}</g:description>`,
    `    <g:link>${xml(link)}</g:link>`,
    `    <g:image_link>${xml(images[0])}</g:image_link>`,
    ...images.slice(1).map((image) => `    <g:additional_image_link>${xml(image)}</g:additional_image_link>`),
    "    <g:condition>new</g:condition>",
    "    <g:availability>in_stock</g:availability>",
    `    <g:price>${xml(formatPrice(variant.price.amountMinor, variant.price.currency))}</g:price>`,
    `    <g:brand>${BRAND}</g:brand>`,
    `    <g:product_type>${xml(readableCategory(product.category))}</g:product_type>`,
    `    <g:shipping_weight>${weightGrams} g</g:shipping_weight>`,
  ];

  const sku = cleanText(variant.value, 70);
  if (sku) fields.push(`    <g:mpn>${xml(sku)}</g:mpn>`);

  return ["  <item>", ...fields, "  </item>"].join("\n");
}

export type GoogleMerchantFeed = {
  xml: string;
  itemCount: number;
  excludedCount: number;
};

/**
 * Builds one Merchant Center item per public product, using its lowest-priced web variant.
 * Variant SKUs are still sent as MPNs, while the stable product ID prevents churn when prices change.
 */
export function buildGoogleMerchantFeed(
  products: Product[],
  siteUrl: string,
): GoogleMerchantFeed {
  const items = products
    .map((product) => itemXml(product, siteUrl))
    .filter((item): item is string => Boolean(item));
  const baseUrl = siteUrl.replace(/\/$/, "");
  return {
    xml: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
      "<channel>",
      "  <title>MateArte Uruguay</title>",
      `  <link>${xml(baseUrl)}</link>`,
      "  <description>Catálogo de productos de MateArte Uruguay</description>",
      ...items,
      "</channel>",
      "</rss>",
      "",
    ].join("\n"),
    itemCount: items.length,
    excludedCount: products.length - items.length,
  };
}
