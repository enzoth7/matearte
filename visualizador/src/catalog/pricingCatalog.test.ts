import { describe, expect, it } from "vitest";
import { resolveMateSelection, type MateFamilyId, type MateSelection } from "./mateDecisionCatalog";
import { getActivePricingRuleKeys, getSelectionPricing, type PublishedPricingCatalog } from "./pricingCatalog";

const CURRENT_VALUES: Record<string, number> = {
  "family:camionero": 1800,
  "family:imperial": 2600,
  "family:torpedo": 1800,
  "family:criollo": 0,
  "tree:imperial:cincelado-premium": 3000,
  "metal:plata-900": 17500,
  "tree:criollo:torpedo-criollo-posa-mate": 1300,
  "metal:criollo:torpedo-criollo-posa-mate:alpaca-grande-lacre": 2500,
  "tree:criollo:imperial-criollo-posa-mate": 1900,
  "metal:criollo:imperial-criollo-posa-mate:alpaca-grande-lacre": 3000,
  "tree:criollo:camionero-criollo-posa-mate": 1300,
  "leather:stamped": 200,
  "leather:raw": 600,
  "leather:print-pelos": 600,
  "leather:vaqueta": 400,
  "leather:raw-posa-mate": 650,
  "metal:alpaca-bronce": 300,
  "metal:alpaca-grande": 300,
  "customization:laser:rim_text": 300,
  "customization:laser:rim_image": 400,
  "customization:bronze-applique:rim_text": 150,
  "customization:bronze-applique:rim_image": 400,
  "customization:bronze-applique:fleje_text": 150,
  "customization:bronze-applique:fleje_image": 400,
  "customization:alpaca-applique:rim_text": 150,
  "customization:alpaca-applique:rim_image": 400,
  "customization:alpaca-applique:fleje_text": 150,
  "customization:alpaca-applique:fleje_image": 400,
  "commission:mercado_pago": 12,
};

const catalog: PublishedPricingCatalog = {
  versionId: "canonical-test",
  version: 1,
  publishedAt: "2026-08-24T00:00:00.000Z",
  rules: CURRENT_VALUES,
};

function selection(familyId: MateFamilyId, textureId: string, colorId: string, metalId: string): MateSelection {
  return { familyId, textureId, colorId, metalId, sizeId: "medio", engravingTypeId: null, flejeEngravingTypeId: null };
}

describe("reglas canónicas de precios", () => {
  it("mantiene sincronizada la lista activa con los valores iniciales de la migración", () => {
    expect(new Set(getActivePricingRuleKeys())).toEqual(new Set(Object.keys(CURRENT_VALUES)));
  });

  it.each([
    ["Camionero cuero crudo", selection("camionero", "alpaca-cincelado-patas", "cuero-crudo", "alpaca-comun"), 2400],
    ["Imperial Premium natural", selection("imperial", "cincelado-premium", "natural", "original-imperial"), 5600],
    ["Imperial Plata 900 print", selection("imperial", "virola-plata-900", "print", "plata-900"), 20700],
    ["Torpedo estampado alpaca y bronce", selection("torpedo", "cuero-estampado", "natural", "alpaca-bronce"), 2300],
    ["Torpedo cuero crudo alpaca grande", selection("torpedo", "cuero-crudo", "cuero-crudo", "alpaca-grande"), 2700],
    ["Criollo Torpedo natural al lacre", selection("criollo", "torpedo-criollo-posa-mate", "vaqueta", "alpaca-grande-lacre-torpedo"), 4200],
    ["Criollo Torpedo negro al lacre", selection("criollo", "torpedo-criollo-posa-mate", "negro", "alpaca-grande-lacre-torpedo"), 4200],
    ["Criollo Imperial cuero crudo", selection("criollo", "imperial-criollo-posa-mate", "cuero-crudo-criollo", "alpaca-grande-criollo"), 2550],
  ])("calcula %s desde componentes aditivos", (_label, selected, expected) => {
    const pricing = getSelectionPricing(catalog, selected);
    expect(pricing?.isPriceReady).toBe(true);
    expect(pricing?.totalUYU).toBe(expected);
  });

  it("reutiliza una única regla de cuero crudo entre árboles compatibles", () => {
    const camionero = resolveMateSelection(selection("camionero", "alpaca-cincelado-patas", "cuero-crudo", "alpaca-comun"));
    const imperial = resolveMateSelection(selection("imperial", "imperial-clasico", "cuero-crudo", "original-imperial"));
    const torpedo = resolveMateSelection(selection("torpedo", "cuero-crudo", "cuero-crudo", "alpaca-comun"));
    [camionero, imperial, torpedo].forEach((product) => expect(product?.pricingRuleKeys).toContain("leather:raw"));
  });

  it("no usa importes de respaldo cuando falta Supabase o una regla aplicable", () => {
    const selected = selection("torpedo", "cuero-crudo", "cuero-crudo", "alpaca-grande");
    const unavailable = getSelectionPricing(null, selected);
    expect(unavailable?.isPriceReady).toBe(false);
    expect(unavailable?.totalUYU).toBe(0);

    const incompleteCatalog = { ...catalog, rules: { ...catalog.rules } };
    delete incompleteCatalog.rules["leather:raw"];
    const incomplete = getSelectionPricing(incompleteCatalog, selected);
    expect(incomplete?.isPriceReady).toBe(false);
    expect(incomplete?.missingRuleKeys).toContain("leather:raw");
  });
});
