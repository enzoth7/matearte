import { describe, expect, it } from "vitest";
import { calculateDesignPriceMinor } from "./design-pricing";

const catalog = {
  versionId: "11111111-1111-4111-8111-111111111111", version: 7,
  rules: {
    "family:torpedo": 1800,
    "metal:alpaca-bronce": 300,
    "customization:laser:rim_text": 150,
    "customization:laser:rim_image": 400,
  },
};

const configuration = {
  skuId: "torpedo-test",
  selection: { familyId: "torpedo", textureId: "cuero-liso", colorId: "natural", metalId: "alpaca-bronce", sizeId: "medio", engravingTypeId: "laser" },
  engravingTypeId: "laser",
  capabilities: { hasFleje: false },
  rim: { textMode: "text", texts: [{ text: "A-1" }], imageMode: "none", icons: [] },
};

describe("server design pricing", () => {
  it("recalculates from published rules and ignores a browser price snapshot", () => {
    const result = calculateDesignPriceMinor({ ...configuration, pricingSnapshot: { totalUYU: 1 } }, {}, catalog);
    expect(result.priceMinor).toBe(240_000);
    expect(result.pricingVersion).toBe(7);
  });

  it("rejects a catalog combination invented by the browser", () => {
    expect(() => calculateDesignPriceMinor({ ...configuration, selection: { ...configuration.selection, metalId: "plata-900" } }, {}, catalog)).toThrow(/catálogo vigente/);
  });

  it("requires a complete SKU", () => {
    expect(() => calculateDesignPriceMinor({ ...configuration, skuId: null }, {}, catalog)).toThrow(/SKU completo/);
  });
});
