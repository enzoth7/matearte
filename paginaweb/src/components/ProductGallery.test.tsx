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

  it("sirve directamente las imágenes de Supabase para evitar timeouts del optimizador", () => {
    const source = "https://agdkljuulwjwjasftcce.supabase.co/storage/v1/object/public/product-images/producto/frente.png";
    render(<ProductGallery images={[
      { src: source, alt: "Foto subida", width: 1024, height: 1536, source: "supabase", sourceUrl: source, rightsStatus: "brand-public" },
    ]} />);

    expect(screen.getByRole("img", { name: "Foto subida" })).toHaveAttribute("src", source);
  });
});
