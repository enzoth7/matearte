import { describe, expect, it } from "vitest";
import { getLocalizedProduct } from "@/content/catalog-localization";
import { products } from "@/data/catalog";
import { localizedPageMetadata } from "@/i18n/metadata";
import { categorySeo } from "@/content/category-seo";
import { categoryPageSlugs, productInCategory } from "@/lib/catalog-filters";
import { truncateForMeta } from "@/lib/product-description";
import { buildCategoryStructuredData, buildEnterpriseStructuredData, buildProductStructuredData, buildSiteStructuredData, productSeoCopy } from "@/lib/seo";
import { buildManifestFile, buildRobotsFile, buildSitemapFile } from "@/lib/seo-files";

describe("SEO técnico", () => {
  it("publica URLs únicas, localizadas y con imágenes en el sitemap", () => {
    const todas = buildSitemapFile();
    // Guías: índice y 4 guías en tres idiomas, cada traducción con su slug y sus hreflang.
    const esGuia = (entry: { url: string }) => /\/(guias|guides)(\/|$)/.test(new URL(entry.url).pathname);
    const guias = todas.filter(esGuia);
    expect(guias).toHaveLength(15);
    expect(guias.map((entry) => new URL(entry.url).pathname)).toEqual(expect.arrayContaining([
      "/guias", "/en/guides", "/pt/guias",
      "/guias/como-curar-un-mate", "/en/guides/how-to-cure-a-mate-gourd", "/pt/guias/como-curar-uma-cuia",
    ]));
    const curar = guias.find((entry) => entry.url.endsWith("/en/guides/how-to-cure-a-mate-gourd"));
    expect(curar?.alternates?.languages).toMatchObject({ "es-UY": expect.stringMatching(/\/guias\/como-curar-un-mate$/), "pt-BR": expect.stringMatching(/\/pt\/guias\/como-curar-uma-cuia$/) });
    const entries = todas.filter((entry) => !esGuia(entry));
    const categoriesWithProducts = categoryPageSlugs.filter((categoria) => products.some((product) => productInCategory(product, categoria)));
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
    expect(entries).toHaveLength((12 + categoriesWithProducts.length + products.length) * 3);
    expect(entries.every((entry) => Object.keys(entry.alternates?.languages ?? {}).sort().join(",") === "en,es-UY,pt-BR,x-default")).toBe(true);
    expect(entries.filter((entry) => entry.url.includes("/product") || entry.url.includes("/producto") || entry.url.includes("/produto")).every((entry) => (entry.images?.length ?? 0) > 0)).toBe(true);
    expect(entries.some((entry) => /carrito|checkout|perfil|orders|pedidos/.test(entry.url))).toBe(false);
    expect(entries.filter((entry) => /compras|purchases/.test(entry.url))).toHaveLength(12);
    expect(entries.map((entry) => entry.url)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/preguntas-frecuentes$/),
      expect.stringMatching(/\/en\/faq$/),
      expect.stringMatching(/\/pt\/perguntas-frequentes$/),
    ]));

    const enterpriseEntries = entries.filter((entry) => /empresas|corporate-gifts/.test(entry.url));
    expect(enterpriseEntries).toHaveLength(3);
    expect(enterpriseEntries.map((entry) => entry.url)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/empresas$/),
      expect.stringMatching(/\/en\/corporate-gifts$/),
      expect.stringMatching(/\/pt\/empresas$/),
    ]));
    expect(enterpriseEntries.every((entry) => entry.images?.length === 3)).toBe(true);
  });

  it("publica una página por categoría con productos, localizada y con su breadcrumb", () => {
    const [mate] = products.filter((product) => product.category === "mates");
    const entries = buildSitemapFile([{ ...mate, lastModifiedAt: Date.parse("2026-10-20T12:00:00Z") }]);
    const categoryUrls = entries.map((entry) => entry.url).filter((url) => /\/catalog(o)?\/[a-z-]+$/.test(url));
    expect(categoryUrls).toEqual([
      "https://www.matearteuruguay.com/catalogo/mates",
      "https://www.matearteuruguay.com/en/catalog/mates",
      "https://www.matearteuruguay.com/pt/catalogo/mates",
    ]);
    expect(entries.find((entry) => entry.url.endsWith("/catalogo/mates"))?.lastModified).toEqual(new Date("2026-10-20T12:00:00Z"));

    const schema = buildCategoryStructuredData("en", "mates", [mate], "Mate gourds", "Intro", "Catalog", "MateArte");
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    expect(graph[0]).toMatchObject({ "@type": "CollectionPage", url: "https://www.matearteuruguay.com/en/catalog/mates" });
    const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList") as { itemListElement: Array<{ item: string }> };
    expect(breadcrumb.itemListElement.map((item) => item.item)).toEqual([
      "https://www.matearteuruguay.com/en",
      "https://www.matearteuruguay.com/en/catalog",
      "https://www.matearteuruguay.com/en/catalog/mates",
    ]);
  });

  it("todas las categorías con página tienen texto en los tres idiomas", () => {
    for (const categoria of categoryPageSlugs) {
      for (const locale of ["es", "en", "pt"] as const) {
        const copy = categorySeo[categoria][locale];
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.title.length).toBeLessThanOrEqual(42);
        expect(copy.intro.length).toBeLessThanOrEqual(155);      }
    }
  });

  it("permite rastrear HTML con noindex y reserva robots.txt para rutas técnicas", () => {
    const config = buildRobotsFile();
    expect(config.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] });
    expect(config.sitemap).toMatch(/\/sitemap\.xml$/);
    expect(config).not.toHaveProperty("host");
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
      name: `${base.name} - A`,
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

  it("publica material como un valor y conserva el nombre del producto en cada oferta", () => {
    const base = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "es")!;
    const product = {
      ...base,
      materials: ["Cuero", "Alpaca", "Cuero"],
      variants: [{ id: "negro", label: "Negro", value: "134", price: { amountMinor: 375000, currency: "UYU" as const } }],
    };
    const schema = buildProductStructuredData("es", product, "Catálogo", "MateArte");
    const node = schema["@graph"].find((entry) => entry["@type"] === "Product") as Record<string, unknown>;
    // Usa todos los materiales marcados en Gestión (sin repetir), hasta tres.
    expect(node.material).toBe("Cuero / Otros metales / Alpaca");
    expect(node.offers).toMatchObject({ name: `${product.name} - Negro` });
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

  it("no repite la marca en el título y completa las descripciones muy cortas", () => {
    const product = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "es");
    expect(product).toBeDefined();
    const sinCategoria = productSeoCopy({ ...product!, category: "otra" as never, description: "Bandolera de cuero." }, "es");
    expect(sinCategoria.title).not.toContain("MateArte");
    expect(sinCategoria.description).toContain("Bandolera de cuero. Hecho a mano en Paysandú");
    expect(sinCategoria.description.length).toBeLessThanOrEqual(155);
    const vacia = productSeoCopy({ ...product!, description: "" }, "en");
    expect(vacia.description).toContain("Handmade in Paysandú");
  });

  it("suma el color al título de los productos de una sola variante y la política de devolución", () => {
    const product = getLocalizedProduct("mate-imperial-pie-de-alpaca-fleje-pampa", "es");
    const unColor = { ...product!, category: "botas" as const, name: "Bota Modelo Sophie", variants: [{ id: "negro", label: "Negro", value: "143", price: { amountMinor: 730000, currency: "UYU" as const } }] };
    expect(productSeoCopy(unColor, "es").title).toContain("Bota Modelo Sophie Negro");
    const graph = buildProductStructuredData("es", unColor, "Catálogo", "MateArte")["@graph"] as Array<Record<string, any>>;
    const oferta = graph.find((n) => n["@type"] === "Product")?.offers;
    expect(oferta.hasMerchantReturnPolicy.merchantReturnDays).toBe(10);
    const personalizado = buildProductStructuredData("es", { ...unColor, category: "personalizados" as const }, "Catálogo", "MateArte")["@graph"] as Array<Record<string, any>>;
    expect(personalizado.find((n) => n["@type"] === "Product")?.offers.hasMerchantReturnPolicy.returnPolicyCategory).toContain("NotPermitted");
  });

  it("publica un manifiesto coherente con la identidad de la marca", () => {
    const data = buildManifestFile();
    expect(data.name).toContain("MateArte Uruguay");
    expect(data.start_url).toBe("/");
    expect(data.icons?.[0]).toMatchObject({ src: "/icon.jpg", sizes: "1080x1080" });
  });
});
