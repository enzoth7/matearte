import { describe, expect, it } from "vitest";
import { orderItemImagePath } from "./order-item-image";

describe("orderItemImagePath", () => {
  it("prefers the image linked to the purchased variant", () => {
    expect(orderItemImagePath({
      item_type: "catalog",
      source_variant_id: "black",
      variant: { product: { commerce_product_images: [
        { storage_path: "product/default.jpg", sort_order: 0, variant_id: null },
        { storage_path: "product/black.jpg", sort_order: 2, variant_id: "black" },
      ] } },
    })).toBe("product/black.jpg");
  });

  it("uses the product default when the variant has no image", () => {
    expect(orderItemImagePath({
      item_type: "catalog",
      source_variant_id: "brown",
      variant: { product: { commerce_product_images: [
        { storage_path: "product/black.jpg", sort_order: 0, variant_id: "black" },
        { storage_path: "product/default.jpg", sort_order: 1, variant_id: null },
      ] } },
    })).toBe("product/default.jpg");
  });

  it("does not use catalog images for a custom design", () => {
    expect(orderItemImagePath({ item_type: "design" })).toBeNull();
  });
});
