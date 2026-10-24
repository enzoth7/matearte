import { describe, expect, it } from "vitest";
import { isAllowedCommerceAdminOrigin } from "./config";

describe("orígenes de operaciones comerciales", () => {
  it("admite Gestión y rechaza los paneles retirados", () => {
    expect(isAllowedCommerceAdminOrigin("https://matearte-gestion.vercel.app")).toBe(true);
    expect(isAllowedCommerceAdminOrigin("https://matearte-commerce-admin.vercel.app")).toBe(false);
    expect(isAllowedCommerceAdminOrigin("https://matearte-commerce-admin-test.vercel.app")).toBe(false);
  });
});
