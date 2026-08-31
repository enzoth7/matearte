import { describe, expect, it } from "vitest";
import { calculateRimCharacterLayout, createArcPath, getRimGeometryProfile } from "./rimGeometry";
import { getDefaultColor, getDefaultVariant, getVariantsByModel } from "./mateCatalog";
import { createDefaultRimSelection, MAX_RIM_TEXT_LENGTH, normalizeRimSelection, sanitizeRimText } from "./rimCatalog";
import {
  calculateOrderPricing,
  countChargeableCharacters,
  customizationRuleKey,
  familyRuleKey,
  getRequiredPricingRuleKeys,
  getCustomizationPrice,
  getMercadoPagoCommissionPercent,
  getActivePricingRuleKeys,
  type PublishedPricingCatalog,
} from "./pricingCatalog";
import { createDefaultFlejeCustomization, normalizeFlejeCustomization, type MateConfiguration } from "../types/customizer";
import { validateCustomizationFile } from "../services/customizationAsset";
import { getSelectionFromLegacyVariant, getSelectionLabels, resolveMateSelection } from "./mateDecisionCatalog";

function createConfiguration(): MateConfiguration {
  const variant = getDefaultVariant("imperial");
  const selection = getSelectionFromLegacyVariant(variant.id, variant.defaultSize)!;
  const product = resolveMateSelection(selection)!;
  return {
    schemaVersion: 2,
    productId: product.productId,
    skuId: product.skuId,
    selection,
    selectionLabels: getSelectionLabels(selection),
    engravingTypeId: "laser",
    flejeEngravingTypeId: null,
    capabilities: product.capabilities,
    isLegacy: false,
    modelId: variant.model,
    variantId: variant.id,
    size: variant.defaultSize,
    colorId: getDefaultColor(variant).id,
    rim: createDefaultRimSelection(variant),
  };
}

describe("catálogo enriquecido", () => {
  it("expone los colores solicitados para Camionero e Imperial", () => {
    const camionero = getVariantsByModel("camionero").find((item) => item.id === "camionero-liso");
    const premium = getVariantsByModel("imperial").find((item) => item.id === "imperial-premium");
    const print = getVariantsByModel("imperial").find((item) => item.id === "imperial-print");

    expect(camionero?.colors.map((color) => color.id)).toEqual(["marron", "negro", "cuero-crudo", "natural"]);
    expect(premium?.colors.map((color) => color.id)).toEqual(["blanco", "marron", "negro", "rosa", "natural"]);
    expect(print?.colors.map((color) => color.id)).toEqual(["negro", "marron"]);
  });

  it("solo forma ramas de Torpedo a partir de productos existentes", () => {
    const torpedos = getVariantsByModel("torpedo");
    const branches = new Set(torpedos.map((item) => `${item.leatherType}:${item.rimType}`));
    expect(branches.has("cuero-crudo:alpaca-grande")).toBe(true);
    expect(branches.has("cuero-estampado:alpaca-grande")).toBe(true);
    expect(branches.has("cuero-crudo:otros")).toBe(false);
  });
});

describe("compatibilidad de personalizaciones", () => {
  it("normaliza en mayúsculas todos los textos de virola y fleje", () => {
    const variant = getDefaultVariant("imperial");
    const rim = normalizeRimSelection(variant, {
      text: "Richard",
      texts: [
        { id: "text-1", text: "Richard", transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side: "rim" } },
        { id: "text-2", text: "María José", transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side: "rim" } },
      ],
    });
    const fleje = normalizeFlejeCustomization({
      sides: {
        front: { textMode: "text", text: "Richard" },
        back: { textMode: "text", text: "María" },
      },
    });

    expect(sanitizeRimText("Richard pérez")).toBe("RICHARD PÉREZ");
    expect(rim.text).toBe("RICHARD");
    expect(rim.texts.map((item) => item.text)).toEqual(["RICHARD", "MARÍA JOSÉ"]);
    expect(fleje.sides.front.text).toBe("RICHARD");
    expect(fleje.sides.back.text).toBe("MARÍA");
  });

  it("migra el formato antiguo de fleje a la cara frontal", () => {
    const migrated = normalizeFlejeCustomization({
      finishMode: "finish",
      finishId: "pattern-1",
      textMode: "text",
      text: "ENZO",
      imageMode: "none",
      selectedImageId: null,
    });
    expect(migrated.sides.front.text).toBe("ENZO");
    expect(migrated.sides.back.text).toBe("");
    expect(migrated.sides.front.textTransform.side).toBe("front");
  });

  it("ajusta un texto de 40 caracteres dentro del arco", () => {
    const profile = getRimGeometryProfile("torpedo");
    const text = "A".repeat(40);
    const layout = calculateRimCharacterLayout(text, profile.textGeometry);
    const arcLength = profile.textGeometry.radius * 170 * Math.PI / 180;
    expect(MAX_RIM_TEXT_LENGTH).toBe(40);
    expect(layout.characters).toHaveLength(40);
    expect(layout.occupiedArcLength).toBeLessThanOrEqual(arcLength + 0.001);
    expect(createArcPath(profile.textGeometry)).toContain("A");
  });

  it("soporta hasta 2 textos independientes con curvatura invertida", () => {
    const profile = getRimGeometryProfile("torpedo");
    const topLayout = calculateRimCharacterLayout("ARRIBA", profile.textGeometry, false);
    const bottomLayout = calculateRimCharacterLayout("ABAJO", profile.textGeometry, true);

    expect(topLayout.characters).toHaveLength(6);
    expect(bottomLayout.characters).toHaveLength(5);

    // Top text middle character is near top (y < centerY)
    const topMid = topLayout.characters[3];
    expect(topMid.y).toBeLessThan(profile.textGeometry.centerY);

    // Inverted text middle character is near bottom center (y > centerY) and upright
    const bottomMid = bottomLayout.characters[2];
    expect(bottomMid.y).toBeGreaterThan(profile.textGeometry.centerY);
    expect(Math.abs(bottomMid.rotation)).toBeLessThan(15);
  });
});

describe("precios centralizados", () => {
  it("declara una regla única para cada rama y adicional activo", () => {
    const keys = getRequiredPricingRuleKeys();
    expect(keys).toEqual(expect.arrayContaining([
      "family:camionero",
      "family:imperial",
      "family:torpedo",
      "family:criollo",
      "leather:raw",
      "leather:print-pelos",
      "metal:alpaca-bronce",
      "metal:alpaca-grande",
      "customization:alpaca-applique:fleje_image",
      "commission:mercado_pago",
    ]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((key) => key.includes(":color:"))).toBe(false);
    expect(keys.some((key) => key.includes("finish"))).toBe(false);
    expect(keys).toEqual(getActivePricingRuleKeys());
  });

  it("aplica los importes requeridos y cobra cada cara configurada", () => {
    const configuration = createConfiguration();
    const selection = configuration.selection;
    const productRuleKeys = resolveMateSelection(selection)!.pricingRuleKeys;
    const catalog: PublishedPricingCatalog = {
      versionId: "pricing-test",
      version: 7,
      publishedAt: "2026-08-20T00:00:00.000Z",
      rules: {
        ...Object.fromEntries(productRuleKeys.map((key) => [key, key === familyRuleKey(selection.familyId!) ? 928 : 0])),
        [customizationRuleKey("bronze-applique", "rim_text")]: 150,
        [customizationRuleKey("bronze-applique", "rim_image")]: 400,
        [customizationRuleKey("bronze-applique", "fleje_text")]: 150,
        [customizationRuleKey("bronze-applique", "fleje_image")]: 500,
      },
    };
    configuration.engravingTypeId = "bronze-applique";
    configuration.flejeEngravingTypeId = "bronze-applique";
    configuration.rim.textMode = "text";
    configuration.rim.text = "MATEARTE";
    configuration.rim.imageMode = "image";
    configuration.rim.icons = [{ id: "1", selectedImageId: "corazon", customImage: null, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side: "rim" } }];
    const fleje = createDefaultFlejeCustomization();
    fleje.sides.front.textMode = "text";
    fleje.sides.front.text = "FRENTE";
    fleje.sides.back.textMode = "text";
    fleje.sides.back.text = "DORSO";
    fleje.sides.front.imageMode = "image";
    fleje.sides.front.selectedImageId = "auf";

    const pricing = calculateOrderPricing(configuration, fleje, catalog);
    expect(getCustomizationPrice(catalog, "bronze-applique", "rim_text")).toBe(150);
    expect(getCustomizationPrice(catalog, "bronze-applique", "rim_image")).toBe(400);
    expect(getCustomizationPrice(catalog, "bronze-applique", "fleje_image")).toBe(500);
    expect(pricing.extrasUYU).toBe(150 * 8 + 400 + 150 * 11 + 500);
    expect(pricing.catalogVersion).toBe(7);
    expect(pricing.isCheckoutReady).toBe(true);
  });

  it("cobra únicamente letras y números, incluidos caracteres acentuados", () => {
    expect(countChargeableCharacters("Árbol 123, 🧉!" )).toBe(8);
  });

  it("solo exige una tarifa de grabado cuando esa personalización está activa", () => {
    const configuration = createConfiguration();
    configuration.engravingTypeId = "bronze-applique";
    configuration.flejeEngravingTypeId = "bronze-applique";
    const productRuleKeys = resolveMateSelection(configuration.selection)!.pricingRuleKeys;
    const catalog: PublishedPricingCatalog = {
      versionId: "optional-rules",
      version: 8,
      publishedAt: "2026-08-21T00:00:00.000Z",
      rules: { ...Object.fromEntries(productRuleKeys.map((key) => [key, key.startsWith("family:") ? 1000 : 0])), "commission:mercado_pago": 12 },
    };
    expect(calculateOrderPricing(configuration, createDefaultFlejeCustomization(), catalog).isPriceReady).toBe(true);
    configuration.rim.textMode = "text";
    configuration.rim.text = "A";
    const pending = calculateOrderPricing(configuration, createDefaultFlejeCustomization(), catalog);
    expect(pending.isPriceReady).toBe(false);
    expect(pending.missingRuleKeys).toContain(customizationRuleKey("bronze-applique", "rim_text"));
    expect(getMercadoPagoCommissionPercent(catalog)).toBe(12);
  });

  it("bloquea el checkout si Supabase no entregó un catálogo publicado", () => {
    const configuration = createConfiguration();
    const pricing = calculateOrderPricing(configuration, createDefaultFlejeCustomization(), null);

    expect(pricing.priceStatus).toBe("unavailable");
    expect(pricing.totalUYU).toBe(0);
    expect(pricing.isCheckoutReady).toBe(false);
  });
});

describe("validación de archivos", () => {
  it("acepta PNG/JPG/SVG y rechaza tipo o tamaño inválido", () => {
    const file = (type: string, size: number) => ({ type, size }) as File;
    expect(validateCustomizationFile(file("image/png", 1024))).toBeNull();
    expect(validateCustomizationFile(file("image/jpeg", 1024))).toBeNull();
    expect(validateCustomizationFile(file("image/svg+xml", 1024))).toBeNull();
    expect(validateCustomizationFile(file("application/pdf", 1024))).toMatch(/PNG/);
    expect(validateCustomizationFile(file("image/png", 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
});
