import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLocalCartItem,
  localCartEntryKey,
  readLocalCart,
  removeLocalCartItem,
  updateLocalCartItemQuantity,
} from "./browser-cart";

describe("browser cart catalog options", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "dispatchEvent");
  });

  it("keeps the same variant in separate lines when the selected size changes", () => {
    addLocalCartItem("variant-1", 1, { color: "marron", tamano: "chico" });
    addLocalCartItem("variant-1", 1, { color: "marron", tamano: "grande" });
    addLocalCartItem("variant-1", 2, { tamano: "chico", color: "marron" });

    expect(readLocalCart()).toEqual([
      { variantId: "variant-1", quantity: 3, optionValues: { color: "marron", tamano: "chico" } },
      { variantId: "variant-1", quantity: 1, optionValues: { color: "marron", tamano: "grande" } },
    ]);
  });

  it("updates and removes only the matching option combination", () => {
    addLocalCartItem("variant-1", 1, { tamano: "chico" });
    addLocalCartItem("variant-1", 1, { tamano: "grande" });
    const chicoKey = localCartEntryKey({ variantId: "variant-1", optionValues: { tamano: "chico" } });
    const grandeKey = localCartEntryKey({ variantId: "variant-1", optionValues: { tamano: "grande" } });

    updateLocalCartItemQuantity(chicoKey, 4);
    removeLocalCartItem(grandeKey);

    expect(readLocalCart()).toEqual([
      { variantId: "variant-1", quantity: 4, optionValues: { tamano: "chico" } },
    ]);
  });
});
