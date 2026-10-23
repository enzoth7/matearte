import type {
  CatalogColorId,
  CatalogCollectionId,
  CatalogMaterialId,
  CatalogProductTypeId,
  CategorySlug,
  Product,
  ProductVariant,
} from "@/types/catalog";
import { catalogAttributeDetails, defaultCatalogTaxonomy } from "../../../shared/catalog-taxonomy";

export const categoryOptions = [
  { value: "todas", labelKey: "all" },
  { value: "billeteras", labelKey: "wallets" },
  { value: "bombillas", labelKey: "bombillas" },
  { value: "botas", labelKey: "boots" },
  { value: "zuecos", labelKey: "clogs" },
  { value: "carteras", labelKey: "bags" },
  { value: "cintos", labelKey: "belts" },
  { value: "cuchillos", labelKey: "knives" },
  { value: "kits-materos", labelKey: "kitMatero" },
  { value: "materas", labelKey: "materas" },
  { value: "mates", labelKey: "mates" },
  { value: "personalizados", labelKey: "customMates" },
  { value: "termos", labelKey: "termos" },
] as const;

export const priceRangeOptions = [
  { value: "menos-3000", labelKey: "under3000", min: 0, max: 3000 },
  { value: "3000-4999", labelKey: "from3000", min: 3000, max: 5000 },
  { value: "5000-6999", labelKey: "from5000", min: 5000, max: 7000 },
  { value: "7000-mas", labelKey: "from7000", min: 7000, max: Number.POSITIVE_INFINITY },
] as const;

export const materialOptions: ReadonlyArray<{ value: CatalogMaterialId; labelKey: "leather" | "silver" | "alpaca" | "stainlessSteel" | "otherMetals" | "wood" | "patterned" }> = [
  { value: "cuero", labelKey: "leather" },
  { value: "plata", labelKey: "silver" },
  { value: "alpaca", labelKey: "alpaca" },
  { value: "acero-inoxidable", labelKey: "stainlessSteel" },
  { value: "otros-metales", labelKey: "otherMetals" },
  { value: "madera", labelKey: "wood" },
  { value: "estampado", labelKey: "patterned" },
];

export const productTypeOptions: ReadonlyArray<{ value: CatalogProductTypeId; labelKey: "imperial" | "camionero" | "criollo" | "torpedo" }> = [
  { value: "imperial", labelKey: "imperial" },
  { value: "camionero", labelKey: "camionero" },
  { value: "criollo", labelKey: "criollo" },
  { value: "torpedo", labelKey: "torpedo" },
];

export type CatalogColorOption = { value: CatalogColorId; labelKey: string; color: string; secondaryColor?: string; showWhenAvailable?: boolean };

export const colorOptions: ReadonlyArray<CatalogColorOption> = [
  { value: "marron", labelKey: "brown", color: "#6c4530" },
  { value: "negro", labelKey: "black", color: "#241d1a" },
  { value: "natural", labelKey: "natural", color: "#cfaf79" },
  { value: "cuero-crudo", labelKey: "rawLeather", color: "#e8d9bb" },
  { value: "rojo", labelKey: "red", color: "#a83232" },
  { value: "blanco", labelKey: "white", color: "#f5f5f5" },
  { value: "rosado", labelKey: "pink", color: "#e8a4a4" },
  { value: "gris", labelKey: "gray", color: "#8c8c8c" },
  { value: "dorado", labelKey: "gold", color: "#c9a859" },
  { value: "celeste", labelKey: "skyBlue", color: "#74acdf" },
  { value: "azul", labelKey: "blue", color: "#1e3a8a" },
  { value: "beige", labelKey: "beige", color: "#dfd1b8" },
  { value: "metalico", labelKey: "metallic", color: "#9b9b95" },
  { value: "marron-claro", labelKey: "lightBrown", color: "#a67b5b", showWhenAvailable: true },
  { value: "negro-dorado", labelKey: "blackGold", color: "#241d1a", secondaryColor: "#c9a859", showWhenAvailable: true },
  { value: "marron-dorado", labelKey: "brownGold", color: "#6c4530", secondaryColor: "#c9a859", showWhenAvailable: true },
  { value: "blanco-plateado", labelKey: "whiteSilver", color: "#f5f5f5", secondaryColor: "#9b9b95", showWhenAvailable: true },
  { value: "blanco-dorado", labelKey: "whiteGold", color: "#f5f5f5", secondaryColor: "#c9a859", showWhenAvailable: true },
  { value: "marron-blanco", labelKey: "brownWhite", color: "#6c4530", secondaryColor: "#f5f5f5", showWhenAvailable: true },
  { value: "negro-marron", labelKey: "blackBrown", color: "#241d1a", secondaryColor: "#6c4530", showWhenAvailable: true },
  { value: "beige-dorado", labelKey: "beigeGold", color: "#dfd1b8", secondaryColor: "#c9a859", showWhenAvailable: true },
  { value: "negro-blanco", labelKey: "blackWhite", color: "#241d1a", secondaryColor: "#f5f5f5", showWhenAvailable: true },
];

export function getColorSwatchBackground(colorId: string): string | undefined {
  const option = colorOptions.find((item) => item.value === colorId);
  if (!option) return undefined;
  return option.secondaryColor
    ? `linear-gradient(90deg, ${option.color} 0 50%, ${option.secondaryColor} 50% 100%)`
    : option.color;
}

export const collectionOptions: ReadonlyArray<{ value: CatalogCollectionId; label: string }> = [
  { value: "estribo", label: "Estribo" },
  { value: "uruguay", label: "Uruguay" },
  { value: "alfonsina", label: "Alfonsina" },
  { value: "sonia", label: "Sonia" },
];

export type PriceRangeId = (typeof priceRangeOptions)[number]["value"];
export type CatalogSort = "nuevo" | "precio-asc" | "precio-desc" | "nombre-asc" | "nombre-desc";

export type CatalogFilters = {
  search: string;
  category: "todas" | CategorySlug;
  collections: CatalogCollectionId[];
  prices: PriceRangeId[];
  materials: CatalogMaterialId[];
  productTypes: CatalogProductTypeId[];
  colors: CatalogColorId[];
  sort: CatalogSort;
};

const categoryIds: ReadonlySet<string> = new Set(categoryOptions.map((option) => option.value));
const priceIds: ReadonlySet<string> = new Set(priceRangeOptions.map((option) => option.value));
const materialIds: ReadonlySet<string> = new Set(materialOptions.map((option) => option.value));
const productTypeIds: ReadonlySet<string> = new Set(productTypeOptions.map((option) => option.value));
const colorIds: ReadonlySet<string> = new Set(colorOptions.map((option) => option.value));
const collectionIds: ReadonlySet<string> = new Set(collectionOptions.map((option) => option.value));
const sortIds = new Set<CatalogSort>(["nuevo", "precio-asc", "precio-desc", "nombre-asc", "nombre-desc"]);

function validValues<T extends string>(params: URLSearchParams, key: string, allowed: ReadonlySet<string>) {
  return [...new Set(params.getAll(key).filter((value): value is T => allowed.has(value)))];
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const rawCategory = params.get("categoria") ?? "todas";
  const categoryValue = rawCategory === "kit-matero" ? "kits-materos" : rawCategory === "cuchillo" ? "cuchillos" : rawCategory === "mates-personalizados" || rawCategory === "materas-personalizadas" ? "personalizados" : rawCategory;
  const requestedSort = params.get("orden") ?? "nuevo";
  const sortValue = requestedSort === "precio" ? "precio-asc" : requestedSort === "nombre" ? "nombre-asc" : requestedSort;
  return {
    search: (params.get("filter") ?? "").trim(),
    category: categoryIds.has(categoryValue) ? categoryValue as CatalogFilters["category"] : "todas",
    collections: validValues<CatalogCollectionId>(params, "coleccion", collectionIds),
    prices: validValues<PriceRangeId>(params, "precio", priceIds),
    materials: validValues<CatalogMaterialId>(params, "material", materialIds),
    productTypes: validValues<CatalogProductTypeId>(params, "tipo", productTypeIds),
    colors: validValues<CatalogColorId>(params, "color", colorIds),
    sort: sortIds.has(sortValue as CatalogSort) ? sortValue as CatalogSort : "nuevo",
  };
}

export function writeCatalogFilters(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("filter", filters.search.trim());
  if (filters.category !== "todas") params.set("categoria", filters.category);
  filters.collections.forEach((value) => params.append("coleccion", value));
  if (filters.sort !== "nuevo") params.set("orden", filters.sort);
  filters.prices.forEach((value) => params.append("precio", value));
  filters.materials.forEach((value) => params.append("material", value));
  filters.productTypes.forEach((value) => params.append("tipo", value));
  filters.colors.forEach((value) => params.append("color", value));
  return params;
}

export function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getProductTypes(product: Product) {
  return product.filterData.productTypes ?? (product.filterData.mateType ? [product.filterData.mateType] : []);
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Checks if a variant label matches a given catalog color ID.
 */
export function matchVariantWithColor(variantLabel: string, color: CatalogColorId): boolean {
  const norm = variantLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  switch (color) {
    case "negro":
      return norm.includes("negr") || norm.includes("black");
    case "marron":
      return norm.includes("marr") || norm.includes("brown") || norm.includes("suela") || norm.includes("chocolate") || norm.includes("cafe");
    case "natural":
      return norm.includes("natural");
    case "cuero-crudo":
      return norm.includes("crudo") || norm.includes("raw");
    case "rojo":
      return norm.includes("roj") || norm.includes("red") || norm.includes("bordo");
    case "blanco":
      return norm.includes("blanc") || norm.includes("white");
    case "rosado":
      return norm.includes("rosad") || norm.includes("rosa") || norm.includes("pink");
    case "gris":
      return norm.includes("gris") || norm.includes("gray") || norm.includes("grey");
    case "dorado":
      return norm.includes("dorad") || norm.includes("oro") || norm.includes("gold");
    case "celeste":
      return norm.includes("celeste") || norm.includes("sky");
    case "azul":
      return norm.includes("azul") || norm.includes("blue") || norm.includes("marino");
    case "beige":
      return norm.includes("beige") || norm.includes("arena") || norm.includes("crema") || norm.includes("nude") || norm.includes("camel");
    case "metalico":
      return norm.includes("metalico") || norm.includes("metallic");
    default:
      return false;
  }
}

/**
 * Returns the CatalogColorId that corresponds to a variant or variant label, if any.
 * If v.color is present, uses it directly.
 */
export function getVariantColorId(
  variantOrLabel: ProductVariant | string,
  explicitColor?: CatalogColorId | null,
): CatalogColorId | undefined {
  if (typeof variantOrLabel === "object" && variantOrLabel !== null) {
    const optionColor = variantOrLabel.options?.color;
    if (typeof optionColor === "string" && colorIds.has(optionColor)) return optionColor as CatalogColorId;
    if (variantOrLabel.color) return variantOrLabel.color;
    return getVariantColorId(variantOrLabel.label);
  }
  if (explicitColor) return explicitColor;
  const norm = variantOrLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const directCode = norm.trim().replace(/[\s/]+/g, "-");
  if (colorIds.has(directCode)) return directCode as CatalogColorId;
  if (norm.includes("negr") || norm.includes("black")) return "negro";
  if (norm.includes("marr") || norm.includes("brown") || norm.includes("suela") || norm.includes("chocolate") || norm.includes("cafe")) return "marron";
  if (norm.includes("crudo") || norm.includes("raw")) return "cuero-crudo";
  if (norm.includes("natural")) return "natural";
  if (norm.includes("roj") || norm.includes("red") || norm.includes("bordo")) return "rojo";
  if (norm.includes("blanc") || norm.includes("white")) return "blanco";
  if (norm.includes("rosad") || norm.includes("rosa") || norm.includes("pink")) return "rosado";
  if (norm.includes("gris") || norm.includes("gray") || norm.includes("grey")) return "gris";
  if (norm.includes("dorad") || norm.includes("oro") || norm.includes("gold")) return "dorado";
  if (norm.includes("celeste") || norm.includes("sky")) return "celeste";
  if (norm.includes("azul") || norm.includes("blue") || norm.includes("marino")) return "azul";
  if (norm.includes("beige") || norm.includes("arena") || norm.includes("crema") || norm.includes("nude") || norm.includes("camel")) return "beige";
  if (norm.includes("metalico") || norm.includes("metallic")) return "metalico";
  return undefined;
}

/**
 * Returns the hex color string for a variant or variant label.
 * If v.color is present, uses it directly.
 */
export function getVariantColorHex(
  variantOrLabel: ProductVariant | string,
  explicitColor?: CatalogColorId | null,
): string {
  const colorId = typeof variantOrLabel === "object" && variantOrLabel !== null
    ? getVariantColorId(variantOrLabel)
    : (explicitColor ?? getVariantColorId(variantOrLabel));

  if (colorId) {
    const found = colorOptions.find((opt) => opt.value === colorId);
    if (found) return found.color;
    const taxonomyColor = defaultCatalogTaxonomy.options.find((option) => option.attribute_code === "color" && option.code === colorId);
    if (taxonomyColor?.swatch_hex) return taxonomyColor.swatch_hex;
  }
  const label = typeof variantOrLabel === "object" && variantOrLabel !== null ? variantOrLabel.label : variantOrLabel;
  const norm = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (norm.includes("celeste") || norm.includes("sky")) return "#74acdf";
  if (norm.includes("azul") || norm.includes("blue")) return "#1e3a8a";
  if (norm.includes("beige") || norm.includes("arena")) return "#dfd1b8";
  if (norm.includes("verde") || norm.includes("green")) return "#2d5a27";
  return "#cccccc";
}

export function getVariantColorBackground(
  variantOrLabel: ProductVariant | string,
  explicitColor?: CatalogColorId | null,
): string {
  const colorId = getVariantColorId(variantOrLabel, explicitColor);
  return (colorId && getColorSwatchBackground(colorId)) || getVariantColorHex(variantOrLabel, explicitColor);
}

/**
 * Finds the first variant of a product that matches any of the given colors.
 * Searches first by v.color === color and then by name match.
 */
export function findMatchingVariantForColors(
  product: Product,
  colors: CatalogColorId[]
): ProductVariant | undefined {
  if (!product.variants || product.variants.length === 0 || colors.length === 0) return undefined;
  for (const color of colors) {
    const variant = product.variants.find((v) => getVariantColorId(v) === color);
    if (variant) return variant;
  }
  for (const color of colors) {
    const variant = product.variants.find((v) => matchVariantWithColor(v.label, color));
    if (variant) return variant;
  }
  return undefined;
}

/**
 * Returns all colors associated with a product (from filterData and variant labels).
 * If the product has variants with color, uses those colors with priority.
 */
export function getProductColors(product: Product): CatalogColorId[] {
  const allVariants = product.variants ?? [];
  const availableVariants = allVariants.filter((variant) => variant.available !== false);
  const fromVariants = availableVariants
    .map((v) => getVariantColorId(v))
    .filter((c): c is CatalogColorId => Boolean(c));
  if (allVariants.length > 0) return [...new Set(fromVariants)];
  return [...new Set(product.filterData.colors ?? [])];
}

export function filterAndSortCatalog<T extends { product: Product }>(entries: T[], filters: CatalogFilters, locale = "es") {
  const searchTerms = normalizeSearchText(filters.search).split(/\s+/).filter(Boolean);
  const filtered = entries.filter(({ product }) => {
    const data = product.filterData;
    const variantPrices = (product.variants ?? [])
      .filter((variant) => variant.available !== false && variant.price && variant.price.amountMinor > 0)
      .map((variant) => variant.price!.amountMinor / 100);
    const prices = variantPrices.length > 0
      ? variantPrices
      : data.priceUYU !== undefined
        ? [data.priceUYU]
        : [];
    const categoryParent: Record<string,string> = { botas:"calzado", cintos:"marroquineria", billeteras:"marroquineria", carteras:"marroquineria" };
    const matchesCategory = filters.category === "todas" || product.category === filters.category || categoryParent[product.category] === filters.category;
    const matchesCollection = filters.collections.length === 0 || Boolean(data.collection && filters.collections.includes(data.collection));
    const matchesPrice = filters.prices.length === 0 || prices.some((price) => (
      filters.prices.some((rangeId) => {
        const range = priceRangeOptions.find((option) => option.value === rangeId);
        return Boolean(range && price >= range.min && price < range.max);
      })
    ));
    const matchesMaterial = filters.materials.length === 0 || data.materials.some((material) => filters.materials.includes(material));
    const matchesProductType = filters.productTypes.length === 0 || getProductTypes(product).some((type) => filters.productTypes.includes(type));
    const productColors = getProductColors(product);
    const matchesColor = filters.colors.length === 0 || productColors.some((color) => filters.colors.includes(color));
    const attributeDetails = product.attributeDetails ?? catalogAttributeDetails(defaultCatalogTaxonomy, product.attributes ?? {});
    const searchableText = normalizeSearchText([
      product.name,
      product.slug,
      product.category,
      product.eyebrow,
      product.summary,
      product.description,
      ...product.materials,
      ...data.materials,
      ...getProductTypes(product),
      ...productColors,
      data.collection ?? "",
      ...(product.variants ?? []).map((variant) => variant.label),
      ...attributeDetails.flatMap(detail => [detail.code, detail.label, String(detail.rawValue), ...detail.values]),
    ].join(" "));
    const matchesSearch = searchTerms.length === 0 || searchTerms.every((term) => searchableText.includes(term));
    return matchesSearch && matchesCategory && matchesCollection && matchesPrice && matchesMaterial && matchesProductType && matchesColor;
  });

  const byName = (a: T, b: T) => a.product.name.localeCompare(b.product.name, locale);
  if (filters.sort === "nuevo") {
    return [...filtered].sort((a, b) => (b.product.lastModifiedAt ?? 0) - (a.product.lastModifiedAt ?? 0) || byName(a, b));
  }
  if (filters.sort === "nombre-asc") return [...filtered].sort(byName);
  if (filters.sort === "nombre-desc") return [...filtered].sort((a, b) => -byName(a, b));
  return [...filtered].sort((a, b) => {
    const first = a.product.filterData.priceUYU;
    const second = b.product.filterData.priceUYU;
    if (first === undefined) return second === undefined ? byName(a, b) : 1;
    if (second === undefined) return -1;
    return (filters.sort === "precio-asc" ? first - second : second - first) || byName(a, b);
  });
}

export function formatCatalogPrice(priceUYU?: number, consultLabel = "Consultar", locale = "es", exchangeRates?: Record<string, number>) {
  if (priceUYU === undefined) return consultLabel;
  if (locale === "en" && exchangeRates?.USD) {
    const usd = Math.round(priceUYU / exchangeRates.USD);
    return `US$ ${new Intl.NumberFormat("en-US").format(usd)}`;
  }
  if (locale === "pt" && exchangeRates?.BRL) {
    const brl = Math.round(priceUYU / exchangeRates.BRL);
    return `R$ ${new Intl.NumberFormat("pt-BR").format(brl)}`;
  }
  return `$ ${new Intl.NumberFormat("es-UY").format(priceUYU)} UYU`;
}

export function hasActiveCatalogFilters(filters: CatalogFilters): boolean {
  return (
    filters.search.length > 0 ||
    filters.category !== "todas" ||
    filters.collections.length > 0 ||
    filters.prices.length > 0 ||
    filters.materials.length > 0 ||
    filters.productTypes.length > 0 ||
    filters.colors.length > 0
  );
}
