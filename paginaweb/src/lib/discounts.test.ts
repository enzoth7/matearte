import { describe, expect, it } from "vitest";
import { discountErrorMessage, discountReasonFromError, normalizeDiscountCode } from "./discounts";

describe("discount helpers", () => {
  it("normalizes customer codes without accepting more than the database limit", () => {
    expect(normalizeDiscountCode("  mate-10  ")).toBe("MATE-10");
    expect(normalizeDiscountCode("a".repeat(40))).toHaveLength(32);
  });

  it("extracts stable database reasons and provides a safe fallback", () => {
    expect(discountReasonFromError({ message: "discount:already_used" })).toBe("already_used");
    expect(discountReasonFromError(new Error("unexpected"))).toBe("invalid");
    expect(discountErrorMessage("expired")).toMatch(/venció/i);
  });
});
