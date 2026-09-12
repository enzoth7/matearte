import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatCatalogPrice, getVariantColorHex } from "@/lib/catalog-filters";
import { getExchangeRates, getStorefrontProducts } from "@/lib/storefront-catalog";
import type { Locale, Product } from "@/types/catalog";

const FALLBACK_STRINGS: Record<string, Record<string, string>> = {
  es: {
    title: "Piezas Destacadas",
    viewMore: "Ver catálogo",
    viewAll: "Ver todo el catálogo",
  },
  en: {
    title: "Featured Pieces",
    viewMore: "View catalog",
    viewAll: "View full catalog",
  },
  pt: {
    title: "Peças em Destaque",
    viewMore: "Ver catálogo",
    viewAll: "Ver todo o catálogo",
  },
};

export async function HomeFeaturedProducts() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("home");
  const common = await getTranslations("common");

  const strings = FALLBACK_STRINGS[locale] ?? FALLBACK_STRINGS.es;
  const title = t.has("featuredTitle") ? t("featuredTitle") : strings.title;
  const viewMore = strings.viewMore;
  const viewAll = strings.viewAll;

  const [allProducts, exchangeRates] = await Promise.all([
    getStorefrontProducts(locale),
    getExchangeRates(),
  ]);

  const targetSlugs = [
    "bota-vaquera",
    "kit-matero-9a144bdf",
    "mate-criollo-imperial-cuero-fleje-griego",
    "cinto-de-cuero",
    "matera-estampada",
  ];

  const displayProducts: Product[] = [];
  for (const slug of targetSlugs) {
    const found = allProducts.find(
      (p) => p.slug === slug || p.id === slug || p.slug.toLowerCase() === slug.toLowerCase()
    );
    if (found && !displayProducts.some((p) => p.id === found.id)) {
      displayProducts.push(found);
    }
  }

  // Respaldo de seguridad si algún producto no estuviera publicado aún
  if (displayProducts.length < 5) {
    for (const p of allProducts) {
      if (!displayProducts.some((existing) => existing.id === p.id)) {
        displayProducts.push(p);
        if (displayProducts.length === 5) break;
      }
    }
  }

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <section className="home-section home-scroll-band home-featured-section" aria-labelledby="home-featured-title">
      <div className="home-shell">
        <div className="home-featured-header">
          <h2 id="home-featured-title" className="home-featured-title">{title}</h2>
          <Link className="home-featured-header-action" href="/catalogo">
            <span>{viewMore}</span>
          </Link>
        </div>

        <div className="home-featured-track" tabIndex={0} aria-label={title}>
          {displayProducts.map((product) => {
            const image = product.images?.[0];
            const priceLabel = formatCatalogPrice(
              product.filterData?.priceUYU,
              common("consult"),
              locale,
              exchangeRates
            );

            const colorVariants = (product.variants || []).filter(
              (v) => Boolean(v.color) || Boolean(getVariantColorHex(v))
            );

            return (
              <article key={product.id} className="home-featured-card">
                <Link
                  className="home-featured-card-link"
                  href={{ pathname: "/producto/[slug]", params: { slug: product.slug } }}
                >
                  <div className="home-featured-media">
                    {image ? (
                      <Image
                        src={image.src}
                        alt={image.alt || product.name}
                        fill
                        sizes="(max-width: 1023px) 210px, 240px"
                        className="home-featured-image"
                      />
                    ) : null}
                  </div>
                  <div className="home-featured-meta">
                    <h3 className="home-featured-card-title">{product.name}</h3>
                    <p className="home-featured-card-price">{priceLabel}</p>
                    {colorVariants.length > 1 ? (
                      <div className="home-featured-swatches" aria-hidden="true">
                        {colorVariants.map((v) => {
                          const hex = getVariantColorHex(v);
                          return (
                            <span
                              key={v.id}
                              className="home-featured-swatch"
                              style={{ backgroundColor: hex }}
                              title={v.label}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </article>
            );
          })}

          <article className="home-featured-card home-featured-card-more">
            <Link className="home-featured-card-link" href="/catalogo">
              <div className="home-featured-more-media">
                <span className="home-featured-more-icon" aria-hidden="true">
                  <ArrowRight size={24} weight="bold" />
                </span>
                <span className="home-featured-more-label">{viewAll}</span>
              </div>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
