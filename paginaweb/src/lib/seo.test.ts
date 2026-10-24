import { describe, expect, it } from "vitest";
import { getLocalizedProduct } from "@/content/catalog-localization";
import { products } from "@/data/catalog";
import { localizedPageMetadata } from "@/i18n/metadata";
import { truncateForMeta } from "@/lib/product-description";
import { buildEnterpriseStructuredData, buildProductStructuredData, buildSiteStructuredData, productSeoCopy } from "@/lib/seo";
import { buildManifestFile, buildRobotsFile, buildSitemapFile } from "@/lib/seo-files";

describe("SEO técnico", () => {
  it("publica URLs únicas, localizadas y con imágenes en el sitemap", () => {
    const entries = buildSitemapFile();
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
    expect(entries).toHaveLength((7 + products.length) * 3);
    expect(entries.every((entry) => Object.keys(entry.alternates?.languages ?? {}).sort().join(",") === "en,es-UY,pt-BR,x-default")).toBe(true);
    expect(entries.filter((entry) => entry.url.includes("/product") || entry.url.includes("/producto") || entry.url.includes("/produto")).every((entry) => (entry.images?.length ?? 0) > 0)).toBe(true);
    expect(entries.some((entry) => /carrito|checkout|perfil|orders|pedidos|purchases|compras/.test(entry.url))).toBe(false);

    const enterpriseEntries = entries.filter((entry) => /empresas|corporate-gifts/.test(entry.url));
    expect(enterpriseEntries).toHaveLength(3);
    expect(enterpriseEntries.map((entry) => entry.url)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/empresas$/),
      expect.stringMatching(/\/en\/corporate-gifts$/),
      expect.stringMatching(/\/pt\/empresas$/),
    ]));
    expect(enterpriseEntries.every((entry) => entry.images?.length === 3)).toBe(true);
  });

  it("permite rastrear HTML con noindex y reserva robots.txt para rutas técnicas", () => {
    const config = buildRobotsFile();
    expect(config.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] });
    expect(config.sitemap).toMatch(/\/sitemap\.xml$/);
    expect(JSON.stringify(config.rules)).not.toContain("empresas");
  });

  it("describe la tienda y el sitio sin inventar reseñas o políticas comerciales", () => {
    const schema = buildSiteStructuredData("es", "Descripción pública de MateArte");
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    expect(graph.some((node) => Array.isArray(node["@type"]) && node["@type"].includes("OnlineStore"))).toBe(true);
    expect(graph.some((node) => node["@type"] === "WebSite" && node.inLanguage === "es-UY")).toBe(true);
    expect(JSON.stringify(schema)).not.toContain("AggregateRating");
    expect(JSON.stringify(schema)).not.toContain("MerchantReturnPolicy");
  });

  it("añade marca y breadcrumbs al producto y no inventa ofertas sin precio", () => {
    const product = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "en");
    expect(product).toBeDefined();
    const schema = buildProductStructuredData("en", product!, "Catalog", "MateArte");
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const productNode = graph.find((node) => node["@type"] === "Product");
    expect(productNode?.brand).toEqual({ "@type": "Brand", name: "MateArte" });
    expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
    expect(JSON.stringify(schema)).not.toContain("AggregateRating");
    expect(productNode).not.toHaveProperty("offers");
  });

  it("publica el precio en UYU de cada variante: una oferta simple o un rango", () => {
    const base = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "es")!;
    const variant = (value: string, amountMinor: number) => ({
      id: value,
      label: value,
      value,
      price: { amountMinor, currency: "UYU" as const },
    });
    const offerOf = (variants: typeof base.variants) => {
      const schema = buildProductStructuredData("es", { ...base, variants }, "Catálogo", "MateArte");
      const graph = schema["@graph"] as Array<Record<string, unknown>>;
      return graph.find((node) => node["@type"] === "Product")?.offers as Record<string, unknown>;
    };

    expect(offerOf([variant("A", 450000)])).toMatchObject({
      "@type": "Offer",
      price: "4500.00",
      priceCurrency: "UYU",
      availability: "https://schema.org/InStock",
    });
    expect(offerOf([variant("A", 450000), variant("B", 550000)])).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "4500.00",
      highPrice: "5500.00",
      priceCurrency: "UYU",
      offerCount: 2,
    });
    expect(offerOf([{ ...variant("A", 0) }])).toBeUndefined();
  });

  it("informa lastmod solo donde existe una fecha real de modificación", () => {
    const [first, second] = products;
    const entries = buildSitemapFile([
      { ...first, lastModifiedAt: Date.parse("2026-10-20T12:00:00Z") },
      { ...second, lastModifiedAt: undefined },
    ]);
    const find = (slug: string) => entries.find((entry) => entry.url === `https://www.matearteuruguay.com/producto/${slug}`);

    expect(find(first.slug)?.lastModified).toEqual(new Date("2026-10-20T12:00:00Z"));
    expect(find(second.slug)).not.toHaveProperty("lastModified");
    expect(entries.find((entry) => entry.url === "https://www.matearteuruguay.com/catalogo")?.lastModified)
      .toEqual(new Date("2026-10-20T12:00:00Z"));
    expect(entries.find((entry) => entry.url === "https://www.matearteuruguay.com/nosotros")).not.toHaveProperty("lastModified");
  });

  it("describe regalos empresariales como un servicio indexable con imagen y breadcrumbs", () => {
    const schema = buildEnterpriseStructuredData(
      "es",
      "Regalos empresariales artesanales y personalizados",
      "Piezas artesanales para empresas.",
      "MateArte",
    );
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const page = graph.find((node) => node["@type"] === "WebPage");
    const service = graph.find((node) => node["@type"] === "Service");

    expect(page?.url).toMatch(/\/empresas$/);
    expect(page?.mainEntity).toEqual({ "@id": expect.stringMatching(/#corporate-gifts-service$/) });
    expect(service?.provider).toEqual({ "@id": expect.stringMatching(/#organization$/) });
    expect(service?.image).toHaveLength(3);
    expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
  });

  it("genera metadatos sociales propios y copy SEO por idioma", () => {
    const product = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "pt");
    expect(product).toBeDefined();
    const copy = productSeoCopy(product!, "pt");
    expect(copy.title).toContain("cuia uruguaia artesanal");
    expect(copy.description).toBe(truncateForMeta(product!.description));
    expect(copy.description.length).toBeLessThanOrEqual(155);

    const long = productSeoCopy({ ...product!, description: `${product!.name}. ${"Texto informativo ".repeat(30)}` }, "pt");
    expect(long.description.length).toBeLessThanOrEqual(155);

    const metadata = localizedPageMetadata("en", "/catalogo", "Catalog title", "Catalog description");
    expect(metadata.alternates?.canonical).toBe("/en/catalog");
    expect(metadata.openGraph).toMatchObject({ title: "Catalog title", siteName: "MateArte Uruguay" });
    expect(metadata.twitter).toMatchObject({ title: "Catalog title", card: "summary_large_image" });
  });

  it("publica un manifiesto coherente con la identidad de la marca", () => {
    const data = buildManifestFile();
    expect(data.name).toContain("MateArte Uruguay");
    expect(data.start_url).toBe("/");
    expect(data.icons?.[0]).toMatchObject({ src: "/icon.jpg", sizes: "1080x1080" });
  });
});
