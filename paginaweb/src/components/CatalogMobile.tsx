"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CatalogFilterControls } from "@/components/catalog/CatalogFilterControls";
import { useCatalogFilters } from "@/components/catalog/useCatalogFilters";
import { filterAndSortCatalog, formatCatalogPrice, type CatalogSort } from "@/lib/catalog-filters";
import type { Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";

const assetRoot = "/assets/matearte/catalog-mobile";

const productPresentation: Record<string, string> = {
  "mate-imperial": "product-00.png",
  "imperial-animal-print": "product-01.png",
  "criollo-posa-mate": "product-02.png",
  "bombilla-acero-desarmable": "product-03.png",
  "matera-colgar-cuero": "product-04.png",
  "termo-stanley-800": "product-05.png",
  "set-premium": "product-06.png",
  "camionero-acero": "product-07.png",
  "mate-torpedo": "product-08.png",
  "bombilla-alpaca-pico-loro": "product-09.png",
  "matera-cuadrada-cuero": "product-10.png",
  "matera-ovalada-cuero": "product-11.png",
  "termo-stanley-12": "product-12.png",
  "termo-termolar-1l": "product-13.png",
  "box-matero": "product-14.png",
};

export function CatalogMobile({ products, exchangeRates }: { products: Product[]; exchangeRates?: Record<string, number> }) {
  const locale = useLocale();
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const catalogFilters = useCatalogFilters();
  const { filters } = catalogFilters;

  const cards = useMemo(() => {
    const entries = products.flatMap((product) => {
      if (product.variants && product.variants.length > 1) {
        return product.variants.map((variant) => {
          const variantImage = product.images.find(img => img.variantId === variant.id) || product.images[0];
          return {
            product: {
              ...product,
              name: `${product.name} - ${variant.label}`,
              filterData: {
                ...product.filterData,
                priceUYU: variant.price?.amountMinor ? variant.price.amountMinor / 100 : product.filterData.priceUYU
              },
              images: [variantImage],
              variants: product.variants
            },
            presentation: productPresentation[product.id]
          };
        });
      }
      return [{ product, presentation: productPresentation[product.id] }];
    });
    return filterAndSortCatalog(entries, filters, locale);
  }, [filters, locale, products]);

  return (
    <>
      <section className="catalog-mobile-hero">
        <Image className="catalog-mobile-hero-image" src={`${assetRoot}/hero.png`} alt={t("heroAlt")} width={1672} height={941} sizes="995px" priority />
        <div className="catalog-mobile-hero-overlay" aria-hidden="true" />
        <div className="catalog-mobile-hero-content">
          <h1>{t("heroTitle")}</h1>
          <p>{t("heroBody")}</p>
        </div>
      </section>

      <section className="catalog-mobile-controls" aria-label={t("filtersLabel")}>
        <div className="catalog-mobile-controls-inner">
          <div className="catalog-mobile-controls-heading">
            <h2>{t("filters")}</h2>
            <label className="catalog-mobile-sort">
              <span>{t("sortBy")}</span>
              <span className="catalog-mobile-sort-control">
                <select
                  aria-label={t("sortLabel")}
                  value={filters.sort}
                  onChange={(event) => catalogFilters.setSort(event.target.value as CatalogSort)}
                >
                  <option value="editorial">{t("featured")}</option>
                  <option value="nombre">{t("name")}</option>
                  <option value="precio">{t("price")}</option>
                </select>
                <Image src={`${assetRoot}/chevron-down.svg`} alt="" width={10} height={10} aria-hidden="true" />
              </span>
            </label>
          </div>

          <CatalogFilterControls
            variant="mobile"
            idPrefix="catalog-mobile"
            products={products}
            filters={filters}
            onCategoryChange={catalogFilters.setCategory}
            onPriceToggle={catalogFilters.togglePrice}
            onMaterialToggle={catalogFilters.toggleMaterial}
            onProductTypeToggle={catalogFilters.toggleProductType}
            onColorToggle={catalogFilters.toggleColor}
            onClear={catalogFilters.clearFilters}
          />
        </div>
      </section>

      <section className="catalog-mobile-products" aria-label={t("productsLabel")}>
        {cards.length > 0 ? (
          <div className="catalog-mobile-product-grid">
            {cards.map(({ product, presentation }, index) => {
              const imageSrc = product.images[0].source === "supabase" || !presentation
                ? product.images[0].src
                : `${assetRoot}/${presentation}`;
              return (
                <article key={`${product.id}-${product.name}`} className="catalog-mobile-product-card">
                  <Link href={{ pathname: "/producto/[slug]", params: { slug: product.slug } }}>
                    <div className="catalog-mobile-product-image">
                      <Image src={imageSrc} alt={product.images[0].alt} fill sizes="(max-width: 390px) 42vw, 163px" priority={index < 2} />
                    </div>
                    <div className="catalog-mobile-product-copy">
                      <h2>{product.name}</h2>
                      <p>{formatCatalogPrice(product.filterData.priceUYU, common("consult"), locale, exchangeRates)}</p>
                      {product.variants && product.variants.length > 1 && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                          {product.variants.map((v) => {
                            const colorHex = v.label.toLowerCase().includes('negro') ? '#222222' 
                                           : v.label.toLowerCase().includes('marr') ? '#8B4513'
                                           : v.label.toLowerCase().includes('natural') ? '#D2B48C'
                                           : v.label.toLowerCase().includes('crudo') ? '#E6C280'
                                           : '#ccc';
                            return (
                              <span
                                key={v.id}
                                style={{
                                  display: 'block',
                                  height: '0.75rem',
                                  width: '0.75rem',
                                  borderRadius: '0',
                                  border: '1px solid #ccc',
                                  backgroundColor: colorHex
                                }}
                                title={v.label}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-mobile-empty">
            <p>{t("emptyMobile")}</p>
            <button type="button" onClick={() => {
              catalogFilters.clearFilters();
            }}>{t("viewAll")}</button>
          </div>
        )}
      </section>

      <section className="catalog-mobile-personalize">
        <div className="catalog-mobile-personalize-card">
          <div className="catalog-mobile-personalize-image">
            <Image src={`${assetRoot}/cta.png`} alt={t("customAlt")} fill sizes="310px" />
          </div>
          <h2>{t("customTitle")}</h2>
          <p>{t("customBody")}</p>
          <Link href="/personalizados">{t("customAction")}</Link>
        </div>
      </section>
    </>
  );
}
