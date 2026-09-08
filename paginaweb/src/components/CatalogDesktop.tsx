"use client";

import Image from "next/image";
import { CaretDown } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CatalogFilterControls } from "@/components/catalog/CatalogFilterControls";
import { useCatalogFilters } from "@/components/catalog/useCatalogFilters";
import { filterAndSortCatalog, formatCatalogPrice, hasActiveCatalogFilters, type CatalogSort } from "@/lib/catalog-filters";
import type { CatalogColorId, Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";
import { ProductCardSwatches } from "@/components/catalog/ProductCardSwatches";
import { useProductCardVariant } from "@/components/catalog/useProductCardVariant";

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

type DesktopCardProps = {
  product: Product;
  presentation?: ProductPresentation;
  index: number;
  activeFilterColors: CatalogColorId[];
  locale: string;
  exchangeRates?: Record<string, number>;
  consultLabel: string;
};

function CatalogDesktopCard({
  product,
  presentation,
  index,
  activeFilterColors,
  locale,
  exchangeRates,
  consultLabel,
}: DesktopCardProps) {
  const {
    highlightedVariantId,
    variantImage,
    displayedPrice,
    swatchesToShow,
    setHoveredVariantId,
    handleSelectVariant,
  } = useProductCardVariant(product, activeFilterColors);

  const defaultImage = product.images?.[0];
  const isEditorialFallback = !variantImage && defaultImage?.source !== "supabase" && Boolean(presentation);
  const imageSrc = variantImage
    ? variantImage.src
    : isEditorialFallback
    ? `${assetRoot}/${presentation!.image}`
    : (defaultImage?.src ?? "");
  const imageAlt = variantImage?.alt || defaultImage?.alt || product.name;
  const showBackground = isEditorialFallback && Boolean(presentation?.background);

  return (
    <article className="catalog-product-card">
      <Link href={{ pathname: "/producto/[slug]", params: { slug: product.slug } }}>
        <div className="catalog-product-media">
          {showBackground ? (
            <Image
              src={`${assetRoot}/${presentation!.background}`}
              alt=""
              fill
              sizes="(max-width: 1200px) 28vw, 290px"
              className="catalog-product-background"
              aria-hidden="true"
            />
          ) : null}
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 1200px) 28vw, 290px"
              className={`catalog-product-image ${presentation?.imageClass ?? ""}`}
              priority={index < 3}
            />
          ) : null}
        </div>
        <div className="catalog-product-meta">
          <h2>{product.name}</h2>
          <p>{formatCatalogPrice(displayedPrice, consultLabel, locale, exchangeRates)}</p>
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

export function CatalogDesktop({ products, exchangeRates }: { products: Product[]; exchangeRates?: Record<string, number> }) {
  const locale = useLocale();
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const catalogFilters = useCatalogFilters();
  const { filters } = catalogFilters;

  const cards = useMemo(() => {
    const entries = products.map((product) => ({
      product,
      presentation: productPresentation[product.id],
    }));
    return filterAndSortCatalog(entries, filters, locale);
  }, [filters, locale, products]);

  const hasActiveFilters = hasActiveCatalogFilters(filters);

  return (
    <div className="catalog-desktop-layout">
      <aside className="catalog-filters" aria-label={t("filtersLabel")}>
        <div className="catalog-filters-inner">
          <div className="catalog-filters-header">
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
            {cards.map(({ product, presentation }, index) => (
              <CatalogDesktopCard
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
