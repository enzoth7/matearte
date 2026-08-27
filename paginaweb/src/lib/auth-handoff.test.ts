import { describe, expect, it } from "vitest";
import { createOpaqueHandoffCode } from "./auth-handoff";

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
