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

const catalogAssetRoot = "/assets/matearte/catalog-desktop";
const productAssetRoot = "/assets/matearte/product-desktop";

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

export function ProductDesktop({ product, exchangeRates }: { product: Product; exchangeRates?: Record<string, number> }) {
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
    <section className="product-desktop-detail" aria-labelledby="product-desktop-title">
      <div className="product-desktop-grid">
        <div className="product-desktop-gallery">
          <ProductGallery images={galleryImages} />
        </div>

        <div className="product-desktop-information">
          <h1 id="product-desktop-title">{product.name}</h1>
          <p className="product-desktop-summary">{product.summary}</p>
          {product.attributes?.forma && <p className="product-attribute-summary">{locale==='en'?'Shape':locale==='pt'?'Forma':'Forma'}: {String(product.attributes.forma)==='ovalada'?(locale==='en'?'Oval':locale==='pt'?'Oval':'Ovalada'):String(product.attributes.forma)==='cuadrada'?(locale==='en'?'Square':locale==='pt'?'Quadrada':'Cuadrada'):String(product.attributes.forma)}</p>}
          {product.attributes?.genero && <p className="product-attribute-summary">{locale==='en'?'Gender':locale==='pt'?'Gênero':'Género'}: {String(product.attributes.genero).toLowerCase()==='hombre'?(locale==='en'?'Men':locale==='pt'?'Masculino':'Hombre'):String(product.attributes.genero).toLowerCase()==='mujer'?(locale==='en'?'Women':locale==='pt'?'Feminino':'Mujer'):String(product.attributes.genero).toLowerCase()==='unisex'?(locale==='en'?'Unisex':locale==='pt'?'Unissex':'Unisex'):String(product.attributes.genero)}</p>}
          {product.attributes?.['largo-cinto-cm'] && <p className="product-attribute-summary">{locale==='en'?'Belt length':locale==='pt'?'Comprimento do cinto':'Largo del cinto'}: {String(product.attributes['largo-cinto-cm'])} cm</p>}
          <p className="product-desktop-price">{displayedPrice}</p>

          <div className="product-desktop-rule product-desktop-rule-actions" aria-hidden="true" />

          <StructuredVariantPicker product={product} axes={variantSelection.axes} selected={variantSelection.selected} onSelect={variantSelection.select}/>
          {!variantSelection.complete && <p className="variant-selection-note">{locale==='en'?'Select all options to continue.':locale==='pt'?'Selecione todas as opções para continuar.':'Seleccioná todas las opciones para continuar.'}</p>}

          <button className="product-desktop-primary" type="button" disabled={busy || !variantSelection.complete} onClick={() => void addToCart()}>
            {busy ? t("adding") : t("addToCart")}
          </button>
          <Link className="product-desktop-secondary" href="/personalizados">{t("learnCustomization")}</Link>
          <p className="product-desktop-status" role="status" aria-live="polite">{message}</p>
        </div>
      </div>
    </section>
  );
}
