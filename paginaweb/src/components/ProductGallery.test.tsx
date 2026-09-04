import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { ProductGallery } from "./ProductGallery";

describe("ProductGallery", () => {
  it("expone imágenes y controles accesibles", () => {
    render(<ProductGallery images={[
      { src: "/a.jpg", alt: "Vista frontal", width: 800, height: 1000, source: "web", sourceUrl: "https://example.com", rightsStatus: "brand-public" },
      { src: "/b.jpg", alt: "Vista lateral", width: 800, height: 1000, source: "web", sourceUrl: "https://example.com", rightsStatus: "brand-public" },
    ]} />);
    expect(screen.getByRole("region", { name: /galería de producto/i })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: /imagen anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /imagen siguiente/i })).toBeInTheDocument();
  });
});
