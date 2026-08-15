import { describe, expect, it } from "vitest";
import { commerceConfig, isCommerceAvailable } from "./commerce";

describe("configuración de comercio", () => {
  it("permanece deshabilitada por defecto", () => {
    expect(commerceConfig.provider).toBe("unavailable");
    expect(isCommerceAvailable()).toBe(false);
  });
});
