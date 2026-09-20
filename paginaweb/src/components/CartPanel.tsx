"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLocalizedProducts } from "@/content/catalog-localization";
import { products } from "@/data/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale, Product } from "@/types/catalog";
import { localCartEntryKey, readLocalCart, removeLocalCartItem, updateLocalCartItemQuantity } from "@/lib/browser-cart";
import { defaultCatalogTaxonomy, formatVariantLabel, normalizeCatalogValueMap, type CatalogValueMap } from "../../../shared/catalog-taxonomy";
import { applyWholesaleMateDiscount, isWholesaleMateCategory, type WholesaleDiscountSettings } from "@/lib/wholesale-pricing";

type RemoteItem = {
  id: string; item_type: "catalog" | "design"; quantity: number;
  unit_price_minor: number; base_unit_price_minor?: number; currency: string;
  option_values_override?: CatalogValueMap;
  variant: null | { id: string; name: string; price_minor: number; currency: string; option_values?: CatalogValueMap; product: { name: string; category?: string; category_code?: string | null; commerce_product_images?: { storage_path: string; sort_order: number; variant_id: string | null; option_values?: CatalogValueMap }[] } };
  design: null | { title: string };
};
type Cart = { id: string; items: RemoteItem[] };

function priceRemoteItems(items: RemoteItem[], settings: WholesaleDiscountSettings) {
  const adjusted = applyWholesaleMateDiscount(items.map((item) => ({
    itemType: item.item_type,
    quantity: item.quantity,
    unitPriceMinor: item.base_unit_price_minor ?? item.variant?.price_minor ?? item.unit_price_minor,
    category: item.variant?.product.category_code || item.variant?.product.category || null,
  })), settings);
  return items.map((item, index) => ({ ...item, unit_price_minor: adjusted[index].unitPriceMinor }));
}

function QuantityControl({
  value,
  label,
  decreaseLabel,
  increaseLabel,
  className,
  onChange,
}: {
  value: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  className: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? Math.max(1, Math.min(99, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={className} role="group" aria-label={label}>
      <button type="button" aria-label={decreaseLabel} onClick={() => onChange(value - 1)}>
        <span aria-hidden="true">−</span>
      </button>
      <input
        type="number"
        min="1"
        max="99"
        step="1"
        inputMode="numeric"
        aria-label={label}
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          if (!/^\d{1,2}$/.test(nextDraft)) return;
          const next = Number(nextDraft);
          if (next >= 1 && next <= 99 && next !== value) onChange(next);
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <button type="button" aria-label={increaseLabel} disabled={value >= 99} onClick={() => onChange(value + 1)}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

import { formatMoney as money } from "@/lib/money";
import { orderItemImagePath } from "@/lib/order-item-image";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const normalizeProductName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function itemTitle(item: RemoteItem, localizedProducts: Product[], fallback: string) {
  if (item.design?.title) return item.design.title;
  const remoteName = normalizeProductName(item.variant?.product.name || "");
  const sourceProduct = products.find((candidate) => {
    const localName = normalizeProductName(candidate.name);
    return remoteName && (localName.includes(remoteName) || remoteName.includes(localName));
  });
  return localizedProducts.find((product) => product.id === sourceProduct?.id)?.name || item.variant?.product.name || fallback;
}

function itemSubtitle(item: RemoteItem, customDesign: string, catalogPiece: string) {
  if (item.item_type === "design") return customDesign;
  const options = { ...normalizeCatalogValueMap(item.variant?.option_values), ...normalizeCatalogValueMap(item.option_values_override) };
  const category = item.variant?.product.category_code || item.variant?.product.category || "";
  const selection = formatVariantLabel(defaultCatalogTaxonomy, category, options);
  return selection === "Única" ? item.variant?.name || catalogPiece : selection;
}

function itemImage(item: RemoteItem) {
  if (item.item_type === "design") {
    return "/assets/matearte/01-marca/LogoOriginal.jpg";
  }

  const imagePath = orderItemImagePath({
    item_type: item.item_type,
    source_variant_id: item.variant?.id,
    variant: item.variant,
  });

  if (imagePath) {
    const supabase = createBrowserSupabase();
    return supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
  }

  const remoteName = normalizeProductName(item.variant?.product.name || "");
  if (remoteName) {
    const product = products.find((candidate) => {
      const localName = normalizeProductName(candidate.name);
      return localName.includes(remoteName) || remoteName.includes(localName);
    });
    const variantImage = product?.images.find(image => image.variantId === item.variant?.id);
    const generalImage = product?.images.find(image => !image.variantId);
    const imageSrc = variantImage?.src || generalImage?.src || product?.images[0]?.src;
    if (imageSrc) return imageSrc;
  }

  return "/assets/matearte/profile-orders-desktop/catalog-fallback.png";
}

function MobileEmptyCart({ showLogin }: { showLogin: boolean }) {
  const t = useTranslations("cart");
  return (
    <div className="cart-empty-mobile-state">
      <div className="cart-empty-mobile-image">
        <Image
          src="/assets/matearte/cart-desktop/empty-cart.png"
          alt={t("emptyAlt")}
          fill
          priority
          sizes="308px"
        />
      </div>
      <div className="cart-empty-mobile-message">
        <div className="cart-empty-mobile-icon">
          <Image src="/assets/matearte/cart-desktop/bag.svg" alt="" width={24} height={24} aria-hidden="true" />
        </div>
        <h2>{t("emptyTitle")}</h2>
        <p>{t("emptyBody")}</p>
      </div>
      <div className="cart-empty-mobile-actions">
        <Link className="cart-empty-mobile-primary" href="/catalogo">{t("explore")}</Link>
        {showLogin && (
          <Link className="cart-empty-mobile-login" href="/perfil">
            {t("login")}
          </Link>
        )}
      </div>
    </div>
  );
}

export function CartPanel({ exchangeRates, wholesaleSettings }: { exchangeRates?: Record<string, number>; wholesaleSettings: WholesaleDiscountSettings }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("cart");

  const format = (minor: number) => money(minor, "UYU", locale, exchangeRates);
  const localizedProducts = getLocalizedProducts(locale);
  const titleFor = (item: RemoteItem) => itemTitle(item, localizedProducts, t("piece"));
  const subtitleFor = (item: RemoteItem) => itemSubtitle(item, t("customDesign"), t("catalogPiece"));
  const imageAltFor = (item: RemoteItem) => item.item_type === "design" ? "MateArte" : titleFor(item);
  const [cart, setCart] = useState<Cart | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const quantityTimers = useRef(new Map<string, number>());
  const quantityVersions = useRef(new Map<string, number>());
  const quantityRequests = useRef(new Map<string, AbortController>());

  const load = useCallback(async () => {
    const [cartResponse, sessionResponse] = await Promise.all([
      fetch("/api/cart", { cache: "no-store" }),
      fetch("/api/session", { cache: "no-store" }),
    ]);
    const session = await sessionResponse.json();
    setIsAuthenticated(!!session?.authenticated);
    if (cartResponse.status === 401) { setNeedsLogin(true); return; }
    const value = await cartResponse.json();
    if (!cartResponse.ok) throw new Error(t("loadFailed"));
    setCart(value); setNeedsLogin(false);
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => () => {
    quantityTimers.current.forEach((timer) => window.clearTimeout(timer));
    quantityRequests.current.forEach((controller) => controller.abort());
  }, []);

  const checkoutHref = isAuthenticated ? "/checkout" : "/perfil?redirect=/checkout";

  const mutate = async (method: "PATCH" | "DELETE", itemId: string, quantity?: number) => {
    const timer = quantityTimers.current.get(itemId);
    if (timer) window.clearTimeout(timer);
    quantityRequests.current.get(itemId)?.abort();
    setBusy(itemId); setError("");
    try {
      const response = await fetch("/api/cart/items", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, quantity }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setCart(value);
    } catch { setError(t("updateFailed")); }
    finally { setBusy(""); }
  };

  const updateRemoteItemQuantity = (itemId: string, requestedQuantity: number) => {
    if (requestedQuantity <= 0) {
      void mutate("DELETE", itemId);
      return;
    }
    const quantity = Math.max(1, Math.min(99, Math.trunc(requestedQuantity)));
    setError("");
    setCart((current) => current ? {
      ...current,
      items: priceRemoteItems(
        current.items.map((item) => item.id === itemId ? { ...item, quantity } : item),
        wholesaleSettings,
      ),
    } : current);

    const previousTimer = quantityTimers.current.get(itemId);
    if (previousTimer) window.clearTimeout(previousTimer);
    const version = (quantityVersions.current.get(itemId) || 0) + 1;
    quantityVersions.current.set(itemId, version);
    quantityTimers.current.set(itemId, window.setTimeout(async () => {
      quantityRequests.current.get(itemId)?.abort();
      const controller = new AbortController();
      quantityRequests.current.set(itemId, controller);
      try {
        const response = await fetch("/api/cart/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, quantity }),
          signal: controller.signal,
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        if (quantityVersions.current.get(itemId) === version) setCart(value);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(t("updateFailed"));
        await load().catch(() => undefined);
      } finally {
        if (quantityRequests.current.get(itemId) === controller) quantityRequests.current.delete(itemId);
      }
    }, 300));
  };

  // Guest cart: read localStorage items and resolve to catalog or DB products
  type LocalResolvedItem = {
    lineKey: string;
    title: string;
    variantLabel: string;
    variantId: string;
    optionValues?: CatalogValueMap;
    quantity: number;
    basePriceMinor: number;
    priceMinor: number;
    category?: string | null;
    imageSrc: string;
  };

  const [localItems, setLocalItems] = useState<LocalResolvedItem[]>([]);

  const resolveLocalCart = useCallback(async () => {
    const entries = readLocalCart();
    if (entries.length === 0) {
      setLocalItems([]);
      return;
    }

    const resolved: LocalResolvedItem[] = [];
    const missingUUIDs: typeof entries = [];

    for (const entry of entries) {
      const { variantId, quantity, optionValues } = entry;
      const pByVariant = products.find(p => p.variants.some(v => v.id === variantId));
      const pByIdOrSlug = products.find(p => p.id === variantId || p.slug === variantId);
      const product = pByVariant || pByIdOrSlug;

      if (product) {
        const localizedName = localizedProducts.find(lp => lp.id === product.id)?.name || product.name;
        const variant = product.variants.find(v => v.id === variantId);
        const priceMinor = variant?.price?.amountMinor ?? (product.filterData.priceUYU ? product.filterData.priceUYU * 100 : 0);
        const variantImage = product.images.find(image => image.variantId === variantId);
        const generalImage = product.images.find(image => !image.variantId);
        const normalizedOptions = normalizeCatalogValueMap(optionValues);
        const selectedLabel = formatVariantLabel(defaultCatalogTaxonomy, product.category, normalizedOptions);
        resolved.push({
          lineKey: localCartEntryKey(entry),
          title: localizedName,
          variantLabel: selectedLabel === "Única" ? variant?.label ?? "" : selectedLabel,
          variantId,
          optionValues: normalizedOptions,
          quantity,
          basePriceMinor: priceMinor,
          priceMinor,
          category: product.category,
          imageSrc: variantImage?.src || generalImage?.src || product.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
        });
      } else {
        missingUUIDs.push(entry);
      }
    }

    if (missingUUIDs.length > 0) {
      try {
        const { createBrowserSupabase } = await import("@/lib/supabase/browser");
        const supabase = createBrowserSupabase();
        const { data: dbVariants } = await supabase
          .from("commerce_variants")
          .select(`
            id,
            name,
            price_minor,
             option_values,
             commerce_products (
               id,
               editorial_slug,
               name,
               category,
               category_code,
              commerce_product_images (
                storage_path,
                sort_order,
                variant_id
                ,option_values
              )
            )
          `)
          .in("id", missingUUIDs.map(m => m.variantId));

        const supabaseUrlBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://agdkljuulwjwjasftcce.supabase.co").trim();

        for (const entry of missingUUIDs) {
          const { variantId, quantity, optionValues } = entry;
          const vData = dbVariants?.find((v: any) => v.id === variantId);
          if (vData) {
            const rawProduct = vData.commerce_products as any;
            const imagePath = orderItemImagePath({
              item_type: "catalog",
              source_variant_id: variantId,
              variant: { product: rawProduct, option_values: vData.option_values },
            });

            // Try matching a local catalog image first for 100% reliable loading
            const rawNameNorm = normalizeProductName(rawProduct?.name || "");
            const localMatch = products.find(p => {
              const pNameNorm = normalizeProductName(p.name);
              return p.slug === rawProduct?.editorial_slug
                || p.id === rawProduct?.editorial_slug
                || (rawNameNorm && (pNameNorm.includes(rawNameNorm) || rawNameNorm.includes(pNameNorm)));
            });
            const localVariantImage = localMatch?.images.find(image => image.variantId === variantId);
            const localGeneralImage = localMatch?.images.find(image => !image.variantId);
            const localImage = localVariantImage?.src || localGeneralImage?.src || localMatch?.images[0]?.src;

            const imageSrc = imagePath
              ? supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl
              : (localImage || "/assets/matearte/profile-orders-desktop/catalog-fallback.png");
            const normalizedOptions = normalizeCatalogValueMap(optionValues);
            const selectedLabel = formatVariantLabel(defaultCatalogTaxonomy, rawProduct?.category_code || rawProduct?.category || "", normalizedOptions);

            resolved.push({
              lineKey: localCartEntryKey(entry),
              title: rawProduct?.name || "Producto MateArte",
              variantLabel: selectedLabel === "Única" ? vData.name || "" : selectedLabel,
              variantId,
              optionValues: normalizedOptions,
              quantity,
              basePriceMinor: vData.price_minor || 0,
              priceMinor: vData.price_minor || 0,
              category: rawProduct?.category_code || rawProduct?.category || null,
              imageSrc,
            });
          } else {
            const fallbackP = products[0];
            resolved.push({
              lineKey: localCartEntryKey(entry),
              title: fallbackP?.name || "Producto",
              variantLabel: "",
              variantId,
              quantity,
              basePriceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
              priceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
              imageSrc: fallbackP?.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
            });
          }
        }
      } catch {
        for (const entry of missingUUIDs) {
          const { variantId, quantity, optionValues } = entry;
          const fallbackP = products[0];
          resolved.push({
            lineKey: localCartEntryKey(entry),
            title: fallbackP?.name || "Producto",
            variantLabel: "",
            variantId,
            optionValues,
            quantity,
            basePriceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
            priceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
            imageSrc: fallbackP?.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
          });
        }
      }
    }

    const adjusted = applyWholesaleMateDiscount(resolved.map(item=>({
      itemType:"catalog" as const,
      quantity:item.quantity,
      unitPriceMinor:item.basePriceMinor,
      category:item.category,
    })),wholesaleSettings);
    setLocalItems(resolved.map((item,index)=>({...item,priceMinor:adjusted[index].unitPriceMinor})));
  }, [localizedProducts,wholesaleSettings]);

  useEffect(() => {
    if (!needsLogin) return;
    void resolveLocalCart();
    const handleCartChange = () => { void resolveLocalCart(); };
    window.addEventListener("matearte-cart-change", handleCartChange);
    return () => { window.removeEventListener("matearte-cart-change", handleCartChange); };
  }, [needsLogin, resolveLocalCart]);

  const removeLocalItem = (lineKey: string) => {
    removeLocalCartItem(lineKey);
    setLocalItems(prev => prev.filter(i => i.lineKey !== lineKey));
  };

  const updateLocalItemQuantity = (lineKey: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeLocalItem(lineKey);
      return;
    }
    const quantity = Math.max(1, Math.min(99, Math.trunc(newQuantity)));
    setLocalItems((current) => {
      const next = current.map((item) => item.lineKey === lineKey ? { ...item, quantity } : item);
      const adjusted = applyWholesaleMateDiscount(next.map((item) => ({
        itemType: "catalog" as const,
        quantity: item.quantity,
        unitPriceMinor: item.basePriceMinor,
        category: item.category,
      })), wholesaleSettings);
      return next.map((item, index) => ({ ...item, priceMinor: adjusted[index].unitPriceMinor }));
    });
    updateLocalCartItemQuantity(lineKey, quantity);
  };

  if (needsLogin) {
    if (localItems.length === 0) return (
      <>
      <MobileEmptyCart showLogin />
      <div className="cart-empty-desktop-state cart-empty cart-empty-login">
        <div className="cart-empty-copy">
          <div className="cart-empty-icon">
            <Image src="/assets/matearte/cart-desktop/bag.svg" alt="" width={24} height={24} aria-hidden="true" />
          </div>
          <div className="cart-empty-message">
            <p className="display-font mt-5 text-4xl">{t("emptyTitle")}</p>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-black/60">{t("emptyBody")}</p>
          </div>
          <div className="cart-empty-actions">
            <Link className="button-primary gap-2" href="/catalogo">{t("explore")}</Link>
            <Link className="cart-empty-login-button" href="/perfil">{t("login")}</Link>
          </div>
        </div>
        <div className="cart-empty-image">
          <Image src="/assets/matearte/cart-desktop/empty-cart.png" alt={t("emptyAlt")} fill priority sizes="221px" />
        </div>
      </div>
      </>
    );

    const guestBaseSubtotal = localItems.reduce((sum, item) => sum + item.basePriceMinor * item.quantity, 0);
    const guestSubtotal = localItems.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);
    const guestDiscountMinor = Math.max(0, guestBaseSubtotal - guestSubtotal);
    const guestFormat = (minor: number) => money(minor, "UYU", locale, exchangeRates);
    const showGuestWholesaleNotice = wholesaleSettings.wholesale_mate_discount_enabled
      && wholesaleSettings.wholesale_mate_discount_percent > 0
      && localItems.some((item) => isWholesaleMateCategory(item.category));
    const wholesaleNotice = t("wholesaleDiscountNotice", {
      discount: wholesaleSettings.wholesale_mate_discount_percent,
      threshold: wholesaleSettings.wholesale_mate_quantity_threshold,
    });
    return (
      <>
        <div className="cart-populated-mobile-state">
          <section className="cart-mobile-selection" aria-labelledby="cart-mobile-selection-title">
            <h2 id="cart-mobile-selection-title" className="sr-only">{t("selectedItems")}</h2>
            <div className="cart-mobile-selection-divider" aria-hidden="true" />
            <div className="cart-mobile-items">
              {localItems.map((item) => (
                <article key={item.lineKey} className="cart-mobile-item">
                  <div className="cart-mobile-item-row">
                    <div className="cart-mobile-thumbnail">
                      <Image src={item.imageSrc} alt={item.title} fill sizes="104px" />
                    </div>
                    <div className="cart-mobile-item-copy">
                      <h3>{item.title}</h3>
                      <p>{item.variantLabel || t("catalogPiece")}</p>
                      <span>{t("unitPrice", { price: guestFormat(item.priceMinor) })}</span>
                    </div>
                  </div>
                  <div className="cart-mobile-item-actions">
                    <div className="cart-mobile-quantity">
                      <span>{t("quantity")}</span>
                      <QuantityControl
                        className="cart-mobile-quantity-control"
                        value={item.quantity}
                        label={t("editQuantity", { item: item.title })}
                        decreaseLabel={t("decreaseItem", { item: item.title })}
                        increaseLabel={t("increaseItem", { item: item.title })}
                        onChange={(quantity) => updateLocalItemQuantity(item.lineKey, quantity)}
                      />
                    </div>
                    <button type="button" className="cart-mobile-remove" onClick={() => removeLocalItem(item.lineKey)}>
                      <Image src="/assets/matearte/cart-desktop/remove.svg" alt="" width={16} height={16} aria-hidden="true" />
                      {t("remove")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-mobile-selection-divider cart-mobile-selection-divider-bottom" aria-hidden="true" />
            <Link className="cart-mobile-continue-shopping" href="/catalogo">{t("continueShopping")} <span aria-hidden="true">→</span></Link>
          </section>
          <aside className="cart-mobile-summary" aria-label={t("summaryLabel")}>
            <div className="cart-mobile-summary-heading"><span aria-hidden="true" /><p>{t("summary")}</p></div>
            <dl className="cart-mobile-summary-list">
              <div><dt>{t("subtotal")}</dt><dd>{guestFormat(guestBaseSubtotal)}</dd></div>
              <div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
              {guestDiscountMinor > 0 && <div className="cart-summary-discount"><dt>{t("wholesaleDiscount", { discount: wholesaleSettings.wholesale_mate_discount_percent })}</dt><dd>− {guestFormat(guestDiscountMinor)}</dd></div>}
            </dl>
            <div className="cart-mobile-summary-divider" aria-hidden="true" />
            <div className="cart-mobile-total"><span>{t("total")}</span><strong>{guestFormat(guestSubtotal)}</strong></div>
            <Link href={"/perfil?redirect=/checkout" as any} className="cart-mobile-checkout">{t("continue")}</Link>
            {showGuestWholesaleNotice && <p className="cart-wholesale-notice">{wholesaleNotice}</p>}
          </aside>
        </div>

        <div className="cart-populated-desktop-state">
          <section className="cart-desktop-selection" aria-labelledby="cart-selection-title">
            <h2 id="cart-selection-title" className="sr-only">{t("selectedItems")}</h2>
            <div className="cart-desktop-selection-divider" aria-hidden="true" />
            <div className="cart-desktop-items">
              {localItems.map((item) => (
                <article key={item.lineKey} className="cart-desktop-item">
                  <div className="cart-desktop-thumbnail">
                    <Image src={item.imageSrc} alt={item.title} fill sizes="120px" />
                  </div>
                  <div className="cart-desktop-item-copy">
                    <h3>{item.title}</h3>
                    <p>{item.variantLabel || t("catalogPiece")}</p>
                    <span>{t("unitPrice", { price: guestFormat(item.priceMinor) })}</span>
                  </div>
                  <div className="cart-desktop-quantity">
                    <span>{t("quantity")}</span>
                    <QuantityControl
                      className="cart-desktop-quantity-control"
                      value={item.quantity}
                      label={t("editQuantity", { item: item.title })}
                      decreaseLabel={t("decreaseItem", { item: item.title })}
                      increaseLabel={t("increaseItem", { item: item.title })}
                      onChange={(quantity) => updateLocalItemQuantity(item.lineKey, quantity)}
                    />
                  </div>
                  <button type="button" className="cart-desktop-remove" onClick={() => removeLocalItem(item.lineKey)}>
                    <Image src="/assets/matearte/cart-desktop/remove.svg" alt="" width={16} height={16} aria-hidden="true" />
                    {t("remove")}
                  </button>
                </article>
              ))}
            </div>
            <Link className="cart-desktop-continue-shopping" href="/catalogo">{t("continueShopping")} <span aria-hidden="true">→</span></Link>
          </section>
          <aside className="cart-desktop-summary" aria-label={t("summaryLabel")}>
            <div className="cart-desktop-summary-heading"><span aria-hidden="true" /><p>{t("summary")}</p></div>
            <dl className="cart-desktop-summary-list">
              <div><dt>{t("subtotal")}</dt><dd>{guestFormat(guestBaseSubtotal)}</dd></div>
              <div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
              {guestDiscountMinor > 0 && <div className="cart-summary-discount"><dt>{t("wholesaleDiscount", { discount: wholesaleSettings.wholesale_mate_discount_percent })}</dt><dd>− {guestFormat(guestDiscountMinor)}</dd></div>}
            </dl>
            <div className="cart-desktop-summary-divider" aria-hidden="true" />
            <div className="cart-desktop-total"><span>{t("total")}</span><strong>{guestFormat(guestSubtotal)}</strong></div>
            <Link href={"/perfil?redirect=/checkout" as any} className="cart-desktop-checkout">{t("continue")}</Link>
            {showGuestWholesaleNotice && <p className="cart-wholesale-notice">{wholesaleNotice}</p>}
          </aside>
        </div>
      </>
    );
  }

  if (!cart) return (
    <div role="status" aria-live="polite" className="cart-loading grid gap-8 p-6 motion-safe:animate-pulse sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-10">
      <div>
        <div className="h-4 w-32 rounded bg-black/10" />
        <div className="mt-8 h-28 rounded bg-black/5" />
      </div>
      <div className="h-56 rounded bg-black/10" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
  if (cart.items.length === 0) return (
    <>
    <MobileEmptyCart showLogin={false} />
    <div className="cart-empty-desktop-state cart-empty cart-empty-authenticated">
      <div className="cart-empty-copy">
        <div className="cart-empty-icon">
          <Image src="/assets/matearte/cart-desktop/bag.svg" alt="" width={24} height={24} aria-hidden="true" />
        </div>
        <div className="cart-empty-message">
          <p className="display-font mt-5 text-4xl">{t("emptyTitle")}</p>
          <p className="mt-4 text-sm text-black/60">{t("emptyBody")}</p>
        </div>
        <div className="cart-empty-actions">
          <Link className="button-primary gap-2" href="/catalogo">{t("explore")}</Link>
        </div>
      </div>
      <div className="cart-empty-image">
        <Image
          src="/assets/matearte/cart-desktop/empty-cart.png"
          alt={t("emptyAlt")}
          fill
          priority
          sizes="221px"
        />
      </div>
    </div>
    </>
  );
  const baseSubtotal = cart.items.reduce((sum, item) => sum + (item.base_unit_price_minor ?? item.variant?.price_minor ?? item.unit_price_minor) * item.quantity, 0);
  const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, 0);
  const discountMinor = Math.max(0, baseSubtotal - subtotal);
  const showWholesaleNotice = wholesaleSettings.wholesale_mate_discount_enabled
    && wholesaleSettings.wholesale_mate_discount_percent > 0
    && cart.items.some((item) => item.item_type === "catalog" && isWholesaleMateCategory(item.variant?.product.category_code || item.variant?.product.category));
  const wholesaleNotice = t("wholesaleDiscountNotice", {
    discount: wholesaleSettings.wholesale_mate_discount_percent,
    threshold: wholesaleSettings.wholesale_mate_quantity_threshold,
  });
  return (
    <>
      <div className="cart-populated-mobile-state">
        <section className="cart-mobile-selection" aria-labelledby="cart-mobile-selection-title">
          <h2 id="cart-mobile-selection-title" className="sr-only">{t("selectedItems")}</h2>
          <div className="cart-mobile-selection-divider" aria-hidden="true" />
          <div className="cart-mobile-items">
            {cart.items.map((item) => (
              <article key={item.id} className="cart-mobile-item">
                <div className="cart-mobile-item-row">
                  <div className="cart-mobile-thumbnail">
                    <Image
                      src={itemImage(item)}
                      alt={imageAltFor(item)}
                      fill
                      loading={cart.items[0]?.id === item.id ? "eager" : "lazy"}
                      sizes="104px"
                    />
                  </div>
                  <div className="cart-mobile-item-copy">
                    <h3>{titleFor(item)}</h3>
                    <p>{subtitleFor(item)}</p>
                    <span>{t("unitPrice", { price: format(item.unit_price_minor) })}</span>
                  </div>
                </div>
                <div className="cart-mobile-item-actions">
                  <div className="cart-mobile-quantity">
                    <span id={`cart-mobile-quantity-${item.id}`}>{t("quantity")}</span>
                    {item.item_type === "catalog" ? (
                      <QuantityControl
                        className="cart-mobile-quantity-control"
                        value={item.quantity}
                        label={t("editQuantity", { item: titleFor(item) })}
                        decreaseLabel={item.quantity <= 1 ? t("removeItem", { item: titleFor(item) }) : t("decreaseItem", { item: titleFor(item) })}
                        increaseLabel={t("increaseItem", { item: titleFor(item) })}
                        onChange={(quantity) => updateRemoteItemQuantity(item.id, quantity)}
                      />
                    ) : (
                      <div className="cart-mobile-quantity-control cart-mobile-quantity-static" aria-labelledby={`cart-mobile-quantity-${item.id}`}>
                        <output aria-label={t("units", { count: 1 })}>1</output>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cart-mobile-remove"
                    disabled={busy === item.id}
                    onClick={() => void mutate("DELETE", item.id)}
                  >
                    <Image src="/assets/matearte/cart-desktop/remove.svg" alt="" width={16} height={16} aria-hidden="true" />
                    {t("remove")}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-mobile-selection-divider cart-mobile-selection-divider-bottom" aria-hidden="true" />
          {error && <p role="alert" className="cart-mobile-error">{error}</p>}
          <Link className="cart-mobile-continue-shopping" href="/catalogo">
            {t("continueShopping")} <span aria-hidden="true">→</span>
          </Link>
        </section>

        <aside className="cart-mobile-summary" aria-label={t("summaryLabel")}>
          <div className="cart-mobile-summary-heading">
            <span aria-hidden="true" />
            <p>{t("summary")}</p>
          </div>
          <dl className="cart-mobile-summary-list">
            <div>
              <dt>{t("subtotal")}</dt>
              <dd>{format(baseSubtotal)}</dd>
            </div>
            <div>
              <dt>{t("shipping")}</dt>
              <dd>{t("toCalculate")}</dd>
            </div>
            {discountMinor > 0 && (
              <div className="cart-summary-discount">
                <dt>{t("wholesaleDiscount", { discount: wholesaleSettings.wholesale_mate_discount_percent })}</dt>
                <dd>− {format(discountMinor)}</dd>
              </div>
            )}
          </dl>
          <div className="cart-mobile-summary-divider" aria-hidden="true" />
          <div className="cart-mobile-total">
            <span>{t("total")}</span>
            <strong>{format(subtotal)}</strong>
          </div>
          <Link href={checkoutHref as any} className="cart-mobile-checkout">{t("continue")}</Link>
          {showWholesaleNotice && <p className="cart-wholesale-notice">{wholesaleNotice}</p>}
        </aside>
      </div>

      <div className="cart-populated-desktop-state">
        <section className="cart-desktop-selection" aria-labelledby="cart-selection-title">
          <h2 id="cart-selection-title" className="sr-only">{t("selectedItems")}</h2>
          <div className="cart-desktop-selection-divider" aria-hidden="true" />
          <div className="cart-desktop-items">
          {cart.items.map((item) => (
            <article key={item.id} className="cart-desktop-item">
              <div className="cart-desktop-thumbnail">
                <Image
                  src={itemImage(item)}
                  alt={imageAltFor(item)}
                  fill
                  loading={cart.items[0]?.id === item.id ? "eager" : "lazy"}
                  sizes="120px"
                />
              </div>
              <div className="cart-desktop-item-copy">
                <h3>{titleFor(item)}</h3>
                <p>{subtitleFor(item)}</p>
                <span>{t("unitPrice", { price: format(item.unit_price_minor) })}</span>
              </div>
              <div className="cart-desktop-quantity">
                <span id={`cart-quantity-${item.id}`}>{t("quantity")}</span>
                {item.item_type === "catalog" ? (
                  <QuantityControl
                    className="cart-desktop-quantity-control"
                    value={item.quantity}
                    label={t("editQuantity", { item: titleFor(item) })}
                    decreaseLabel={item.quantity <= 1 ? t("removeItem", { item: titleFor(item) }) : t("decreaseItem", { item: titleFor(item) })}
                    increaseLabel={t("increaseItem", { item: titleFor(item) })}
                    onChange={(quantity) => updateRemoteItemQuantity(item.id, quantity)}
                  />
                ) : (
                  <div className="cart-desktop-quantity-control cart-desktop-quantity-static" aria-labelledby={`cart-quantity-${item.id}`}>
                    <output aria-label={t("units", { count: 1 })}>1</output>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="cart-desktop-remove"
                disabled={busy === item.id}
                onClick={() => void mutate("DELETE", item.id)}
              >
                <Image src="/assets/matearte/cart-desktop/remove.svg" alt="" width={16} height={16} aria-hidden="true" />
                {t("remove")}
              </button>
            </article>
          ))}
          </div>
          {error && <p role="alert" className="cart-desktop-error">{error}</p>}
          <Link className="cart-desktop-continue-shopping" href="/catalogo">
            {t("continueShopping")} <span aria-hidden="true">→</span>
          </Link>
        </section>

        <aside className="cart-desktop-summary" aria-label={t("summaryLabel")}>
          <div className="cart-desktop-summary-heading">
            <span aria-hidden="true" />
            <p>{t("summary")}</p>
          </div>
          <dl className="cart-desktop-summary-list">
            <div>
              <dt>{t("subtotal")}</dt>
              <dd>{format(baseSubtotal)}</dd>
            </div>
            <div>
              <dt>{t("shipping")}</dt>
              <dd>{t("toCalculate")}</dd>
            </div>
            {discountMinor > 0 && (
              <div className="cart-summary-discount">
                <dt>{t("wholesaleDiscount", { discount: wholesaleSettings.wholesale_mate_discount_percent })}</dt>
                <dd>− {format(discountMinor)}</dd>
              </div>
            )}
          </dl>
          <div className="cart-desktop-summary-divider" aria-hidden="true" />
          <div className="cart-desktop-total">
            <span>{t("total")}</span>
            <strong>{format(subtotal)}</strong>
          </div>
          <Link href={checkoutHref as any} className="cart-desktop-checkout">{t("continue")}</Link>
          {showWholesaleNotice && <p className="cart-wholesale-notice">{wholesaleNotice}</p>}
        </aside>
      </div>
    </>
  );
}
