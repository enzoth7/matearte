"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { addLocalCartItem } from "@/lib/browser-cart";
import type { Product } from "@/types/catalog";
import { Link, useRouter } from "@/i18n/navigation";
import { ProductGallery } from "./ProductGallery";

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
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

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

  useEffect(() => {
    if (product.variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(product.variants[0].id);
    }
  }, [product.variants, selectedVariantId]);

  const activeVariantId = selectedVariantId || product.variants[0]?.id;
  const catalogVariant = product.variants.find(v => v.id === activeVariantId) || product.variants[0];
  const commerceVariant = commerce?.available ? commerce.product?.variants.find(v => v.id === activeVariantId) : undefined;
  
  const displayedPrice = commerceVariant
    ? formatPrice(commerceVariant.price_minor / 100)
    : catalogVariant?.price
    ? formatPrice(catalogVariant.price.amountMinor / 100)
    : product.filterData.priceUYU === undefined ? common("consult") : formatPrice(product.filterData.priceUYU);
    
  const generalImages = product.images.filter(img => !img.variantId);
  const variantImages = activeVariantId ? product.images.filter(img => img.variantId === activeVariantId) : [];
  const imagesToShow = variantImages.length > 0 ? [...variantImages, ...generalImages] : product.images;
  const galleryImages = imagesToShow.map(img => ({
    ...img,
    src: img.source === "supabase" ? img.src : productImages[product.id] ?? img.src
  }));

  const addToCart = async () => {
    setMessage("");
    if (!commerceVariant && !catalogVariant) {
      setMessage(t("purchaseUnavailable"));
      return;
    }
    const targetVariantId = commerceVariant?.id || catalogVariant?.id;
    if (!targetVariantId) return;

    setBusy(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "catalog", variantId: targetVariantId, quantity: 1, locale }),
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

          {product.variants.length > 1 && (
            <div className="product-mobile-variants" style={{ marginBottom: '1.5rem' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1a1a1a' }}>Opciones disponibles</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {product.variants.map(v => {
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
                  const isActive = activeVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      title={v.label}
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        backgroundColor: colorHex,
                        border: isActive ? '2px solid #000' : '1px solid #ccc',
                        outline: isActive ? '2px solid #fff' : 'none',
                        outlineOffset: '-4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      aria-label={v.label}
                      aria-pressed={isActive}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <button className="product-mobile-primary" type="button" disabled={busy} onClick={() => void addToCart()}>
            {busy ? t("adding") : t("addToCart")}
          </button>
          <Link className="product-mobile-secondary" href="/personalizados">{t("learnCustomization")}</Link>
          {message ? <p className="product-mobile-status" role="status" aria-live="polite">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
