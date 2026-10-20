import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultFlejeCustomization } from "../types/customizer";
import type { SavedDesignItem } from "../types/user";
import { SavedDesignDetails, getSavedDesignPrice } from "./SavedDesignDetails";

const design = {
  id: "design-1",
  design_code: "MA-001",
  title: "Mate Cincelado Premium",
  status: "saved",
  fleje_config: createDefaultFlejeCustomization(),
  configuration: {
    skuId: "imperial-test",
    selection: { familyId: "imperial", textureId: "cincelado-premium", colorId: "negro-blanco-premium", metalId: "original-imperial", sizeId: "medio" },
    selectionLabels: { family: "Imperial", texture: "Cincelado Premium", color: "Negro y blanco", metal: "Alpaca", size: "Medio", engraving: "Aplique de bronce" },
    engravingTypeId: "bronze-applique",
    flejeEngravingTypeId: "alpaca-applique",
    capabilities: { hasFleje: true },
    rim: { textMode: "text", text: "MATE", texts: [{ text: "MATE" }], imageMode: "none", icons: [], finishMode: "none", finishId: "finish-1" },
    pricingSnapshot: {
      totalUYU: 9250,
      components: [
        { ruleKey: "family:imperial", label: "Imperial", valueUYU: 2600, kind: "family" },
        { ruleKey: "tree:imperial:cincelado-premium", label: "Cincelado Premium", valueUYU: 3000, kind: "tree" },
        { ruleKey: "leather:print-pelos", label: "Print / pelos", valueUYU: 600, kind: "leather" },
      ],
      items: [{ id: "rim_text", label: "Letras de texto en virola", quantity: 4, unitPriceUYU: 150, totalUYU: 600 }],
    },
  },
} as unknown as SavedDesignItem;

describe("detalle de diseños enviados al carrito", () => {
  it("muestra el total guardado, las opciones y los cargos de personalización", () => {
    const html = renderToStaticMarkup(<SavedDesignDetails design={design} catalog={null} onClose={() => {}} onUseAsBase={() => {}} />);
    expect(getSavedDesignPrice(design, null)).toBe(9250);
    expect(html).toContain("$ 9.250 UYU");
    expect(html).toContain("Print / pelos");
    expect(html).toContain("Negro y blanco");
    expect(html).toContain("MATE");
    expect(html).toContain("4 ×");
  });
});
