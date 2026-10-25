import { describe, expect, it } from "vitest";
import type { Product } from "@/types/catalog";
import { buildGoogleMerchantFeed } from "./google-merchant-feed";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "producto-1",
    slug: "mate-imperial",
    name: "Mate Imperial & Alpaca",
    category: "mates",
    eyebrow: "Producto MateArte",
    summary: "Mate artesanal",
    description: "Mate artesanal <hecho> en Uruguay.",
    materials: ["Cuero", "Alpaca"],
    filterData: { materials: ["cuero", "alpaca"] },
    images: [
      {
        src: "/imagenes/productos/products/mate principal.webp",
        alt: "Mate Imperial",
        width: 1200,
        height: 1200,
        source: "supabase",
        sourceUrl: "https://example.supabase.co/mate.webp",
        rightsStatus: "brand-public",
      },
      {
        src: "https://images.example.com/mate-2.jpg",
        alt: "Mate Imperial de perfil",
        width: 1200,
        height: 1200,
        source: "supabase",
        sourceUrl: "https://images.example.com/mate-2.jpg",
        rightsStatus: "brand-public",
      },
    ],
    variants: [
      { id: "v2", label: "Negro", value: "MAT-NEGRO", price: { amountMinor: 550000, currency: "UYU" }, available: true },
      { id: "v1", label: "Natural", value: "MAT-NATURAL", price: { amountMinor: 450000, currency: "UYU" }, available: true },
    ],
    ...overrides,
  };
}

describe("feed de Google Merchant Center", () => {
  it("genera RSS 2.0 con los atributos obligatorios y URLs absolutas", () => {
    const feed = buildGoogleMerchantFeed([product()], "https://www.matearteuruguay.com/");

    expect(feed).toMatchObject({ itemCount: 1, excludedCount: 0 });
    expect(feed.xml).toContain('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">');
    expect(feed.xml).toContain("<g:title>Mate Imperial &amp; Alpaca</g:title>");
    expect(feed.xml).toContain("<g:description>Mate artesanal &lt;hecho&gt; en Uruguay.</g:description>");
    expect(feed.xml).toContain("<g:link>https://www.matearteuruguay.com/producto/mate-imperial</g:link>");
    expect(feed.xml).toContain("<g:image_link>https://www.matearteuruguay.com/imagenes/productos/products/mate%20principal.webp</g:image_link>");
    expect(feed.xml).toContain("<g:additional_image_link>https://images.example.com/mate-2.jpg</g:additional_image_link>");
    expect(feed.xml).toContain("<g:price>4500.00 UYU</g:price>");
    expect(feed.xml).toContain("<g:mpn>MAT-NATURAL</g:mpn>");
    expect(feed.xml).toContain("<g:brand>MateArte</g:brand>");
    expect(feed.xml).toContain("<g:availability>in_stock</g:availability>");
  });

  it("omite fichas sin foto real, descripción o variante web con precio", () => {
    const withoutRealImage = product({ id: "sin-foto", images: [{
      src: "/assets/matearte/01-marca/LogoOriginal-4k.png",
      alt: "MateArte",
      width: 4096,
      height: 4096,
      source: "provided",
      sourceUrl: "/assets/matearte/01-marca/LogoOriginal-4k.png",
      rightsStatus: "brand-public",
    }] });
    const withoutPrice = product({ id: "sin-precio", variants: [{ id: "v", label: "Única", value: "SIN", available: true }] });
    const unavailable = product({ id: "no-disponible", variants: [{ id: "v", label: "Única", value: "NO", price: { amountMinor: 10000, currency: "UYU" }, available: false }] });

    const feed = buildGoogleMerchantFeed([withoutRealImage, withoutPrice, unavailable], "https://www.matearteuruguay.com");
    expect(feed).toMatchObject({ itemCount: 0, excludedCount: 3 });
    expect(feed.xml).not.toContain("<item>");
  });

  it("mantiene el ID del producto aunque cambie la variante de menor precio", () => {
    const first = buildGoogleMerchantFeed([product()], "https://www.matearteuruguay.com");
    const changed = buildGoogleMerchantFeed([product({ variants: [
      { id: "v2", label: "Negro", value: "MAT-NEGRO", price: { amountMinor: 400000, currency: "UYU" }, available: true },
      { id: "v1", label: "Natural", value: "MAT-NATURAL", price: { amountMinor: 450000, currency: "UYU" }, available: true },
    ] })], "https://www.matearteuruguay.com");

    expect(first.xml).toContain("<g:id>producto-1</g:id>");
    expect(changed.xml).toContain("<g:id>producto-1</g:id>");
    expect(changed.xml).toContain("<g:price>4000.00 UYU</g:price>");
  });
});
