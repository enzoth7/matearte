import { describe, expect, it } from "vitest";
import { commerceItemKind, whatsappOrderItemLine } from "./order-item-labels";

describe("commercial item labels", () => {
  it("identifies a saved design as a personalized mate", () => {
    expect(commerceItemKind("design")).toBe("Diseño personalizado");
  });

  it("makes personalized mates explicit in WhatsApp messages", () => {
    expect(whatsappOrderItemLine({ item_type: "design", title: "Mate Imperial", quantity: 1 }))
      .toBe("- 1 x Diseño personalizado: Mate Imperial");
    expect(whatsappOrderItemLine({ item_type: "catalog", title: "Bombilla — Única", quantity: 2 }))
      .toBe("- 2 x Bombilla — Única");
  });
});
