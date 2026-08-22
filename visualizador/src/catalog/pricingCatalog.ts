import {
  getSelectionFromLegacyVariant,
  mateDecisionCatalog,
  resolveMateSelection,
  type EngravingTypeId,
  type MateFamilyId,
  type MateSelection,
  getMateFamily,
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
export const LEATHER_VAQUETA_RULE_KEY = "leather:vaqueta";
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
  const keys = new Set<string>();
  mateDecisionCatalog.forEach(family => {
    keys.add(familyRuleKey(family.id));
    family.textures.forEach(texture => {
      if (texture.priceDeltaUYU) keys.add(`texture:${family.id}:${texture.id}`);
      texture.colors.forEach(color => {
        if (color.priceDeltaUYU) keys.add(`color:${color.id}`);
      });
      texture.metals.forEach(metal => {
        if (metal.priceDeltaUYU) keys.add(`metal:${metal.id}`);
      });
    });
  });
  
  return [
    ...Array.from(keys),
    ...(["laser", "bronze-applique", "alpaca-applique"] as const).flatMap((technique) =>
      ENGRAVING_CUSTOMIZATION_IDS.map((id) => customizationRuleKey(technique, id)),
    ),
    COMMISSION_RULE_KEY,
  ];
}

export function getRequiredPricingRuleKeys() {
  return [COMMISSION_RULE_KEY];
}

function readRule(catalog: PublishedPricingCatalog | null, key: string) {
  const value = catalog?.rules[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function getSelectionPricing(catalog: PublishedPricingCatalog | null, selection: MateSelection): SelectionPricing | null {
  const resolved = resolveMateSelection(selection);
  if (!resolved || !selection.familyId) return null;
  const familyKey = familyRuleKey(selection.familyId);
  
  // Use DB rule or fallback to catalog defined delta
  const familyBaseUYU = readRule(catalog, familyKey) ?? resolved.price.baseUYU ?? 0;

  const textureKey = `texture:${selection.familyId}:${selection.textureId}`;
  const textureDeltaUYU = readRule(catalog, textureKey) ?? resolved.price.textureDeltaUYU ?? 0;

  const colorKey = `color:${selection.colorId}`;
  const colorDeltaUYU = readRule(catalog, colorKey) ?? resolved.price.colorDeltaUYU ?? 0;

  const metalKey = `metal:${selection.metalId}`;
  const metalDeltaUYU = readRule(catalog, metalKey) ?? resolved.price.metalDeltaUYU ?? 0;

  const breakdown: PricingBreakdown = {
    familyBaseUYU,
    leatherDeltaUYU: colorDeltaUYU,
    silverDeltaUYU: metalDeltaUYU,
    textureDeltaUYU,
    metalDeltaUYU,
    sizeDeltaUYU: 0,
  };
  return {
    totalUYU: familyBaseUYU + textureDeltaUYU + colorDeltaUYU + metalDeltaUYU,
    breakdown,
    ruleKeys: [familyKey, textureKey, colorKey, metalKey],
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
          flejeEngravingTypeId: null,
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

export function getFamilyBasePrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId) {
  const family = getMateFamily(familyId);
  if (!family) return null;
  return readRule(catalog, familyRuleKey(familyId)) ?? family.basePriceUYU;
}
export function getTextureStartingPrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId, textureId: string) {
  return getStartingPrice(catalog, { familyId, textureId });
}
export function getColorStartingPrice(catalog: PublishedPricingCatalog | null, selection: Partial<MateSelection> & { colorId: string }) {
  if (!selection.familyId || !selection.textureId) return null;
  return getStartingPrice(catalog, { familyId: selection.familyId, textureId: selection.textureId, colorId: selection.colorId });
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
    const selectionRuleKeys = selectionPricing?.ruleKeys ?? [];
    selectionRuleKeys.forEach((key) => {
      if (readRule(catalog, key) === null) missingRuleKeys.push(key);
    });
  }

  const addItem = (id: EngravingCustomizationId, label: string, quantity = 1, overrideTechnique?: EngravingTypeId | null) => {
    if (quantity <= 0) return;
    const activeTechnique = overrideTechnique ?? technique;
    if (!activeTechnique) {
      missingRuleKeys.push("selection:engraving");
      return;
    }
    const key = customizationRuleKey(activeTechnique, id);
    const unitPriceUYU = readRule(catalog, key);
    if (unitPriceUYU === null) {
      missingRuleKeys.push(key);
      return;
    }
    items.push({ id: key, label, quantity, unitPriceUYU, totalUYU: unitPriceUYU * quantity });
  };

  const structuredRimText = configuration.rim.texts?.map((item) => item.text).join("") ?? "";
  const rimText = configuration.rim.textMode === "text"
    ? (structuredRimText || configuration.rim.text)
    : "";
  addItem("rim_text", "Caracteres de texto en virola", countChargeableCharacters(rimText));
  if (configuration.rim.imageMode === "image") {
    addItem("rim_image", "Imágenes o escudos en virola", configuration.rim.icons.filter((icon) => icon.selectedImageId || icon.customImage).length);
  }

  if (configuration.capabilities.hasFleje) {
    const flejeTechnique = configuration.flejeEngravingTypeId ?? technique;
    const sides = Object.values(flejeConfig.sides);
    addItem("fleje_text", "Caracteres de texto en fleje", sides.reduce((total, side) => total + (side.textMode === "text" ? countChargeableCharacters(side.text) : 0), 0), flejeTechnique);
    addItem("fleje_image", "Imágenes o escudos en fleje", sides.reduce((total, side) => total + (side.imageMode === "image" ? side.icons.filter((icon) => icon.selectedImageId || icon.customImage).length : 0), 0), flejeTechnique);
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
