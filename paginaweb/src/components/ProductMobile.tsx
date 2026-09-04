"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { addLocalCartItem } from "@/lib/browser-cart";
import type { Product } from "@/types/catalog";
import { Link } from "@/i18n/navigation";

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

const colors = [
  { id: "toastedLeather", asset: "color-cuero-tostado.svg" },
  { id: "sand", asset: "color-arena.svg" },
  { id: "cocoa", asset: "color-cacao.svg" },
  { id: "sage", asset: "color-salvia.svg" },
] as const;

type CommerceVariant = {
  id: string;
  price_minor: number;
};

type CommerceData = {
  available: boolean;
  commerceEnabled: boolean;
  product: { variants: CommerceVariant[] } | null;
};

const formatPrice = (amount: number) => `$ ${new Intl.NumberFormat("es-UY").format(amount)} UYU`;

export function ProductMobile({ product }: { product: Product }) {
  const locale = useLocale();
  const t = useTranslations("product");
  const common = useTranslations("common");
  const [selectedColor, setSelectedColor] = useState<(typeof colors)[number]["id"]>("toastedLeather");
  const [commerce, setCommerce] = useState<CommerceData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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

  const commerceVariant = commerce?.available ? commerce.product?.variants[0] : undefined;
  const displayedPrice = commerceVariant
    ? formatPrice(commerceVariant.price_minor / 100)
    : product.filterData.priceUYU === undefined ? common("consult") : formatPrice(product.filterData.priceUYU);
  const mainImage = product.images[0];
  const productImage = mainImage.source === "supabase" ? mainImage.src : productImages[product.id] ?? mainImage.src;

  const addToCart = async () => {
    setMessage("");
    if (!commerceVariant) {
      setMessage(t("purchaseUnavailable"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "catalog", variantId: commerceVariant.id, quantity: 1, locale }),
      });
      if (response.status === 401) {
        addLocalCartItem(commerceVariant.id);
        setMessage(t("savedLocally"));
      } else {
        await response.json();
        setMessage(response.ok ? t("added") : t("addFailed"));
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
          <Image
            src={productImage}
            alt={mainImage.alt}
            fill
            sizes="342px"
            priority
          />
        </div>

        <div className="product-mobile-information">
          <h1 id="product-mobile-title">{product.name}</h1>
          <p className="product-mobile-summary">{product.summary}</p>
          <p className="product-mobile-price">{displayedPrice}</p>

          <div className="product-mobile-rule" aria-hidden="true" />
          <p className="product-mobile-overline">{t("referenceOptions")}</p>

          <fieldset className="product-mobile-colors">
            <legend className="sr-only">{t("chooseReferenceColor")}</legend>
            <div className="product-mobile-color-heading">
              <span>{t("color")}</span>
              <span>{t(selectedColor)}</span>
            </div>
            <div className="product-mobile-color-options">
              {colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={selectedColor === color.id ? "is-selected" : undefined}
                  aria-label={t("colorLabel", { color: t(color.id) })}
                  aria-pressed={selectedColor === color.id}
                  onClick={() => setSelectedColor(color.id)}
                >
                  <Image src={`${productAssetRoot}/${color.asset}`} alt="" width={44} height={44} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>

          <p className="product-mobile-helper">{t("colorHelper")}</p>
          <div className="product-mobile-rule product-mobile-rule-actions" aria-hidden="true" />

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
