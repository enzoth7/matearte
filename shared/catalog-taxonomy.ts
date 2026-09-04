/**
 * Stable values shared by the store and the commerce admin.
 *
 * Labels are intentionally kept next to the applications: this file is the
 * storage/query contract, not a source of display copy.
 */
export const catalogCategoryIds = [
  "mates",
  "bombillas",
  "materas",
  "termos",
  "regalos",
  "dama",
  "caballero",
] as const;

export const catalogMaterialIds = [
  "cuero",
  "plata",
  "alpaca",
  "acero-inoxidable",
  "otros-metales",
  "madera",
] as const;

/** Shapes/styles that are useful across mates, bombillas and accessories. */
export const catalogProductTypeIds = [
  "imperial",
  "camionero",
  "criollo",
  "torpedo",
  "cuadrado",
  "ovalado",
  "fina",
  "bombillon",
  "pico-de-loro",
  "cinto",
  "billetera",
  "calzado",
  "bota",
] as const;

/** Details or treatments that can be shared by more than one product family. */
export const catalogFinishIds = [
  "premium",
  "clasico",
  "liso",
  "estampado",
  "cincelado",
  "con-aplique",
  "con-aros",
  "con-virola",
] as const;

export const catalogColorIds = [
  "marron",
  "negro",
  "natural",
  "colorado",
  "cuero-crudo",
  "cuero-tostado",
  "arena",
  "cacao",
  "salvia",
] as const;

export type CatalogCategoryId = (typeof catalogCategoryIds)[number];
export type CatalogMaterialId = (typeof catalogMaterialIds)[number];
export type CatalogProductTypeId = (typeof catalogProductTypeIds)[number];
export type CatalogFinishId = (typeof catalogFinishIds)[number];
export type CatalogColorId = (typeof catalogColorIds)[number];

export type CatalogAttributes = {
  materials: CatalogMaterialId[];
  productTypes: CatalogProductTypeId[];
  finishes: CatalogFinishId[];
  colors: CatalogColorId[];
};

export const emptyCatalogAttributes = (): CatalogAttributes => ({
  materials: [],
  productTypes: [],
  finishes: [],
  colors: [],
});

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function knownValues<T extends readonly string[]>(value: unknown, values: T): T[number][] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T[number] => isOneOf(item, values)))];
}

/** Safely accepts the JSONB value returned by Supabase. */
export function normalizeCatalogAttributes(value: unknown): CatalogAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyCatalogAttributes();
  const record = value as Record<string, unknown>;
  return {
    materials: knownValues(record.materials, catalogMaterialIds),
    productTypes: knownValues(record.productTypes, catalogProductTypeIds),
    finishes: knownValues(record.finishes, catalogFinishIds),
    colors: knownValues(record.colors, catalogColorIds),
  };
}
