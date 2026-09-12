"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { CatalogFilterControlsMobile } from "@/components/catalog/CatalogFilterControlsMobile";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { useCatalogFilters } from "@/components/catalog/useCatalogFilters";
import { filterAndSortCatalog, formatCatalogPrice, hasActiveCatalogFilters, type CatalogSort } from "@/lib/catalog-filters";
import type { CatalogColorId, Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";
import { ProductCardSwatches } from "@/components/catalog/ProductCardSwatches";
import { useProductCardVariant } from "@/components/catalog/useProductCardVariant";

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

type MobileCardProps = {
  product: Product;
  presentation?: string;
  index: number;
  activeFilterColors: CatalogColorId[];
  locale: string;
  exchangeRates?: Record<string, number>;
  consultLabel: string;
};

function CatalogMobileCard({
  product,
  presentation,
  index,
  activeFilterColors,
  locale,
  exchangeRates,
  consultLabel,
}: MobileCardProps) {
  const {
    highlightedVariantId,
    variantImage,
    displayedPrice,
    priceIsFrom,
    activeColor,
    swatchesToShow,
    setHoveredVariantId,
    handleSelectVariant,
  } = useProductCardVariant(product, activeFilterColors);

  const defaultImage = product.images?.[0];
  const isEditorialFallback = !variantImage && defaultImage?.source !== "supabase" && Boolean(presentation);
  const imageSrc = variantImage
    ? variantImage.src
    : isEditorialFallback
    ? `${assetRoot}/${presentation}`
    : (defaultImage?.src ?? "");
  const imageAlt = variantImage?.alt || defaultImage?.alt || product.name;

  return (
    <article className="catalog-mobile-product-card">
      <Link href={{ pathname: "/producto/[slug]", params: { slug: product.slug }, query: activeColor ? { color: activeColor } : {} }}>
        <div className="catalog-mobile-product-image">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 390px) 42vw, 163px"
              priority={index < 2}
            />
          ) : null}
        </div>
        <div className="catalog-mobile-product-copy">
          <h2>{product.name}</h2>
          <p>{priceIsFrom ? `${locale==='en'?'From':locale==='pt'?'A partir de':'Desde'} ` : ''}{formatCatalogPrice(displayedPrice, consultLabel, locale, exchangeRates)}</p>
          <ProductCardSwatches
            variants={swatchesToShow}
            highlightedVariantId={highlightedVariantId}
            onSelect={handleSelectVariant}
            onHover={setHoveredVariantId}
          />
        </div>
      </Link>
    </article>
  );
}

export function CatalogMobile({ products, exchangeRates }: { products: Product[]; exchangeRates?: Record<string, number> }) {
  const locale = useLocale();
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const catalogFilters = useCatalogFilters();
  const { filters } = catalogFilters;

  const PAGE_SIZE = 21;
  const [page, setPage] = useState(1);

  const cards = useMemo(() => {
    const entries = products.map((product) => ({
      product,
      presentation: productPresentation[product.id],
    }));
    return filterAndSortCatalog(entries, filters, locale);
  }, [filters, locale, products]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const pagedCards = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = hasActiveCatalogFilters(filters);

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
            <div className="catalog-mobile-heading-left">
              <h2>{t("filters")}</h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="catalog-clear-filters"
                  onClick={catalogFilters.clearFilters}
                >
                  {t("clear")}
                </button>
              )}
            </div>
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

          <CatalogFilterControlsMobile
            products={products}
            filters={filters}
            onCategoryChange={catalogFilters.setCategory}
            onPriceChange={catalogFilters.setPrice}
            onMaterialChange={catalogFilters.setMaterial}
            onProductTypeChange={catalogFilters.setProductType}
            onColorChange={catalogFilters.setColor}
            onShapeChange={catalogFilters.setShape}
          />
        </div>
      </section>

      <section className="catalog-mobile-products" aria-label={t("productsLabel")}>
        {cards.length > 0 ? (
          <>
            <div className="catalog-mobile-product-grid">
              {pagedCards.map(({ product, presentation }, index) => (
                <CatalogMobileCard
                  key={product.id}
                  product={product}
                  presentation={presentation}
                  index={index}
                  activeFilterColors={filters.colors}
                  locale={locale}
                  exchangeRates={exchangeRates}
                  consultLabel={common("consult")}
                />
              ))}
            </div>
            <CatalogPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              prevLabel={t.has("prevPage") ? t("prevPage") : (locale === "en" ? "Previous" : "Anterior")}
              nextLabel={t.has("nextPage") ? t("nextPage") : (locale === "en" ? "Next" : locale === "pt" ? "Próxima" : "Siguiente")}
            />
          </>
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
