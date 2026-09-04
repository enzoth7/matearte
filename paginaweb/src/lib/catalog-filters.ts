import type {
  CatalogColorId,
  CatalogFinishId,
  CatalogMaterialId,
  CatalogProductTypeId,
  CategorySlug,
  Product,
} from "@/types/catalog";

export const categoryOptions = [
  { value: "todas", labelKey: "all" },
  { value: "mates", labelKey: "mates" },
  { value: "bombillas", labelKey: "bombillas" },
  { value: "materas", labelKey: "materas" },
  { value: "termos", labelKey: "termos" },
  { value: "regalos", labelKey: "gifts" },
  { value: "dama", labelKey: "women" },
  { value: "caballero", labelKey: "men" },
] as const;

export const priceRangeOptions = [
  { value: "menos-3000", labelKey: "under3000", min: 0, max: 3000 },
  { value: "3000-4999", labelKey: "from3000", min: 3000, max: 5000 },
  { value: "5000-6999", labelKey: "from5000", min: 5000, max: 7000 },
  { value: "7000-mas", labelKey: "from7000", min: 7000, max: Number.POSITIVE_INFINITY },
] as const;

export const materialOptions: ReadonlyArray<{ value: CatalogMaterialId; labelKey: "leather" | "silver" | "alpaca" | "stainlessSteel" | "otherMetals" | "wood" }> = [
  { value: "cuero", labelKey: "leather" },
  { value: "plata", labelKey: "silver" },
  { value: "alpaca", labelKey: "alpaca" },
  { value: "acero-inoxidable", labelKey: "stainlessSteel" },
  { value: "otros-metales", labelKey: "otherMetals" },
  { value: "madera", labelKey: "wood" },
];

export const productTypeOptions: ReadonlyArray<{ value: CatalogProductTypeId; labelKey: "imperial" | "camionero" | "criollo" | "torpedo" | "square" | "oval" | "fine" | "bombillon" | "parrotBeak" | "belt" | "wallet" | "footwear" | "boot" }> = [
  { value: "imperial", labelKey: "imperial" },
  { value: "camionero", labelKey: "camionero" },
  { value: "criollo", labelKey: "criollo" },
  { value: "torpedo", labelKey: "torpedo" },
  { value: "cuadrado", labelKey: "square" },
  { value: "ovalado", labelKey: "oval" },
  { value: "fina", labelKey: "fine" },
  { value: "bombillon", labelKey: "bombillon" },
  { value: "pico-de-loro", labelKey: "parrotBeak" },
  { value: "cinto", labelKey: "belt" },
  { value: "billetera", labelKey: "wallet" },
  { value: "calzado", labelKey: "footwear" },
  { value: "bota", labelKey: "boot" },
];

export const finishOptions: ReadonlyArray<{ value: CatalogFinishId; labelKey: "premium" | "classic" | "smooth" | "patterned" | "chiseled" | "withAplique" | "withRings" | "withFerrule" }> = [
  { value: "premium", labelKey: "premium" },
  { value: "clasico", labelKey: "classic" },
  { value: "liso", labelKey: "smooth" },
  { value: "estampado", labelKey: "patterned" },
  { value: "cincelado", labelKey: "chiseled" },
  { value: "con-aplique", labelKey: "withAplique" },
  { value: "con-aros", labelKey: "withRings" },
  { value: "con-virola", labelKey: "withFerrule" },
];

export const colorOptions: ReadonlyArray<{ value: CatalogColorId; labelKey: "brown" | "black" | "natural" | "red" | "rawLeather" | "toastedLeather" | "sand" | "cocoa" | "sage"; color: string }> = [
  { value: "marron", labelKey: "brown", color: "#6c4530" },
  { value: "negro", labelKey: "black", color: "#241d1a" },
  { value: "natural", labelKey: "natural", color: "#cfaf79" },
  { value: "colorado", labelKey: "red", color: "#9b3d2c" },
  { value: "cuero-crudo", labelKey: "rawLeather", color: "#e8d9bb" },
  { value: "cuero-tostado", labelKey: "toastedLeather", color: "#9a6848" },
  { value: "arena", labelKey: "sand", color: "#c8ad83" },
  { value: "cacao", labelKey: "cocoa", color: "#654130" },
  { value: "salvia", labelKey: "sage", color: "#8e9275" },
];

export type PriceRangeId = (typeof priceRangeOptions)[number]["value"];
export type CatalogSort = "editorial" | "nombre" | "precio";

export type CatalogFilters = {
  category: "todas" | CategorySlug;
  prices: PriceRangeId[];
  materials: CatalogMaterialId[];
  productTypes: CatalogProductTypeId[];
  finishes: CatalogFinishId[];
  colors: CatalogColorId[];
  sort: CatalogSort;
};

const categoryIds: ReadonlySet<string> = new Set(categoryOptions.map((option) => option.value));
const priceIds: ReadonlySet<string> = new Set(priceRangeOptions.map((option) => option.value));
const materialIds: ReadonlySet<string> = new Set(materialOptions.map((option) => option.value));
const productTypeIds: ReadonlySet<string> = new Set(productTypeOptions.map((option) => option.value));
const finishIds: ReadonlySet<string> = new Set(finishOptions.map((option) => option.value));
const colorIds: ReadonlySet<string> = new Set(colorOptions.map((option) => option.value));
const sortIds = new Set<CatalogSort>(["editorial", "nombre", "precio"]);

function validValues<T extends string>(params: URLSearchParams, key: string, allowed: ReadonlySet<string>) {
  return [...new Set(params.getAll(key).filter((value): value is T => allowed.has(value)))];
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const categoryValue = params.get("categoria") ?? "todas";
  const sortValue = params.get("orden") ?? "editorial";
  return {
    category: categoryIds.has(categoryValue) ? categoryValue as CatalogFilters["category"] : "todas",
    prices: validValues<PriceRangeId>(params, "precio", priceIds),
    materials: validValues<CatalogMaterialId>(params, "material", materialIds),
    productTypes: validValues<CatalogProductTypeId>(params, "tipo", productTypeIds),
    finishes: validValues<CatalogFinishId>(params, "terminacion", finishIds),
    colors: validValues<CatalogColorId>(params, "color", colorIds),
    sort: sortIds.has(sortValue as CatalogSort) ? sortValue as CatalogSort : "editorial",
  };
}

export function writeCatalogFilters(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.category !== "todas") params.set("categoria", filters.category);
  if (filters.sort !== "editorial") params.set("orden", filters.sort);
  filters.prices.forEach((value) => params.append("precio", value));
  filters.materials.forEach((value) => params.append("material", value));
  filters.productTypes.forEach((value) => params.append("tipo", value));
  filters.finishes.forEach((value) => params.append("terminacion", value));
  filters.colors.forEach((value) => params.append("color", value));
  return params;
}

export function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getProductTypes(product: Product) {
  return product.filterData.productTypes ?? (product.filterData.mateType ? [product.filterData.mateType] : []);
}

export function filterAndSortCatalog<T extends { product: Product }>(entries: T[], filters: CatalogFilters, locale = "es") {
  const filtered = entries.filter(({ product }) => {
    const data = product.filterData;
    const matchesCategory = filters.category === "todas" || product.category === filters.category;
    const matchesPrice = filters.prices.length === 0 || (
      data.priceUYU !== undefined && filters.prices.some((rangeId) => {
        const range = priceRangeOptions.find((option) => option.value === rangeId);
        return Boolean(range && data.priceUYU! >= range.min && data.priceUYU! < range.max);
      })
    );
    const matchesMaterial = filters.materials.length === 0 || data.materials.some((material) => filters.materials.includes(material));
    const matchesProductType = filters.productTypes.length === 0 || getProductTypes(product).some((type) => filters.productTypes.includes(type));
    const matchesFinish = filters.finishes.length === 0 || (data.finishes ?? []).some((finish) => filters.finishes.includes(finish));
    const matchesColor = filters.colors.length === 0 || Boolean(data.colors?.some((color) => filters.colors.includes(color)));
    return matchesCategory && matchesPrice && matchesMaterial && matchesProductType && matchesFinish && matchesColor;
  });

  if (filters.sort === "nombre") return [...filtered].sort((a, b) => a.product.name.localeCompare(b.product.name, locale));
  if (filters.sort === "precio") return [...filtered].sort((a, b) => (a.product.filterData.priceUYU ?? Number.POSITIVE_INFINITY) - (b.product.filterData.priceUYU ?? Number.POSITIVE_INFINITY));
  return filtered;
}

export function formatCatalogPrice(priceUYU?: number, consultLabel = "Consultar") {
  if (priceUYU === undefined) return consultLabel;
  return `$ ${new Intl.NumberFormat("es-UY").format(priceUYU)} UYU`;
}
