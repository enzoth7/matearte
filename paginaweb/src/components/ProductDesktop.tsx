"use client";
import { useStorefrontCurrency, useStorefrontProduct } from "./StorefrontCurrency";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { addLocalCartItem } from "@/lib/browser-cart";
import type { Product } from "@/types/catalog";
import { Link, useRouter } from "@/i18n/navigation";
import { ProductGallery } from "./ProductGallery";
import { StructuredVariantPicker } from "./product/StructuredVariantPicker";
import { useStructuredVariantSelection } from "./product/useStructuredVariantSelection";
import { ProductSpecsBox } from "./product/ProductSpecsBox";

const catalogAssetRoot = "/assets/matearte/catalog-desktop";
const productAssetRoot = "/assets/matearte/product-desktop";

const productImages: Record<string, string> = {
  "mate-imperial": `${catalogAssetRoot}/product-00.webp`,
  "imperial-animal-print": `${productAssetRoot}/imperial-animal-print.webp`,
  "criollo-posa-mate": `${catalogAssetRoot}/product-02.webp`,
  "bombilla-acero-desarmable": `${catalogAssetRoot}/product-03.webp`,
  "matera-colgar-cuero": `${catalogAssetRoot}/product-04.webp`,
  "termo-stanley-800": `${catalogAssetRoot}/product-05.webp`,
  "set-premium": `${catalogAssetRoot}/product-06.webp`,
  "camionero-acero": `${catalogAssetRoot}/product-07.webp`,
  "mate-torpedo": `${catalogAssetRoot}/product-08.webp`,
  "bombilla-alpaca-pico-loro": `${catalogAssetRoot}/product-09.webp`,
  "limpia-bombillas": `${catalogAssetRoot}/product-09.webp`,
  "matera-cuadrada-cuero": `${catalogAssetRoot}/product-10.webp`,
  "matera-ovalada-cuero": `${catalogAssetRoot}/product-11.webp`,
  "termo-stanley-12": `${catalogAssetRoot}/product-12.webp`,
  "termo-termolar-1l": `${catalogAssetRoot}/product-13.webp`,
  "box-matero": `${catalogAssetRoot}/background-14.webp`,
};

type CommerceVariant = {
  id: string;
  price_minor: number; base_price_minor?: number;
};

type CommerceData = {
  available: boolean;
  commerceEnabled: boolean;
  product: { variants: CommerceVariant[] } | null;
};

import { formatCatalogPrice } from "@/lib/catalog-filters";

export function ProductDesktop({ product, exchangeRates }: { product: Product; exchangeRates?: Record<string, number> }) {
  const { currency: displayCurrency, rates: displayRates, arsUseBasePrice } = useStorefrontCurrency(exchangeRates);
  const locale = useLocale();
  const t = useTranslations("product");
  const common = useTranslations("common");
  const router = useRouter();
  
  const formatPrice = (amount: number) => formatCatalogPrice(amount, undefined, locale, displayRates, displayCurrency);
  const [commerce, setCommerce] = useState<CommerceData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pricedProduct = useStorefrontProduct(product);
  const variantSelection = useStructuredVariantSelection(pricedProduct);

  useEffect(() => {
    let active = true;
    fetch(`/api/catalog/products?slug=${encodeURIComponent(product.slug)}`)
      .then((response) => response.json())
      .then((value: CommerceData) => {
        if (active) setCommerce(value);
      })
      .catch(() => {
        if (active) setCommerce({ available: false, commerceEnabled: false, product: null });
      });
    return () => { active = false; };
  }, [product.slug]);

  const catalogVariant = variantSelection.activeVariant;
  const activeVariantId = catalogVariant?.id;
  const commerceVariant = commerce?.available ? commerce.product?.variants.find(v => v.id === activeVariantId) : undefined;
  
  const displayedPrice = commerceVariant
    ? formatPrice((displayCurrency === "ARS" && arsUseBasePrice ? commerceVariant.base_price_minor ?? commerceVariant.price_minor : commerceVariant.price_minor) / 100)
    : catalogVariant?.price
    ? formatPrice(catalogVariant.price.amountMinor / 100)
    : variantSelection.displayedPrice === undefined ? common("consult") : formatPrice(variantSelection.displayedPrice);
    
  const galleryImages = variantSelection.images.map(img => ({
    ...img,
    src: img.source === "supabase" ? img.src : productImages[product.id] ?? img.src
  }));

  const addToCart = async () => {
    setMessage("");
    if (!variantSelection.complete) {
      setMessage(locale==='en'?'Select all options before adding this product.':locale==='pt'?'Selecione todas as opções antes de adicionar este produto.':'Seleccioná todas las opciones antes de agregar este producto.');
      return;
    }
    if (!commerceVariant && !catalogVariant) {
      setMessage(t("purchaseUnavailable"));
      return;
    }
    const targetVariantId = commerceVariant?.id || catalogVariant?.id;
    if (!targetVariantId) return;

    const selectedOptions = variantSelection.selected;

    setBusy(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "catalog", variantId: targetVariantId, quantity: 1, locale, optionValuesOverride: selectedOptions }),
      });
      if (response.status === 401) {
        addLocalCartItem(targetVariantId, 1, selectedOptions);
        setMessage(t("savedLocally"));
      } else {
        await response.json();
        if (response.ok) {
          setMessage(t("added"));
        } else {
          setMessage(t("addFailed"));
        }
      }
    } catch {
      setMessage(t("addRetry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="product-desktop-detail" aria-labelledby="product-desktop-title">
      <div className="product-desktop-grid">
        <div className="product-desktop-gallery">
          <ProductGallery images={galleryImages} />
        </div>

        <div className="product-desktop-information">
          <h1 id="product-desktop-title">{product.name}</h1>
          <p className="product-desktop-summary">{product.summary}</p>
          <p className="product-desktop-price">{displayedPrice}</p>

          <div className="product-desktop-rule product-desktop-rule-actions" aria-hidden="true" />

          <StructuredVariantPicker product={product} axes={variantSelection.axes} selected={variantSelection.selected} onSelect={variantSelection.select}/>
          {!variantSelection.complete && <p className="variant-selection-note">{locale==='en'?'Select all options to continue.':locale==='pt'?'Selecione todas as opções para continuar.':'Seleccioná todas las opciones para continuar.'}</p>}

          <button className="product-desktop-primary" type="button" disabled={busy || !variantSelection.complete} onClick={() => void addToCart()}>
            {busy ? t("adding") : t("addToCart")}
          </button>
          {product.category === "mates" && <Link className="product-desktop-secondary" href="/personalizados">{t("learnCustomization")}</Link>}
          <p className="product-desktop-status" role="status" aria-live="polite">{message}</p>
          <ProductSpecsBox product={product} selectedOptions={variantSelection.selected} activeVariant={variantSelection.activeVariant} />
        </div>
      </div>
    </section>
  );
}
