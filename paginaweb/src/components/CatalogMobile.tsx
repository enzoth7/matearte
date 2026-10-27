"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogFilterControlsMobile } from "@/components/catalog/CatalogFilterControlsMobile";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { useCatalogFilters } from "@/components/catalog/useCatalogFilters";
import { filterAndSortCatalog, formatCatalogPrice, hasActiveCatalogFilters, type CatalogFilters, type CatalogSort } from "@/lib/catalog-filters";
import type { CatalogColorId, Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";
import { ProductCardSwatches } from "@/components/catalog/ProductCardSwatches";
import { useProductCardVariant } from "@/components/catalog/useProductCardVariant";
import { catalogCoverStyle } from "@/lib/catalog-cover";

const assetRoot = "/assets/matearte/catalog-mobile";

const productPresentation: Record<string, string> = {
  "mate-imperial": "product-00.webp",
  "imperial-animal-print": "product-01.webp",
  "criollo-posa-mate": "product-02.webp",
  "bombilla-acero-desarmable": "product-03.webp",
  "matera-colgar-cuero": "product-04.webp",
  "termo-stanley-800": "product-05.webp",
  "set-premium": "product-06.webp",
  "camionero-acero": "product-07.webp",
  "mate-torpedo": "product-08.webp",
  "bombilla-alpaca-pico-loro": "product-09.webp",
  "matera-cuadrada-cuero": "product-10.webp",
  "matera-ovalada-cuero": "product-11.webp",
  "termo-stanley-12": "product-12.webp",
  "termo-termolar-1l": "product-13.webp",
  "box-matero": "product-14.webp",
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
  const coverStyle = catalogCoverStyle((variantImage ?? defaultImage)?.optionValues);
  const emphasizeProductImage = product.slug.includes("estribo-imperial")
    || product.name.toLocaleLowerCase().includes("estribo imperial");

  return (
    <article className="catalog-mobile-product-card" data-scroll-reveal style={{ transitionDelay: `${index % 2 * 0.06}s` }}>
      <Link href={{ pathname: "/producto/[slug]", params: { slug: product.slug }, query: activeColor ? { color: activeColor } : {} }}>
        <div className="catalog-mobile-product-image">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 390px) 42vw, 163px"
              className={emphasizeProductImage ? "catalog-mobile-product-image-estribo" : undefined}
              style={coverStyle}
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

export function CatalogMobile({ products, exchangeRates, pageCategory, heading, intro }: { products: Product[]; exchangeRates?: Record<string, number>; pageCategory?: CatalogFilters["category"]; heading?: string; intro?: string }) {
  const locale = useLocale();
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const catalogFilters = useCatalogFilters(pageCategory);
  const { filters } = catalogFilters;
  const [draftFilters, setDraftFilters] = useState<CatalogFilters>(filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

  const PAGE_SIZE = 21;
  const [page, setPage] = useState(1);

  const entries = useMemo(() => products.map((product) => ({
    product,
    presentation: productPresentation[product.id],
  })), [products]);
  const cards = useMemo(() => filterAndSortCatalog(entries, filters, locale), [entries, filters, locale]);
  const draftCount = useMemo(() => filterAndSortCatalog(entries, draftFilters, locale).length, [entries, draftFilters, locale]);

  useEffect(() => {
    if (!filterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [filterOpen]);

  const openFilters = () => {
    setDraftFilters({ ...filters, closures: [], productTypes: [] });
    if (!filterDialogRef.current?.open) {
      filterDialogRef.current?.showModal();
      setFilterOpen(true);
    }
  };
  const closeFilters = () => filterDialogRef.current?.close();
  const clearDraftFilters = () => setDraftFilters((current) => ({
    ...current, search: "", category: "todas", collections: [], prices: [], materials: [], closures: [], productTypes: [], colors: [],
  }));
  const applyDraftFilters = () => {
    closeFilters();
    catalogFilters.applyFilters(draftFilters);
  };

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
        <Image className="catalog-mobile-hero-image" src={`${assetRoot}/hero.webp`} alt={t("heroAlt")} width={1672} height={941} sizes="995px" priority />
        <div className="catalog-mobile-hero-overlay" aria-hidden="true" />
        <div className="catalog-mobile-hero-content">
          <h1>{heading ?? t("heroTitle")}</h1>
          <p>{intro ?? t("heroBody")}</p>
        </div>
      </section>

      <section className="catalog-mobile-controls" aria-label={t("filtersLabel")}>
        <div className="catalog-mobile-controls-inner">
          <button ref={filterTriggerRef} type="button" className="catalog-mobile-filter-trigger" aria-label={hasActiveFilters ? `${t("filters")} · ${t("filtersActive")}` : t("filters")} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={openFilters}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10m-7 5h4" /></svg>
            <span>{t("filters")}</span>
            {hasActiveFilters && <span className="catalog-mobile-filter-active" aria-hidden="true" />}
          </button>
        </div>
      </section>

      <dialog ref={filterDialogRef} className="catalog-mobile-filter-dialog" aria-labelledby="catalog-mobile-filter-title" onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeFilters();
      }} onClose={() => { setFilterOpen(false); filterTriggerRef.current?.focus(); }}>
        <div className="catalog-mobile-filter-dialog-header">
          <h2 id="catalog-mobile-filter-title">{t("filters")}</h2>
          <button type="button" className="catalog-mobile-filter-close" onClick={closeFilters} aria-label={common("close")}>×</button>
        </div>
        <div className="catalog-mobile-filter-dialog-body">
          <div className="catalog-mobile-filter-select-group">
            <label className="catalog-mobile-filter-select-label" htmlFor="mfs-sort">{t("sortBy")}</label>
            <div className="catalog-mobile-filter-select-wrap">
              <select id="mfs-sort" aria-label={t("sortLabel")} value={draftFilters.sort} onChange={(event) => setDraftFilters((current) => ({ ...current, sort: event.target.value as CatalogSort }))}>
                <option value="nuevo">{t("newest")}</option>
                <option value="precio-asc">{t("priceAsc")}</option>
                <option value="precio-desc">{t("priceDesc")}</option>
                <option value="nombre-asc">{t("nameAsc")}</option>
                <option value="nombre-desc">{t("nameDesc")}</option>
              </select>
            </div>
          </div>
          <CatalogFilterControlsMobile
            products={products}
            filters={draftFilters}
            onCategoryChange={(category) => setDraftFilters((current) => ({ ...current, category }))}
            onCollectionChange={(collection) => setDraftFilters((current) => ({ ...current, collections: collection ? [collection] : [] }))}
            onPriceChange={(price) => setDraftFilters((current) => ({ ...current, prices: price ? [price] : [] }))}
            onMaterialChange={(material) => setDraftFilters((current) => ({ ...current, materials: material ? [material] : [] }))}
            onColorChange={(color) => setDraftFilters((current) => ({ ...current, colors: color ? [color] : [] }))}
          />
        </div>
        <div className="catalog-mobile-filter-dialog-footer">
          <button type="button" className="catalog-mobile-filter-clear" onClick={clearDraftFilters} disabled={!hasActiveCatalogFilters(draftFilters)}>{t("clear")}</button>
          <button type="button" className="catalog-mobile-filter-apply" onClick={applyDraftFilters}>{t("viewProducts", { count: draftCount })}</button>
        </div>
      </dialog>

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
              compact
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
            <Image src={`${assetRoot}/cta.webp`} alt={t("customAlt")} fill sizes="310px" />
          </div>
          <h2>{t("customTitle")}</h2>
          <p>{t("customBody")}</p>
          <Link href="/personalizados">{t("customAction")}</Link>
        </div>
      </section>
    </>
  );
}
