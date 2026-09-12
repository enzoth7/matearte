"use client";

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
const productAssetRoot = "/assets/matearte/product-mobile";

const productImages: Record<string, string> = {
  "mate-imperial": `${catalogAssetRoot}/product-00.png`,
  "imperial-animal-print": `${productAssetRoot}/imperial-animal-print.png`,
  "criollo-posa-mate": `${catalogAssetRoot}/product-02.png`,
  "bombilla-acero-desarmable": `${catalogAssetRoot}/product-03.png`,
  "matera-colgar-cuero": `${catalogAssetRoot}/product-04.png`,
  "termo-stanley-800": `${catalogAssetRoot}/product-05.png`,
  "set-premium": `${catalogAssetRoot}/product-06.png`,
  "camionero-acero": `${catalogAssetRoot}/product-07.png`,
  "mate-torpedo": `${catalogAssetRoot}/product-08.png`,
  "bombilla-alpaca-pico-loro": `${catalogAssetRoot}/product-09.png`,
  "limpia-bombillas": `${catalogAssetRoot}/product-09.png`,
  "matera-cuadrada-cuero": `${catalogAssetRoot}/product-10.png`,
  "matera-ovalada-cuero": `${catalogAssetRoot}/product-11.png`,
  "termo-stanley-12": `${catalogAssetRoot}/product-12.png`,
  "termo-termolar-1l": `${catalogAssetRoot}/product-13.png`,
  "box-matero": `${catalogAssetRoot}/background-14.png`,
};

type CommerceVariant = {
  id: string;
  price_minor: number;
};

type CommerceData = {
  available: boolean;
  commerceEnabled: boolean;
  product: { variants: CommerceVariant[] } | null;
};

import { formatCatalogPrice } from "@/lib/catalog-filters";

export function ProductMobile({ product, exchangeRates }: { product: Product; exchangeRates?: Record<string, number> }) {
  const locale = useLocale();
  const t = useTranslations("product");
  const common = useTranslations("common");
  const router = useRouter();
  
  const formatPrice = (amount: number) => formatCatalogPrice(amount, undefined, locale, exchangeRates);
  const [commerce, setCommerce] = useState<CommerceData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const variantSelection = useStructuredVariantSelection(product);

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
    ? formatPrice(commerceVariant.price_minor / 100)
    : catalogVariant?.price
    ? formatPrice(catalogVariant.price.amountMinor / 100)
    : variantSelection.displayedPrice === undefined ? common("consult") : `${variantSelection.priceIsFrom ? `${locale==='en'?'From':locale==='pt'?'A partir de':'Desde'} ` : ''}${formatPrice(variantSelection.displayedPrice)}`;
    
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

    const activeVariantOptions = variantSelection.activeVariant?.options ?? {};
    const optionValuesOverride: Record<string, string | number | boolean> = {};
    if (activeVariantOptions.talle === "todos" && variantSelection.selected.talle) {
      optionValuesOverride.talle = variantSelection.selected.talle;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "catalog", variantId: targetVariantId, quantity: 1, locale, ...(Object.keys(optionValuesOverride).length > 0 ? { optionValuesOverride } : {}) }),
      });
      if (response.status === 401) {
        addLocalCartItem(targetVariantId);
        router.push("/carrito");
      } else {
        await response.json();
        if (response.ok) {
          router.push("/carrito");
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
    <section className="product-mobile-detail" aria-labelledby="product-mobile-title">
      <div className="product-mobile-layout">
        <div className="product-mobile-gallery" style={{ position: "relative" }}>
          <ProductGallery images={galleryImages} />
        </div>

        <div className="product-mobile-information">
          <h1 id="product-mobile-title">{product.name}</h1>
          <p className="product-mobile-summary">{product.summary}</p>
          <p className="product-mobile-price">{displayedPrice}</p>

          <div className="product-mobile-rule product-mobile-rule-actions" aria-hidden="true" />

          <StructuredVariantPicker product={product} axes={variantSelection.axes} selected={variantSelection.selected} onSelect={variantSelection.select}/>
          {!variantSelection.complete && <p className="variant-selection-note">{locale==='en'?'Select all options to continue.':locale==='pt'?'Selecione todas as opções para continuar.':'Seleccioná todas las opciones para continuar.'}</p>}

          <button className="product-mobile-primary" type="button" disabled={busy || !variantSelection.complete} onClick={() => void addToCart()}>
            {busy ? t("adding") : t("addToCart")}
          </button>
          <Link className="product-mobile-secondary" href="/personalizados">{t("learnCustomization")}</Link>
          {message ? <p className="product-mobile-status" role="status" aria-live="polite">{message}</p> : null}
          <ProductSpecsBox product={product} selectedOptions={variantSelection.selected} activeVariant={variantSelection.activeVariant} />
        </div>
      </div>
    </section>
  );
}
