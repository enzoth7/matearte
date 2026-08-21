import {
  getSelectionFromLegacyVariant,
  mateDecisionCatalog,
  resolveMateSelection,
  type EngravingTypeId,
  type MateFamilyId,
  type MateSelection,
} from "./mateDecisionCatalog";
import { normalizeProductName, type MateSize } from "./mateCatalog";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";

export interface PublishedPricingCatalog {
  versionId: string;
  version: number;
  publishedAt: string;
  rules: Record<string, number>;
}

export interface PricingBreakdown {
  familyBaseUYU: number;
  leatherDeltaUYU: number;
  silverDeltaUYU: number;
  textureDeltaUYU: number;
  metalDeltaUYU: number;
  sizeDeltaUYU: number;
}

export interface SelectionPricing {
  totalUYU: number;
  breakdown: PricingBreakdown;
  ruleKeys: string[];
}

export interface VariantDetails {
  name: string;
  virola: string;
  tipoCuero: string;
}

export interface OrderPriceItem {
  id: string;
  label: string;
  quantity: number;
  unitPriceUYU: number;
  totalUYU: number;
}

export interface OrderPricing {
  basePriceUYU: number;
  breakdown: PricingBreakdown | null;
  items: OrderPriceItem[];
  extrasUYU: number;
  totalUYU: number;
  catalogVersion: number | null;
  catalogVersionId: string | null;
  isPriceReady: boolean;
  hasSku: boolean;
  isCheckoutReady: boolean;
  missingRuleKeys: string[];
  priceStatus: "ready" | "pending" | "unavailable";
}

export const ENGRAVING_CUSTOMIZATION_IDS = [
  "rim_finish",
  "rim_text",
  "rim_image",
  "fleje_finish",
  "fleje_text",
  "fleje_image",
] as const;
export type EngravingCustomizationId = typeof ENGRAVING_CUSTOMIZATION_IDS[number];

export const LEATHER_STAMPED_RULE_KEY = "leather:stamped";
export const LEATHER_RAW_RULE_KEY = "leather:raw";
export const LEATHER_PRINT_RULE_KEY = "leather:print-pelos";
export const SILVER_900_RULE_KEY = "metal:plata-900";
export const COMMISSION_RULE_KEY = "commission:mercado_pago";

export const variantDetailsMap: Record<string, VariantDetails> = {};

export function updateVariantDetails(id: string, details: Partial<VariantDetails>) {
  variantDetailsMap[id] = {
    name: normalizeProductName(details.name || variantDetailsMap[id]?.name || ""),
    virola: details.virola || variantDetailsMap[id]?.virola || "",
    tipoCuero: details.tipoCuero || variantDetailsMap[id]?.tipoCuero || "",
  };
}

export function getVariantDetails(id: string): VariantDetails | undefined {
  return variantDetailsMap[id];
}

export function familyRuleKey(familyId: string) {
  return `family:${familyId}`;
}

// Legacy key helpers are retained so historical snapshots remain readable.
export function textureRuleKey(familyId: string, textureId: string) {
  return `texture:${familyId}:${textureId}`;
}
export function metalRuleKey(familyId: string, textureId: string, colorId: string, metalId: string) {
  return `metal:${familyId}:${textureId}:${colorId}:${metalId}`;
}
export function sizeRuleKey(familyId: string, textureId: string, colorId: string, metalId: string, sizeId: MateSize) {
  return `size:${familyId}:${textureId}:${colorId}:${metalId}:${sizeId}`;
}

export function customizationRuleKey(technique: EngravingTypeId, id: EngravingCustomizationId | string) {
  return `customization:${technique}:${id}`;
}

export function getActivePricingRuleKeys() {
  return [
    ...mateDecisionCatalog.map((family) => familyRuleKey(family.id)),
    LEATHER_STAMPED_RULE_KEY,
    LEATHER_RAW_RULE_KEY,
    LEATHER_PRINT_RULE_KEY,
    SILVER_900_RULE_KEY,
    ...(["laser", "bronze-applique"] as const).flatMap((technique) =>
      ENGRAVING_CUSTOMIZATION_IDS.map((id) => customizationRuleKey(technique, id)),
    ),
    COMMISSION_RULE_KEY,
  ];
}

export function getRequiredPricingRuleKeys() {
  return [LEATHER_STAMPED_RULE_KEY, LEATHER_RAW_RULE_KEY, COMMISSION_RULE_KEY];
}

function readRule(catalog: PublishedPricingCatalog | null, key: string) {
  const value = catalog?.rules[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

type LeatherCategory = "standard" | "stamped" | "raw" | "print-pelos";

export function classifyLeather(selection: Partial<MateSelection>): LeatherCategory {
  const textureId = selection.textureId ?? "";
  const colorId = selection.colorId ?? "";
  if (textureId === "cuero-crudo" || textureId === "imperial-cuero-crudo" || colorId === "cuero-crudo") return "raw";
  if (textureId === "cuero-estampado") return "stamped";
  if (
    textureId.includes("print")
    || textureId.includes("pelo")
    || colorId.includes("print")
    || colorId.includes("pelo")
    || colorId === "animal-print"
    || colorId === "marron-blanco"
    || colorId === "negro-blanco"
  ) return "print-pelos";
  return "standard";
}

function leatherRuleKey(category: LeatherCategory) {
  if (category === "stamped") return LEATHER_STAMPED_RULE_KEY;
  if (category === "raw") return LEATHER_RAW_RULE_KEY;
  if (category === "print-pelos") return LEATHER_PRINT_RULE_KEY;
  return null;
}

export function getSelectionPricing(catalog: PublishedPricingCatalog | null, selection: MateSelection): SelectionPricing | null {
  if (!catalog || !resolveMateSelection(selection) || !selection.familyId) return null;
  const familyKey = familyRuleKey(selection.familyId);
  const familyBaseUYU = readRule(catalog, familyKey);
  if (familyBaseUYU === null) return null;

  const category = classifyLeather(selection);
  const leatherKey = leatherRuleKey(category);
  const leatherDeltaUYU = leatherKey ? readRule(catalog, leatherKey) : 0;
  const usesSilver = selection.metalId === "plata-900";
  const silverDeltaUYU = usesSilver ? readRule(catalog, SILVER_900_RULE_KEY) : 0;
  if (leatherDeltaUYU === null || silverDeltaUYU === null) return null;

  const breakdown: PricingBreakdown = {
    familyBaseUYU,
    leatherDeltaUYU,
    silverDeltaUYU,
    textureDeltaUYU: leatherDeltaUYU,
    metalDeltaUYU: silverDeltaUYU,
    sizeDeltaUYU: 0,
  };
  return {
    totalUYU: familyBaseUYU + leatherDeltaUYU + silverDeltaUYU,
    breakdown,
    ruleKeys: [familyKey, ...(leatherKey ? [leatherKey] : []), ...(usesSilver ? [SILVER_900_RULE_KEY] : [])],
  };
}

export function listCatalogSelections(filters?: { familyId?: MateFamilyId; textureId?: string }) {
  return mateDecisionCatalog.flatMap((family) => {
    if (filters?.familyId && family.id !== filters.familyId) return [];
    return family.textures.flatMap((texture) => {
      if (filters?.textureId && texture.id !== filters.textureId) return [];
      return texture.colors.flatMap((color) => texture.metals.flatMap((metal) =>
        texture.sizes.map((sizeId): MateSelection => ({
          familyId: family.id,
          textureId: texture.id,
          colorId: color.id,
          metalId: metal.id,
          sizeId,
          engravingTypeId: null,
        })),
      ));
    });
  });
}

function getStartingPrice(catalog: PublishedPricingCatalog | null, filters?: { familyId?: MateFamilyId; textureId?: string; colorId?: string; metalId?: string }) {
  const totals = listCatalogSelections(filters)
    .filter((selection) => !filters?.colorId || selection.colorId === filters.colorId)
    .filter((selection) => !filters?.metalId || selection.metalId === filters.metalId)
    .map((selection) => getSelectionPricing(catalog, selection)?.totalUYU ?? null)
    .filter((value): value is number => value !== null && value > 0);
  return totals.length > 0 ? Math.min(...totals) : null;
}

export function getFamilyStartingPrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId) {
  return getStartingPrice(catalog, { familyId });
}
export function getTextureStartingPrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId, textureId: string) {
  return getStartingPrice(catalog, { familyId, textureId });
}
export function getMetalStartingPrice(catalog: PublishedPricingCatalog | null, selection: MateSelection) {
  if (!selection.familyId || !selection.textureId || !selection.colorId || !selection.metalId) return null;
  return getStartingPrice(catalog, { familyId: selection.familyId, textureId: selection.textureId, colorId: selection.colorId, metalId: selection.metalId });
}

export function getCustomizationPrice(catalog: PublishedPricingCatalog | null, technique: EngravingTypeId | null, id: EngravingCustomizationId | string) {
  return technique ? readRule(catalog, customizationRuleKey(technique, id)) : null;
}
export function getMercadoPagoCommissionPercent(catalog: PublishedPricingCatalog | null) {
  return readRule(catalog, COMMISSION_RULE_KEY);
}
export function formatUYU(value: number) {
  return `$ ${value.toLocaleString("es-UY", { maximumFractionDigits: 2 })} UYU`;
}
export function countChargeableCharacters(value: string) {
  return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

function configurationSelection(configuration: MateConfiguration): MateSelection | null {
  if (resolveMateSelection(configuration.selection)) return configuration.selection;
  return getSelectionFromLegacyVariant(configuration.variantId, configuration.size);
}

export function calculateOrderPricing(configuration: MateConfiguration, flejeConfig: FlejeCustomization, catalog: PublishedPricingCatalog | null): OrderPricing {
  const selection = configurationSelection(configuration);
  const selectionPricing = selection ? getSelectionPricing(catalog, selection) : null;
  const technique = configuration.engravingTypeId ?? configuration.selection.engravingTypeId;
  const items: OrderPriceItem[] = [];
  const missingRuleKeys: string[] = [];

  if (selection && catalog) {
    const selectionRuleKeys = [
      ...(selection.familyId ? [familyRuleKey(selection.familyId)] : []),
      ...(leatherRuleKey(classifyLeather(selection)) ? [leatherRuleKey(classifyLeather(selection))!] : []),
      ...(selection.metalId === "plata-900" ? [SILVER_900_RULE_KEY] : []),
    ];
    selectionRuleKeys.forEach((key) => {
      if (readRule(catalog, key) === null) missingRuleKeys.push(key);
    });
  }

  const addItem = (id: EngravingCustomizationId, label: string, quantity = 1) => {
    if (quantity <= 0) return;
    if (!technique) {
      missingRuleKeys.push("selection:engraving");
      return;
    }
    const key = customizationRuleKey(technique, id);
    const unitPriceUYU = readRule(catalog, key);
    if (unitPriceUYU === null) {
      missingRuleKeys.push(key);
      return;
    }
    items.push({ id: key, label, quantity, unitPriceUYU, totalUYU: unitPriceUYU * quantity });
  };

  if (configuration.rim.finishMode === "finish") addItem("rim_finish", "Terminación de virola");
  const structuredRimText = configuration.rim.texts?.map((item) => item.text).join("") ?? "";
  const rimText = configuration.rim.textMode === "text"
    ? (structuredRimText || configuration.rim.text)
    : "";
  addItem("rim_text", "Caracteres de texto en virola", countChargeableCharacters(rimText));
  if (configuration.rim.imageMode === "image") {
    addItem("rim_image", "Imágenes o escudos en virola", configuration.rim.icons.filter((icon) => icon.selectedImageId || icon.customImage).length);
  }

  if (configuration.capabilities.hasFleje) {
    if (flejeConfig.finishMode === "finish") addItem("fleje_finish", "Terminación de fleje");
    const sides = Object.values(flejeConfig.sides);
    addItem("fleje_text", "Caracteres de texto en fleje", sides.reduce((total, side) => total + (side.textMode === "text" ? countChargeableCharacters(side.text) : 0), 0));
    addItem("fleje_image", "Imágenes o escudos en fleje", sides.filter((side) => side.imageMode === "image" && (side.selectedImageId || side.customImage)).length);
  }

  const extrasUYU = items.reduce((total, item) => total + item.totalUYU, 0);
  const isPriceReady = Boolean(catalog && selectionPricing && technique && missingRuleKeys.length === 0);
  const hasSku = Boolean(configuration.skuId);
  return {
    basePriceUYU: selectionPricing?.totalUYU ?? 0,
    breakdown: selectionPricing?.breakdown ?? null,
    items,
    extrasUYU,
    totalUYU: (selectionPricing?.totalUYU ?? 0) + extrasUYU,
    catalogVersion: catalog?.version ?? null,
    catalogVersionId: catalog?.versionId ?? null,
    isPriceReady,
    hasSku,
    isCheckoutReady: isPriceReady && hasSku,
    missingRuleKeys: [...new Set(missingRuleKeys)],
    priceStatus: !catalog ? "unavailable" : isPriceReady ? "ready" : "pending",
  };
}
