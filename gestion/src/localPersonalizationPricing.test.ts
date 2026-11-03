import { describe, expect, it } from "vitest";
import { createPersonalizationDraft } from "./localPersonalization";
import { calculateLocalPersonalizationPrice, parsePublishedLocalPricing } from "./localPersonalizationPricing";

const catalog = parsePublishedLocalPricing({ versionId: "published-1", version: 3, rules: {
  "customization:laser:rim_text": 120,
  "customization:bronze-applique:rim_text": 25,
  "customization:bronze-applique:rim_image": 350,
  "customization:bronze-applique:fleje_text": 15,
  "customization:bronze-applique:fleje_image": 450,
  "customization:alpaca-applique:rim_text": 30,
  "customization:alpaca-applique:rim_image": 400,
} });

describe("precio de mates personalizados en ventas locales", () => {
  it("cuenta todos los logos activos en apliques y mantiene una sola tarifa de láser", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "logo";
    draft.rimLogos = Array.from({ length: 40 }, (_, index) => ({ id: `logo-${index}`, file: {} as File, enabled: index !== 0 }));
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(12000);
    draft.rimTechnique = "bronze-applique";
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(39 * 35000);
    draft.rimTechnique = "alpaca-applique";
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(39 * 40000);
    draft.rimLogos = draft.rimLogos.map(logo => ({ ...logo, enabled: false }));
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(0);
  });
  it("incluye íconos de biblioteca y cuenta imagen e ícono por separado en apliques", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "logo";
    draft.rimIconId = "corazon";
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(12000);
    draft.rimTechnique = "bronze-applique";
    draft.rimLogoFile = {} as File;
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(70000);
  });
  it("cobra el texto láser de la virola una sola vez", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "MATE 123";
    draft.rimText2 = "ENZO";
    expect(calculateLocalPersonalizationPrice(draft, catalog)).toMatchObject({ extrasMinor: 12000, missingRuleKeys: [] });
  });

  it("suma ambos textos al precio de letras de aplique", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimTechnique = "bronze-applique";
    draft.rimText = "ANA";
    draft.rimText2 = "LUZ 2";
    expect(calculateLocalPersonalizationPrice(draft, catalog).items).toMatchObject([{ quantity: 7, totalMinor: 17500 }]);
  });

  it("cobra un único grabado láser por texto y logo juntos, o solo por logo", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "text-logo";
    draft.rimText = "MATE";
    draft.rimLogoFile = {} as File;
    expect(calculateLocalPersonalizationPrice(draft, catalog).extrasMinor).toBe(12000);
    draft.rimContent = "logo";
    expect(calculateLocalPersonalizationPrice(draft, catalog).items.map((item) => item.ruleKey)).toEqual(["customization:laser:rim_text"]);
  });

  it("cobra cada carácter de aplique y cada logo según las reglas publicadas", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimTechnique = "bronze-applique";
    draft.rimContent = "text-logo";
    draft.rimText = "A B2";
    draft.rimLogoFile = {} as File;
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "text-logo";
    draft.flejeFrontText = "AB";
    draft.flejeBackText = "3";
    draft.flejeLogoFile = {} as File;
    const price = calculateLocalPersonalizationPrice(draft, catalog);
    expect(price.items.map((item) => [item.ruleKey, item.quantity])).toEqual([
      ["customization:bronze-applique:rim_text", 3],
      ["customization:bronze-applique:rim_image", 1],
      ["customization:bronze-applique:fleje_text", 3],
      ["customization:bronze-applique:fleje_image", 1],
    ]);
    expect(price.extrasMinor).toBe(92000);
  });
  it("cobra solo las copias del logo temporal agregadas al fleje", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimTechnique = "none";
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "logo";
    draft.flejeLogoFile = {} as File;
    for (const sides of [[], ["front"], ["front", "back"], ["back"], []] as ("front" | "back")[][]) {
      draft.flejeLogoSides = sides;
      const quote = calculateLocalPersonalizationPrice(draft, catalog);
      expect(quote.extrasMinor).toBe(sides.length * 45000);
    }
  });
  it("cobra los íconos del frente y del dorso del fleje", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimTechnique = "none";
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "logo";
    draft.flejeIcons = [
      { id: "front", selectedImageId: "sol", side: "front" },
      { id: "back", selectedImageId: "corazon", side: "back" },
    ];
    expect(calculateLocalPersonalizationPrice(draft, catalog).items).toMatchObject([
      { ruleKey: "customization:bronze-applique:fleje_image", quantity: 2 },
    ]);
  });

  it("indica cuándo falta publicar una tarifa necesaria", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "A";
    expect(calculateLocalPersonalizationPrice(draft, null).missingRuleKeys).toEqual(["customization:laser:rim_text"]);
  });
});

describe("precio de materas y bombillas personalizadas en ventas locales", () => {
  it("cobra el grabado láser por aplicación, no por letra", () => {
    const draft = createPersonalizationDraft("bombilla");
    draft.bombillaText = "ANA";
    expect(calculateLocalPersonalizationPrice(draft, catalog)).toMatchObject({
      extrasMinor: 12000,
      items: [{ ruleKey: "customization:laser:rim_text", quantity: 1 }],
      missingRuleKeys: [],
    });
  });

  it("cobra un logo en el frente y otro en la tapa de la matera", () => {
    const draft = createPersonalizationDraft("matera");
    draft.materaLogoFile = {} as File;
    draft.materaPlacement = "front-lid";
    expect(calculateLocalPersonalizationPrice(draft, catalog)).toMatchObject({
      extrasMinor: 24000,
      items: [{ ruleKey: "customization:laser:rim_text", quantity: 2 }],
      missingRuleKeys: [],
    });
  });

  it("cobra por letra e imagen para el aplique de alpaca", () => {
    const draft = createPersonalizationDraft("matera");
    draft.materaTechnique = "alpaca-applique";
    draft.materaContent = "text-logo";
    draft.materaText = "A B2";
    draft.materaLogoFile = {} as File;
    const price = calculateLocalPersonalizationPrice(draft, catalog);
    expect(price.items.map((item) => [item.ruleKey, item.quantity])).toEqual([
      ["customization:alpaca-applique:rim_text", 3],
      ["customization:alpaca-applique:rim_image", 1],
    ]);
    expect(price.extrasMinor).toBe(49000);
  });

  it("bloquea el precio si falta una tarifa publicada", () => {
    const draft = createPersonalizationDraft("bombilla");
    draft.bombillaTechnique = "bronze-applique";
    draft.bombillaContent = "logo";
    draft.bombillaLogoFile = {} as File;
    expect(calculateLocalPersonalizationPrice(draft, null).missingRuleKeys).toEqual(["customization:bronze-applique:rim_image"]);
  });
});
