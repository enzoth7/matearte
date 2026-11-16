import type { Money, Product, ProductVariant } from "@/types/catalog";
import type { CatalogValueMap } from "../../../shared/catalog-taxonomy";

export type ComplementFamily = "mate" | "bombilla" | "termo" | "yerbero" | "matera" | "limpiabombillas" | "tarjetero" | "llavero" | "monedero" | "other";
// Stable catalog identifiers for legacy subtypes without their own category.
export const complementOverrides: Record<string, ComplementFamily> = { "limpia-bombillas": "limpiabombillas" };
export function complementFamily(product: Pick<Product, "id" | "slug" | "category" | "attributes">): ComplementFamily {
  const override = complementOverrides[product.id] ?? complementOverrides[product.slug];
  if (override) return override;
  if (product.category === "personalizados") return product.attributes?.["tipo-personalizado"] === "matera" ? "matera" : "mate";
  return ({ mates: "mate", bombillas: "bombilla", bombillones: "bombilla", termos: "termo", yerberos: "yerbero", materas: "matera", limpiabombillas: "limpiabombillas", tarjeteros: "tarjetero", llaveros: "llavero", monederos: "monedero" } as Record<string, ComplementFamily>)[product.category] ?? "other";
}

export type CartCatalogProduct = Pick<Product, "id" | "slug" | "name" | "category" | "attributes" | "purchaseAxes" | "variants" | "images"> & { family: ComplementFamily; quickVariantId?: string };
export type RecommendationSource = { variantId?: string; productId?: string; family?: ComplementFamily; price: Money; available?: boolean };
export type CartRecommendation = { product: CartCatalogProduct; variant: ProductVariant; tier: number; priority: number; priceUyu: number };

type QuickAddProduct = Pick<Product, "category" | "attributes" | "purchaseAxes" | "variants" | "saleMode">;

export function quickAddSelection(product: QuickAddProduct): { variantId: string; optionValues: CatalogValueMap } | undefined {
  if (product.saleMode === "made_to_order" || product.category === "personalizados" || product.attributes?.personalizado || product.attributes?.personalizacion) return;
  if (product.purchaseAxes?.some(axis => axis.values.length !== 1 || axis.values[0].value === "todos")) return;
  if (product.variants.length !== 1) return;
  const variant = product.variants[0];
  if (!variant.commerceId || variant.available !== true || !variant.price || !Number.isFinite(variant.price.amountMinor) || variant.price.amountMinor <= 0) return;
  if (Object.values(variant.options ?? {}).some(value => value === "todos" || Array.isArray(value))) return;
  const color = variant.options?.color ?? variant.color;
  const optionValues: CatalogValueMap = color ? { color: String(color) } : {};
  for (const axis of product.purchaseAxes ?? []) optionValues[axis.code] = axis.values[0].value;
  return { variantId: variant.commerceId, optionValues };
}

export function quickAddVariant(product: QuickAddProduct): string | undefined {
  return quickAddSelection(product)?.variantId;
}

export function toCartCatalog(products: Product[]): CartCatalogProduct[] {
  return products.filter(p => !p.editorial).map(p => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, attributes: p.attributes,
    purchaseAxes: p.purchaseAxes, variants: p.variants, images: p.images,
    family: complementFamily(p), quickVariantId: quickAddVariant(p),
  }));
}

export function priceInUyu(price: Money, rates: Record<string, number>): number | null {
  const rate = price.currency === "UYU" ? 1 : rates[price.currency];
  return Number.isFinite(rate) && rate > 0 && Number.isFinite(price.amountMinor) && price.amountMinor > 0 ? price.amountMinor * rate : null;
}

const complements: Partial<Record<ComplementFamily, ComplementFamily[]>> = {
  mate: ["bombilla", "termo", "yerbero"], yerbero: ["mate", "bombilla"], termo: ["mate", "bombilla"],
  matera: ["mate", "termo", "bombilla"], bombilla: ["limpiabombillas"],
};
const accessories: ComplementFamily[] = ["tarjetero", "llavero", "monedero"];

export function recommendForCart(catalog: CartCatalogProduct[], sources: RecommendationSource[], rates: Record<string, number>, useBasePrice = false): CartRecommendation[] {
  const byVariant = new Map(catalog.flatMap(p => p.variants.flatMap(v => [[v.id, p], ...(v.commerceId ? [[v.commerceId, p] as const] : [])] as Array<readonly [string, CartCatalogProduct]>)));
  const resolved = sources.map(s => ({ ...s, product: s.variantId ? byVariant.get(s.variantId) : catalog.find(p => p.id === s.productId) }));
  const presentIds = new Set(resolved.flatMap(s => [s.productId, s.product?.id].filter(Boolean)));
  const presentFamilies = new Set(resolved.map(s => s.product?.family ?? s.family ?? "other"));
  const candidates: CartRecommendation[] = [];
  for (const product of catalog) {
    if (presentIds.has(product.id) || presentFamilies.has(product.family) || product.family === "other") continue;
    const variants = product.variants.filter(v => v.available === true && v.commerceId && v.price).map(v => ({ ...v, price: useBasePrice ? v.basePrice ?? v.price : v.price }));
    const prices = variants.map(variant => ({ variant, uyu: priceInUyu(variant.price!, rates) })).filter(v => v.uyu !== null).sort((a,b) => a.uyu! - b.uyu!);
    const cheapest = prices[0];
    if (!cheapest) continue;
    let best: CartRecommendation | undefined;
    for (const source of resolved) {
      if (source.available === false) continue;
      const family = source.product?.family ?? source.family ?? "other";
      const generic = !complements[family];
      const targets = complements[family] ?? accessories;
      const priority = targets.indexOf(product.family);
      if (priority < 0) continue;
      const sourceVariant = source.product?.variants.find(v => v.id === source.variantId || v.commerceId === source.variantId);
      const currentPrice = useBasePrice ? sourceVariant?.basePrice ?? sourceVariant?.price : sourceVariant?.price;
      const budget = priceInUyu(currentPrice ?? source.price, rates);
      if (!budget || cheapest.uyu! > budget * (generic ? .35 : .70)) continue;
      const candidate = { product, variant: cheapest.variant, tier: cheapest.uyu! <= budget * .35 ? 0 : 1, priority, priceUyu: cheapest.uyu! };
      if (!best || candidate.tier < best.tier || (candidate.tier === best.tier && candidate.priority < best.priority)) best = candidate;
    }
    if (best) candidates.push(best);
  }
  candidates.sort((a,b) => a.tier - b.tier || a.priority - b.priority || a.priceUyu - b.priceUyu || a.product.id.localeCompare(b.product.id));
  const familyCounts = new Map<ComplementFamily, number>();
  return candidates.filter(c => {
    const count = familyCounts.get(c.product.family) ?? 0;
    familyCounts.set(c.product.family, count + 1);
    return count < 2;
  }).slice(0,4);
}
