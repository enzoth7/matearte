import { describe, expect, it } from "vitest";
import { calculateRimCharacterLayout, createArcPath, getRimGeometryProfile } from "./rimGeometry";
import { getDefaultColor, getDefaultVariant, getVariantsByModel } from "./mateCatalog";
import { createDefaultRimSelection, MAX_RIM_TEXT_LENGTH } from "./rimCatalog";
import { calculateOrderPricing, getCustomizationPrice } from "./pricingCatalog";
import { createDefaultFlejeCustomization, normalizeFlejeCustomization, type MateConfiguration } from "../types/customizer";
import { validateCustomizationFile } from "../services/customizationAsset";

function createConfiguration(): MateConfiguration {
  const variant = getDefaultVariant("imperial");
  return {
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
});

describe("precios centralizados", () => {
  it("aplica los importes requeridos y cobra cada cara configurada", () => {
    const configuration = createConfiguration();
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

    const pricing = calculateOrderPricing(configuration, fleje);
    expect(getCustomizationPrice("rim_text")).toBe(150);
    expect(getCustomizationPrice("rim_image")).toBe(400);
    expect(getCustomizationPrice("fleje_image")).toBe(500);
    expect(pricing.extrasUYU).toBe(150 + 400 + 150 * 2 + 500);
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

