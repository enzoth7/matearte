import { describe, expect, it } from "vitest";
import { createOpaqueHandoffCode } from "./auth-handoff";
import { safeStoreRedirect, storeOAuthCallbackUrl } from "./auth-redirect";

describe("createOpaqueHandoffCode", () => {
  it("creates a consumable opaque code and stores only its hash", () => {
    const first = createOpaqueHandoffCode();
    const second = createOpaqueHandoffCode();

    expect(first.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.code).not.toBe(second.code);
    expect(first.tokenHash).not.toContain(first.code);
  });
});

describe("store OAuth redirect", () => {
  it("keeps checkout in redirectTo without replacing OAuth state", () => {
    const callback = new URL(storeOAuthCallbackUrl("https://matearte.example", "/checkout"));
    expect(callback.pathname).toBe("/auth/handoff");
    expect(callback.searchParams.get("flow")).toBe("store");
    expect(callback.searchParams.get("next")).toBe("/checkout");
    expect(callback.searchParams.has("state")).toBe(false);
  });

  it("rejects external and unknown post-login destinations", () => {
    expect(safeStoreRedirect("https://example.com")).toBeNull();
    expect(safeStoreRedirect("//example.com")).toBeNull();
    expect(safeStoreRedirect("/admin")).toBeNull();
    expect(safeStoreRedirect(encodeURIComponent("/carrito"))).toBe("/carrito");
  });
});
