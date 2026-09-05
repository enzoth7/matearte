/**
 * Stable values shared by the store and the commerce admin.
 *
 * Labels are intentionally kept next to the applications: this file is the
 * storage/query contract, not a source of display copy.
 */
export const catalogCategoryIds = [
  "mates",
  "bombillas",
  "bombillones",
  "materas",
  "termos",
  "regalos",
  "cintos",
  "calzado",
  "botas",
  "billeteras",
] as const;

export const catalogMaterialIds = [
  "cuero",
  "plata",
  "alpaca",
  "acero-inoxidable",
  "otros-metales",
  "madera",
  "estampado",
] as const;

/** The four mate models used by the catalog. */
export const catalogProductTypeIds = [
  "imperial",
  "camionero",
  "criollo",
  "torpedo",
] as const;

export const catalogColorIds = [
  "marron",
  "negro",
  "natural",
  "cuero-crudo",
] as const;

export type CatalogCategoryId = (typeof catalogCategoryIds)[number];
export type CatalogMaterialId = (typeof catalogMaterialIds)[number];
export type CatalogProductTypeId = (typeof catalogProductTypeIds)[number];
export type CatalogColorId = (typeof catalogColorIds)[number];

export type CatalogAttributes = {
  materials: CatalogMaterialId[];
  productTypes: CatalogProductTypeId[];
  finishes: string[];
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
    finishes: Array.isArray(record.finishes) ? record.finishes.filter((item): item is string => typeof item === 'string') : [],
    colors: knownValues(record.colors, catalogColorIds),
  };
}
