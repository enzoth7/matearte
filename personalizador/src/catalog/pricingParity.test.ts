import { expect, it } from "vitest";
import { calculateDesignPriceMinor } from "../../../paginaweb/src/lib/design-pricing";
import { calculateOrderPricing, getActivePricingRuleKeys, getColorStartingPrice, getMetalStartingPrice, getSelectionPricing, hasPurchasableSku, listCatalogSelections } from "./pricingCatalog";
import { getEngravingCapabilities, getFirstIncompleteStage, resolveMateSelection } from "./mateDecisionCatalog";
import type { FlejeCustomization, MateConfiguration } from "../types/personalizer";

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

it("accepts every purchasable selection and offered customization in cart pricing", () => {
  // Distinct values make missing or duplicated rule keys visible in the comparison.
  const catalog = {
    versionId: "test",
    version: 1,
    publishedAt: "",
    rules: Object.fromEntries(getActivePricingRuleKeys().map((key, index) => [key, index + 1])),
  };
  const failures: string[] = [];
  let checked = 0;

  for (const baseSelection of listCatalogSelections()) {
    const baseProduct = resolveMateSelection(baseSelection);
    if (!baseProduct?.skuId || baseProduct.status !== "ready") continue;
    const available = getEngravingCapabilities(baseProduct.familyId, baseProduct.textureId);
    const flejeTechniques = baseProduct.capabilities.hasFleje ? available.flejeEngravingTypes : [null];

    for (const engravingTypeId of available.virolaEngravingTypes) {
      for (const flejeEngravingTypeId of flejeTechniques) {
        const selection = { ...baseSelection, engravingTypeId, flejeEngravingTypeId };
        const product = resolveMateSelection(selection);
        const label = [selection.familyId, selection.textureId, selection.colorId, selection.metalId, selection.sizeId, engravingTypeId, flejeEngravingTypeId].join("/");
        if (!product?.skuId || getFirstIncompleteStage(selection) !== null) {
          failures.push(`${label}: offered selection is incomplete`);
          continue;
        }

        // Covers no personalization, each item alone, combinations, both fleje sides,
        // catalog icons, uploaded icons, and finishes on/off.
        for (let scenario = 0; scenario < 32; scenario += 1) {
          const rimText = Boolean(scenario & 1);
          const rimImage = Boolean(scenario & 2);
          const flejeText = Boolean(scenario & 4);
          const flejeImage = Boolean(scenario & 8);
          const finish = Boolean(scenario & 16);
          const configuration = {
            schemaVersion: 2,
            productId: product.productId,
            skuId: product.skuId,
            variantId: product.legacyVariantId,
            size: product.sizeId,
            selection,
            engravingTypeId,
            flejeEngravingTypeId,
            capabilities: product.capabilities,
            rim: {
              textMode: rimText ? "text" : "none",
              text: "MATE 123",
              texts: [{ text: "MATE" }, { text: " 123" }],
              imageMode: rimImage ? "image" : "none",
              icons: [
                { selectedImageId: "uruguaysol", customImage: null },
                { selectedImageId: null, customImage: { id: "upload" } },
              ],
              finishMode: finish ? "finish" : "none",
              finishId: "finish-1",
            },
          } as unknown as MateConfiguration;
          const fleje = {
            finishMode: finish ? "finish" : "none",
            finishId: "pattern-1",
            sides: {
              front: {
                textMode: flejeText ? "text" : "none", text: "URUGUAY",
                imageMode: flejeImage ? "image" : "none",
                icons: [{ selectedImageId: "uruguaysol" }],
              },
              back: {
                textMode: flejeText ? "text" : "none", text: "MA 2",
                imageMode: flejeImage ? "image" : "none",
                icons: [{ customImage: { id: "upload" } }],
              },
            },
          } as unknown as FlejeCustomization;
          const expected = calculateOrderPricing(configuration, fleje, catalog);
          if (!expected.isCheckoutReady) {
            failures.push(`${label}/${scenario}: personalizer would block checkout: ${expected.missingRuleKeys.join(", ")}`);
            continue;
          }
          checked += 1;
          try {
            // JSON serialization matches the configuration stored for cart repricing.
            const actual = calculateDesignPriceMinor(JSON.parse(JSON.stringify(configuration)), JSON.parse(JSON.stringify(fleje)), catalog).priceMinor / 100;
            if (actual !== expected.totalUYU) failures.push(`${label}/${scenario}: ${expected.totalUYU} vs ${actual}`);
          } catch (error) {
            failures.push(`${label}/${scenario}: ${String(error)}`);
          }
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});

it("advertises a purchasable price for every selectable catalog combination", () => {
  const catalog = { versionId: "test", version: 1, publishedAt: "", rules: Object.fromEntries(getActivePricingRuleKeys().map((key) => [key, 100])) };
  for (const selection of listCatalogSelections()) {
    const filters = {
      familyId: selection.familyId ?? undefined,
      textureId: selection.textureId ?? undefined,
      colorId: selection.colorId ?? undefined,
      metalId: selection.metalId ?? undefined,
    };
    expect(resolveMateSelection(selection)?.skuId).toBeTruthy();
    expect(hasPurchasableSku(filters)).toBe(true);
    expect(getMetalStartingPrice(catalog, selection)).not.toBeNull();
    expect(getColorStartingPrice(catalog, { ...selection, colorId: selection.colorId! })).not.toBeNull();
  }
});
