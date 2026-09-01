import {
  getMateFamily,
  getSelectionFromLegacyVariant,
  mateDecisionCatalog,
  resolveMateSelection,
  type DecisionTextureOption,
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

export interface SelectionPriceComponent {
  ruleKey: string;
  label: string;
  valueUYU: number;
  kind: "family" | "tree" | "leather" | "metal";
}

export interface SelectionPricing {
  totalUYU: number;
  breakdown: PricingBreakdown;
  components: SelectionPriceComponent[];
  ruleKeys: string[];
  missingRuleKeys: string[];
  isPriceReady: boolean;
}

export interface VariantDetails {
  name: string;
  virola: string;
  tipoCuero: string;
}

export interface OrderPriceItem {
  id: string;
  ruleKey: string;
  label: string;
  quantity: number;
  unitPriceUYU: number;
  totalUYU: number;
}

export interface OrderPricing {
  basePriceUYU: number;
  breakdown: PricingBreakdown | null;
  components: SelectionPriceComponent[];
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

export const ENGRAVING_CUSTOMIZATION_IDS = ["rim_text", "rim_image", "fleje_text", "fleje_image"] as const;
export type EngravingCustomizationId = typeof ENGRAVING_CUSTOMIZATION_IDS[number];

export const LEATHER_STAMPED_RULE_KEY = "leather:stamped";
export const LEATHER_RAW_RULE_KEY = "leather:raw";
export const LEATHER_PRINT_RULE_KEY = "leather:print-pelos";
export const LEATHER_VAQUETA_RULE_KEY = "leather:vaqueta";
export const LEATHER_RAW_POSA_MATE_RULE_KEY = "leather:raw-posa-mate";
export const METAL_ALPACA_BRONZE_RULE_KEY = "metal:alpaca-bronce";
export const METAL_ALPACA_GRANDE_RULE_KEY = "metal:alpaca-grande";
export const SILVER_900_RULE_KEY = "metal:plata-900";
export const COMMISSION_RULE_KEY = "commission:mercado_pago";

const CUSTOMIZATION_RULES: ReadonlyArray<readonly [EngravingTypeId, EngravingCustomizationId]> = [
  ["laser", "rim_text"],
  ["laser", "rim_image"],
  ["bronze-applique", "rim_text"],
  ["bronze-applique", "rim_image"],
  ["bronze-applique", "fleje_text"],
  ["bronze-applique", "fleje_image"],
  ["alpaca-applique", "rim_text"],
  ["alpaca-applique", "rim_image"],
  ["alpaca-applique", "fleje_text"],
  ["alpaca-applique", "fleje_image"],
];

const RULE_LABELS: Record<string, string> = {
  [LEATHER_STAMPED_RULE_KEY]: "Cuero estampado",
  [LEATHER_RAW_RULE_KEY]: "Cuero crudo",
  [LEATHER_PRINT_RULE_KEY]: "Print / pelos",
  [LEATHER_VAQUETA_RULE_KEY]: "Vaqueta",
  [LEATHER_RAW_POSA_MATE_RULE_KEY]: "Cuero crudo para posa mate",
  [METAL_ALPACA_BRONZE_RULE_KEY]: "Alpaca y bronce",
  [METAL_ALPACA_GRANDE_RULE_KEY]: "Alpaca grande",
  [SILVER_900_RULE_KEY]: "Plata 900",
};

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

// Helpers históricos: no participan en el cálculo vigente.
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

function collectCatalogRuleKeys() {
  const keys = new Set<string>();
  mateDecisionCatalog.forEach((family) => {
    family.pricingRuleKeys.forEach((key) => keys.add(key));
    family.textures.forEach((texture) => {
      texture.pricingRuleKeys?.forEach((key) => keys.add(key));
      texture.colors.forEach((color) => color.pricingRuleKeys?.forEach((key) => keys.add(key)));
      texture.metals.forEach((metal) => metal.pricingRuleKeys?.forEach((key) => keys.add(key)));
    });
  });
  return keys;
}

export function getActivePricingRuleKeys() {
  const keys = collectCatalogRuleKeys();
  CUSTOMIZATION_RULES.forEach(([technique, id]) => keys.add(customizationRuleKey(technique, id)));
  keys.add(COMMISSION_RULE_KEY);
  return [...keys];
}

export function getRequiredPricingRuleKeys() {
  return getActivePricingRuleKeys();
}

export function getPricingRuleLabel(key: string) {
  if (RULE_LABELS[key]) return RULE_LABELS[key];
  if (key.startsWith("family:")) return getMateFamily(key.split(":")[1] as MateFamilyId)?.label ?? key;
  if (key.startsWith("tree:")) {
    const [, familyId, textureId] = key.split(":");
    return getMateFamily(familyId as MateFamilyId)?.textures.find((texture) => texture.id === textureId)?.label ?? key;
  }
  if (key.includes("alpaca-grande-lacre")) return "Alpaca grande al lacre";
  return key;
}

function readRule(catalog: PublishedPricingCatalog | null, key: string) {
  const value = catalog?.rules[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function getComponentKind(key: string): SelectionPriceComponent["kind"] {
  if (key.startsWith("family:")) return "family";
  if (key.startsWith("tree:")) return "tree";
  if (key.startsWith("leather:")) return "leather";
  return "metal";
}

export function getSelectionPricing(catalog: PublishedPricingCatalog | null, selection: MateSelection): SelectionPricing | null {
  const resolved = resolveMateSelection(selection);
  if (!resolved) return null;

  const ruleKeys = resolved.pricingRuleKeys;
  const missingRuleKeys = ruleKeys.filter((key) => readRule(catalog, key) === null);
  const components = ruleKeys.flatMap((key): SelectionPriceComponent[] => {
    const valueUYU = readRule(catalog, key);
    return valueUYU === null ? [] : [{ ruleKey: key, label: getPricingRuleLabel(key), valueUYU, kind: getComponentKind(key) }];
  });
  const sumKind = (kind: SelectionPriceComponent["kind"]) => components
    .filter((component) => component.kind === kind)
    .reduce((total, component) => total + component.valueUYU, 0);
  const silverDeltaUYU = components
    .filter((component) => component.ruleKey === SILVER_900_RULE_KEY)
    .reduce((total, component) => total + component.valueUYU, 0);
  const breakdown: PricingBreakdown = {
    familyBaseUYU: sumKind("family"),
    leatherDeltaUYU: sumKind("leather"),
    silverDeltaUYU,
    textureDeltaUYU: sumKind("tree"),
    metalDeltaUYU: sumKind("metal") - silverDeltaUYU,
    sizeDeltaUYU: 0,
  };

  return {
    totalUYU: components.reduce((total, component) => total + component.valueUYU, 0),
    breakdown,
    components,
    ruleKeys,
    missingRuleKeys,
    isPriceReady: Boolean(catalog && missingRuleKeys.length === 0),
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
    .map((selection) => getSelectionPricing(catalog, selection))
    .filter((pricing): pricing is SelectionPricing => Boolean(pricing?.isPriceReady))
    .map((pricing) => pricing.totalUYU);
  return totals.length > 0 ? Math.min(...totals) : null;
}

export function getFamilyStartingPrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId) {
  return getStartingPrice(catalog, { familyId });
}

export function getFamilyBasePrice(catalog: PublishedPricingCatalog | null, familyId: MateFamilyId) {
  return readRule(catalog, familyRuleKey(familyId));
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

export function getTexturePricingRuleKeys(texture: DecisionTextureOption) {
  return [...new Set([
    ...(texture.pricingRuleKeys ?? []),
    ...texture.colors.flatMap((color) => color.pricingRuleKeys ?? []),
    ...texture.metals.flatMap((metal) => metal.pricingRuleKeys ?? []),
  ])];
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

export function getRimTextChargeQuantity(technique: EngravingTypeId | null, value: string) {
  const characterCount = countChargeableCharacters(value);
  return technique === "laser" && characterCount > 0 ? 1 : characterCount;
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
  const missingRuleKeys = [...(selectionPricing?.missingRuleKeys ?? [])];

  const addItem = (id: EngravingCustomizationId, label: string, quantity = 1, overrideTechnique?: EngravingTypeId | null) => {
    if (quantity <= 0) return;
    const activeTechnique = overrideTechnique ?? technique;
    if (!activeTechnique) {
      missingRuleKeys.push("selection:engraving");
      return;
    }
    const ruleKey = customizationRuleKey(activeTechnique, id);
    const unitPriceUYU = readRule(catalog, ruleKey);
    if (unitPriceUYU === null) {
      missingRuleKeys.push(ruleKey);
      return;
    }
    items.push({ id, ruleKey, label, quantity, unitPriceUYU, totalUYU: unitPriceUYU * quantity });
  };

  const structuredRimText = configuration.rim.texts?.map((item) => item.text).join("") ?? "";
  const rimText = configuration.rim.textMode === "text" ? (structuredRimText || configuration.rim.text) : "";
  addItem(
    "rim_text",
    technique === "laser" ? "Grabado láser de texto en virola" : "Letras de texto en virola",
    getRimTextChargeQuantity(technique, rimText),
  );
  if (configuration.rim.imageMode === "image") {
    addItem("rim_image", "Imágenes o escudos en virola", configuration.rim.icons.filter((icon) => icon.selectedImageId || icon.customImage).length);
  }

  if (configuration.capabilities.hasFleje) {
    const flejeTechnique = configuration.flejeEngravingTypeId ?? technique;
    const sides = Object.values(flejeConfig.sides);
    addItem("fleje_text", "Caracteres de texto en fleje", sides.reduce((total, side) => total + (side.textMode === "text" ? countChargeableCharacters(side.text) : 0), 0), flejeTechnique);
    addItem("fleje_image", "Imágenes o escudos en fleje", sides.reduce((total, side) => {
      if (side.imageMode !== "image") return total;
      const iconCount = side.icons.filter((icon) => icon.selectedImageId || icon.customImage).length;
      return total + (iconCount > 0 ? iconCount : side.selectedImageId || side.customImage ? 1 : 0);
    }, 0), flejeTechnique);
  }

  if (!technique) missingRuleKeys.push("selection:engraving");
  if (configuration.capabilities.hasFleje && !configuration.flejeEngravingTypeId) missingRuleKeys.push("selection:fleje-engraving");
  const extrasUYU = items.reduce((total, item) => total + item.totalUYU, 0);
  const uniqueMissingRuleKeys = [...new Set(missingRuleKeys)];
  const isPriceReady = Boolean(catalog && selectionPricing?.isPriceReady && uniqueMissingRuleKeys.length === 0);
  const hasSku = Boolean(configuration.skuId);

  return {
    basePriceUYU: selectionPricing?.totalUYU ?? 0,
    breakdown: selectionPricing?.breakdown ?? null,
    components: selectionPricing?.components ?? [],
    items,
    extrasUYU,
    totalUYU: (selectionPricing?.totalUYU ?? 0) + extrasUYU,
    catalogVersion: catalog?.version ?? null,
    catalogVersionId: catalog?.versionId ?? null,
    isPriceReady,
    hasSku,
    isCheckoutReady: isPriceReady && hasSku,
    missingRuleKeys: uniqueMissingRuleKeys,
    priceStatus: !catalog ? "unavailable" : isPriceReady ? "ready" : "pending",
  };
}
