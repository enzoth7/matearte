"use client";

import Image from "next/image";
import { CaretDown } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CatalogFilterControls } from "@/components/catalog/CatalogFilterControls";
import { useCatalogFilters } from "@/components/catalog/useCatalogFilters";
import { filterAndSortCatalog, formatCatalogPrice, type CatalogSort } from "@/lib/catalog-filters";
import type { Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";

const assetRoot = "/assets/matearte/catalog-desktop";

type ProductPresentation = {
  image: string;
  background?: string;
  imageClass?: string;
};

const productPresentation: Record<string, ProductPresentation> = {
  "mate-imperial": { image: "product-00.png" },
  "imperial-animal-print": { image: "product-01.png", imageClass: "catalog-product-image-animal" },
  "criollo-posa-mate": { image: "product-02.png" },
  "bombilla-acero-desarmable": { image: "product-03.png" },
  "matera-colgar-cuero": { image: "product-04.png" },
  "termo-stanley-800": { image: "product-05.png" },
  "set-premium": { image: "product-06.png", background: "background-06.png" },
  "camionero-acero": { image: "product-07.png", background: "background-07.png", imageClass: "catalog-product-image-wide" },
  "mate-torpedo": { image: "product-08.png", background: "background-08.png", imageClass: "catalog-product-image-torpedo" },
  "bombilla-alpaca-pico-loro": { image: "product-09.png", background: "background-09.png" },
  "matera-cuadrada-cuero": { image: "product-10.png", background: "background-10.png", imageClass: "catalog-product-image-wide" },
  "matera-ovalada-cuero": { image: "product-11.png", background: "background-11.png", imageClass: "catalog-product-image-oval" },
  "termo-stanley-12": { image: "product-12.png", background: "background-12.png" },
  "termo-termolar-1l": { image: "product-13.png", background: "background-13.png" },
  "box-matero": { image: "product-09.png", background: "background-14.png" },
};

export function CatalogDesktop({ products, exchangeRates }: { products: Product[]; exchangeRates?: Record<string, number> }) {
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
    <div className="catalog-desktop-layout">
      <aside className="catalog-filters" aria-label={t("filtersLabel")}>
        <div className="catalog-filters-inner">
          <h2>{t("filters")}</h2>
          <CatalogFilterControls
            variant="desktop"
            idPrefix="catalog-desktop"
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
      </aside>

      <section className="catalog-results" aria-label={t("productsLabel")}>
        <label className="catalog-sort">
          <span>{t("sortBy")}</span>
          <span className="catalog-sort-control">
            <select aria-label={t("sortLabel")} value={filters.sort} onChange={(event) => catalogFilters.setSort(event.target.value as CatalogSort)}>
              <option value="editorial">{t("featured")}</option>
              <option value="nombre">{t("name")}</option>
              <option value="precio">{t("price")}</option>
            </select>
            <CaretDown size={10} weight="bold" aria-hidden="true" />
          </span>
        </label>

        {cards.length > 0 ? (
          <div className="catalog-product-grid">
            {cards.map(({ product, presentation }, index) => {
              const uploadedImage = product.images[0].source === "supabase" || !presentation;
              const imageSrc = uploadedImage ? product.images[0].src : `${assetRoot}/${presentation.image}`;
              return (
                <article key={`${product.id}-${product.name}`} className="catalog-product-card">
                  <Link href={{ pathname: "/producto/[slug]", params: { slug: product.slug } }}>
                    <div className="catalog-product-media">
                      {!uploadedImage && presentation.background ? <Image src={`${assetRoot}/${presentation.background}`} alt="" fill sizes="(max-width: 1200px) 28vw, 290px" className="catalog-product-background" aria-hidden="true" /> : null}
                      <Image src={imageSrc} alt={product.images[0].alt} fill sizes="(max-width: 1200px) 28vw, 290px" className={`catalog-product-image ${presentation?.imageClass ?? ""}`} priority={index < 3} />
                    </div>
                    <div className="catalog-product-meta">
                      <h2>{product.name}</h2>
                      <p>{formatCatalogPrice(product.filterData.priceUYU, common("consult"), locale, exchangeRates)}</p>
                      {product.variants && product.variants.length > 1 && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                          {product.variants.map((v) => {
                            const colorHex = v.label.toLowerCase().includes('negro') ? '#222222' 
                                           : v.label.toLowerCase().includes('marr') ? '#8B4513'
                                           : v.label.toLowerCase().includes('natural') ? '#D2B48C'
                                           : v.label.toLowerCase().includes('crudo') ? '#E6C280'
                                           : v.label.toLowerCase().includes('rojo') ? '#a83232'
                                           : v.label.toLowerCase().includes('blanco') ? '#f5f5f5'
                                           : v.label.toLowerCase().includes('rosado') ? '#e8a4a4'
                                           : v.label.toLowerCase().includes('gris') ? '#8c8c8c'
                                           : v.label.toLowerCase().includes('dorado') ? '#c9a859'
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
          <div className="catalog-empty">
            <p>{t("empty")}</p>
            <button type="button" onClick={() => {
              catalogFilters.clearFilters();
            }}>{t("clear")}</button>
          </div>
        )}
      </section>

      <aside className="catalog-personalize-cta">
        <div className="catalog-personalize-copy">
          <h2>{t("customTitle")}</h2>
          <p>{t("customBody")}</p>
          <Link href="/personalizados">{t("customAction")}</Link>
        </div>
        <div className="catalog-personalize-image">
          <Image src={`${assetRoot}/cta.png`} alt={t("customAlt")} fill sizes="356px" />
        </div>
      </aside>
    </div>
  );
}
