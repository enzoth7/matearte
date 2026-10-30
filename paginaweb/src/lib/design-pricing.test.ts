import { describe, expect, it } from "vitest";
import { calculateDesignPriceMinor } from "./design-pricing";

const catalog = {
  versionId: "11111111-1111-4111-8111-111111111111", version: 7,
  rules: {
    "family:torpedo": 1800,
    "metal:alpaca-bronce": 300,
    "customization:laser:rim_text": 300,
  },
};

const configuration = {
  skuId: "torpedo-test",
  selection: { familyId: "torpedo", textureId: "cuero-liso", colorId: "natural", metalId: "alpaca-bronce", sizeId: "medio", engravingTypeId: "laser" },
  engravingTypeId: "laser",
  capabilities: { hasFleje: false },
  rim: { textMode: "text", texts: [{ text: "MATEARTE" }], imageMode: "none", icons: [] },
};

describe("server design pricing", () => {
  it("recalculates from published rules and ignores a browser price snapshot", () => {
    const result = calculateDesignPriceMinor({ ...configuration, pricingSnapshot: { totalUYU: 1 } }, {}, catalog);
    expect(result.priceMinor).toBe(240_000);
    expect(result.pricingVersion).toBe(7);
  });

  it.each(["solo íconos", "texto e íconos"])("cobra un único grabado láser con %s", (caseName) => {
    const rim = {
      textMode: caseName === "solo íconos" ? "none" : "text",
      texts: [{ text: "MATEARTE" }],
      imageMode: "image",
      icons: [{ selectedImageId: "escudo-1" }, { selectedImageId: "escudo-2" }, { selectedImageId: "escudo-3" }],
    };
    expect(calculateDesignPriceMinor({ ...configuration, rim }, {}, catalog).priceMinor).toBe(240_000);
  });

  it("rejects a catalog combination invented by the browser", () => {
    expect(() => calculateDesignPriceMinor({ ...configuration, selection: { ...configuration.selection, metalId: "plata-900" } }, {}, catalog)).toThrow(/catálogo vigente/);
  });

  it("requires a complete SKU", () => {
    expect(() => calculateDesignPriceMinor({ ...configuration, skuId: null }, {}, catalog)).toThrow(/SKU completo/);
  });

  it.each([
    ["imperial", "virola-imperial", 450_000],
    ["torpedo", "virola-torpedo", 390_000],
    ["camionero", "virola-camionero", 350_000],
  ] as const)("calcula Estribo %s y rechaza otro tamaño o virola", (textureId, metalId, expected) => {
    const estriboCatalog = { ...catalog, rules: {
      "family:estribo": 0,
      "tree:estribo:imperial": 4500,
      "tree:estribo:torpedo": 3900,
      "tree:estribo:camionero": 3500,
    } };
    const selected = {
      ...configuration,
      selection: { familyId: "estribo", textureId, colorId: "calabaza", metalId, sizeId: "medio" },
      rim: { textMode: "none", imageMode: "none", icons: [] },
    };
    expect(calculateDesignPriceMinor(selected, {}, estriboCatalog).priceMinor).toBe(expected);
    expect(() => calculateDesignPriceMinor({ ...selected, selection: { ...selected.selection, sizeId: "grande" } }, {}, estriboCatalog)).toThrow(/catálogo vigente/);
    expect(() => calculateDesignPriceMinor({ ...selected, selection: { ...selected.selection, metalId: "plata-900" } }, {}, estriboCatalog)).toThrow(/catálogo vigente/);
  });

  it.each(["marron-blanco-premium", "negro-blanco-premium", "animal-print-premium"])(
    "incluye Print / pelos para el imperial %s igual que el resumen",
    (colorId) => {
      const imperialCatalog = {
        ...catalog,
        rules: {
          "family:imperial": 2600,
          "tree:imperial:cincelado-premium": 3000,
          "leather:print-pelos": 600,
          "customization:bronze-applique:rim_text": 150,
          "customization:bronze-applique:rim_image": 400,
          "customization:alpaca-applique:fleje_text": 150,
          "customization:alpaca-applique:fleje_image": 500,
        },
      };
      const imperial = {
        skuId: "imperial-test",
        selection: { familyId: "imperial", textureId: "cincelado-premium", colorId, metalId: "original-imperial", sizeId: "medio", engravingTypeId: "bronze-applique" },
        engravingTypeId: "bronze-applique",
        flejeEngravingTypeId: "alpaca-applique",
        capabilities: { hasFleje: true },
        rim: { textMode: "text", texts: [{ text: "MATE" }], imageMode: "image", icons: [{ selectedImageId: "escudo" }] },
      };
      const fleje = { sides: {
        front: { textMode: "text", text: "URUGUAY", imageMode: "image", icons: [{ selectedImageId: "sol" }] },
        back: { textMode: "none", text: "", imageMode: "image", icons: [{ selectedImageId: "luna" }] },
      } };

      expect(calculateDesignPriceMinor(imperial, fleje, imperialCatalog).priceMinor).toBe(925_000);
    },
  );

  it.each([
    ["camionero blanco", "camionero", "alpaca-cincelado-patas", "blanco", "alpaca-comun", 180_000],
    ["imperial blanco", "imperial", "imperial-clasico", "blanco", "original-imperial", 260_000],
    ["imperial plata blanco", "imperial", "virola-plata-900", "blanco", "plata-900", 2_010_000],
    ["torpedo liso blanco", "torpedo", "cuero-liso", "blanco", "alpaca-comun", 180_000],
    ["torpedo estampado natural", "torpedo", "cuero-estampado", "natural", "alpaca-comun", 200_000],
    ["torpedo estampado negro", "torpedo", "cuero-estampado", "negro", "alpaca-comun", 200_000],
    ["criollo negro", "criollo", "camionero-criollo-posa-mate", "negro", "original-camionero", 350_000],
  ] as const)("acepta %s del catálogo visual", (_label, familyId, textureId, colorId, metalId, expected) => {
    const selectionCatalog = { ...catalog, rules: {
      "family:camionero": 1800, "family:imperial": 2600, "family:torpedo": 1800, "family:criollo": 0,
      "tree:criollo:camionero-criollo-posa-mate": 3100,
      "leather:stamped": 200, "leather:vaqueta": 400, "metal:plata-900": 17500,
    } };
    const selected = { ...configuration, selection: { ...configuration.selection, familyId, textureId, colorId, metalId }, rim: { textMode: "none", imageMode: "none", icons: [] } };
    expect(calculateDesignPriceMinor(selected, {}, selectionCatalog).priceMinor).toBe(expected);
  });
});
