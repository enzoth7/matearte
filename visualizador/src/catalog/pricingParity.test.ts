import { expect, it } from "vitest";
import { calculateDesignPriceMinor } from "../../../paginaweb/src/lib/design-pricing";
import { calculateOrderPricing, getActivePricingRuleKeys, getSelectionPricing, listCatalogSelections } from "./pricingCatalog";
import { resolveMateSelection } from "./mateDecisionCatalog";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";

it("matches all selectable combinations with cart pricing", () => {
  const catalog = { versionId: "test", version: 1, publishedAt: "", rules: Object.fromEntries(getActivePricingRuleKeys().map((key) => [key, 1])) };
  const mismatches: string[] = [];
  for (const selection of listCatalogSelections()) {
    const label = [selection.familyId, selection.textureId, selection.colorId, selection.metalId, selection.sizeId].join("/");
    try {
      const expected = getSelectionPricing(catalog, selection)?.totalUYU;
      const actual = calculateDesignPriceMinor({ skuId: "test", selection, engravingTypeId: "laser", rim: { textMode: "none", imageMode: "none", icons: [] }, capabilities: { hasFleje: false } }, {}, catalog).priceMinor / 100;
      if (actual !== expected) mismatches.push(`${label}: ${expected} vs ${actual}`);
    } catch (error) { mismatches.push(`${label}: ${String(error)}`); }
  }
  expect(mismatches).toEqual([]);
});

it("matches text, icons and finishes for every mate family", () => {
  const catalog = { versionId: "test", version: 1, publishedAt: "", rules: Object.fromEntries(getActivePricingRuleKeys().map((key) => [key, 10])) };
  const failures: string[] = [];
  const representatives = ["camionero", "imperial", "torpedo", "criollo"].map((family) =>
    listCatalogSelections({ familyId: family as "camionero" | "imperial" | "torpedo" | "criollo" }).find((selection) => Boolean(resolveMateSelection(selection)?.skuId)),
  );

  for (const selection of representatives) {
    if (!selection) continue;
    const hasFleje = Boolean(resolveMateSelection(selection)?.capabilities.hasFleje);
    for (const rimText of [false, true]) for (const rimImage of [false, true]) for (const flejeDesign of [false, true]) {
      const configuration = {
        skuId: "test", selection, variantId: "test", size: selection.sizeId,
        engravingTypeId: hasFleje ? "bronze-applique" : "laser",
        flejeEngravingTypeId: hasFleje ? "alpaca-applique" : null,
        capabilities: { hasFleje },
        rim: {
          textMode: rimText ? "text" : "none", text: "MATE", texts: [{ text: "MATE" }],
          imageMode: rimImage ? "image" : "none", icons: [{ selectedImageId: "sol" }, { selectedImageId: "escudo" }],
          finishMode: "finish", finishId: "finish-1",
        },
      } as unknown as MateConfiguration;
      const fleje = {
        finishMode: "finish", finishId: "pattern-1",
        sides: {
          front: { textMode: flejeDesign ? "text" : "none", text: "URUGUAY", imageMode: flejeDesign ? "image" : "none", icons: [{ selectedImageId: "sol" }] },
          back: { textMode: "none", text: "", imageMode: flejeDesign ? "image" : "none", icons: [{ selectedImageId: "escudo" }] },
        },
      } as unknown as FlejeCustomization;
      const expected = calculateOrderPricing(configuration, fleje, catalog).totalUYU;
      try {
        const actual = calculateDesignPriceMinor(configuration, fleje, catalog).priceMinor / 100;
        if (expected !== actual) failures.push(`${selection.familyId}/${rimText}/${rimImage}/${flejeDesign}: ${expected} vs ${actual}`);
      } catch (error) { failures.push(`${selection.familyId}: ${String(error)}`); }
    }
  }
  expect(failures).toEqual([]);
});
