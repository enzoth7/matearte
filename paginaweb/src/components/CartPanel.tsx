"use client";
import { toArsMinor } from "@/lib/argentina";
import { useStorefrontCurrency } from "./StorefrontCurrency";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLocalizedProducts } from "@/content/catalog-localization";
import { products } from "@/data/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale, Product, Currency, Money } from "@/types/catalog";
import { addLocalCartItem, localCartEntryKey, readLocalCart, removeLocalCartItem, updateLocalCartItemQuantity } from "@/lib/browser-cart";
import { trackJourneyStep } from "../../../shared/journeyAnalytics";
import { defaultCatalogTaxonomy, formatPurchaseSelectionLabel, normalizeCatalogValueMap, type CatalogValueMap } from "../../../shared/catalog-taxonomy";
import { applyWholesaleMateDiscount, type WholesaleDiscountSettings } from "@/lib/wholesale-pricing";

import { Trash } from "@phosphor-icons/react";
import { CartRecommendations } from "./CartRecommendations";
import { complementFamily, recommendForCart, type CartCatalogProduct, type CartRecommendation, type RecommendationSource } from "@/lib/cart-recommendations";
import { notifyCartAdded, countCartItems } from "@/lib/cart-feedback";
import styles from "./Cart.module.css";
import { cartOptionLabel } from "@/lib/cart-option-label";
import drawerStyles from "./CartDrawer.module.css";

type RemoteItem = {
  id: string; item_type: "catalog" | "design"; quantity: number;
  unit_price_minor: number; base_unit_price_minor?: number; catalog_base_unit_price_minor?: number; currency: string;
  option_values_override?: CatalogValueMap;
  variant: null | { id: string; name: string; base_price_minor?: number; price_minor: number; currency: string; active?: boolean; available_web?: boolean; option_values?: CatalogValueMap; product: { id?: string; editorial_slug?: string; attributes?: CatalogValueMap; name: string; category?: string; category_code?: string | null; published?: boolean; commerce_product_images?: { storage_path: string; sort_order: number; variant_id: string | null; option_values?: CatalogValueMap }[] } };
  design: null | { title: string };
};
const EMPTY_CATALOG: CartCatalogProduct[] = [];

type Cart = { id: string; items: RemoteItem[] };

function priceRemoteItems(items: RemoteItem[], settings: WholesaleDiscountSettings) {
  const adjusted = applyWholesaleMateDiscount(items.map((item) => ({
    itemType: item.item_type,
    quantity: item.quantity,
    unitPriceMinor: item.base_unit_price_minor ?? item.variant?.price_minor ?? item.unit_price_minor,
    baseUnitPriceMinor: item.catalog_base_unit_price_minor ?? item.variant?.base_price_minor ?? item.base_unit_price_minor ?? item.unit_price_minor,
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
  disabled = false,
  onChange,
}: {
  value: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  className: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    const parsed = Number.parseInt(draft ?? String(value), 10);
    const next = Number.isFinite(parsed) ? Math.max(1, Math.min(99, parsed)) : value;
    setDraft(null);
    if (next !== value) onChange(next);
  };

  return (
    <div className={className} role="group" aria-label={label}>
      <button type="button" disabled={disabled} aria-label={decreaseLabel} onClick={() => onChange(value - 1)}>
        <strong data-inline aria-hidden="true">−</strong>
      </button>
      <input
        type="number"
        disabled={disabled}
        min="1"
        max="99"
        step="1"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
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
      <button type="button" aria-label={increaseLabel} disabled={disabled || value >= 99} onClick={() => onChange(value + 1)}>
        <strong data-inline aria-hidden="true">+</strong>
      </button>
    </div>
  );
}

import { formatMoney as money } from "@/lib/money";
import { orderItemImagePath } from "@/lib/order-item-image";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function itemTitle(item: RemoteItem, localizedProducts: Product[], fallback: string) {
  if (item.design?.title) return item.design.title;
  const sourceProduct = products.find(candidate => candidate.slug === item.variant?.product.editorial_slug || candidate.variants.some(v => v.id === item.variant?.id));
  return localizedProducts.find((product) => product.id === sourceProduct?.id)?.name || item.variant?.product.name || fallback;
}

function itemSubtitle(item: RemoteItem, locale: Locale) {
  if (item.item_type === "design") return cartOptionLabel(item.option_values_override, locale);
  const options = { ...normalizeCatalogValueMap(item.variant?.option_values), ...normalizeCatalogValueMap(item.option_values_override) };
  return cartOptionLabel(options, locale);
}

function itemImage(item: RemoteItem) {
  if (item.item_type === "design") {
    return "/assets/matearte/01-marca/LogoOriginal.webp";
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

  const product = products.find(candidate => candidate.slug === item.variant?.product.editorial_slug || candidate.variants.some(v => v.id === item.variant?.id));
  const imageSrc = product?.images.find(image => image.variantId === item.variant?.id)?.src || product?.images.find(image => !image.variantId)?.src || product?.images[0]?.src;
  if (imageSrc) return imageSrc;

  return "/assets/matearte/profile-orders-desktop/catalog-fallback.webp";
}

export function CartPanel({ exchangeRates, wholesaleSettings, catalog = EMPTY_CATALOG, mode = "page", onClose }: { exchangeRates?: Record<string, number>; wholesaleSettings: WholesaleDiscountSettings; catalog?: CartCatalogProduct[]; mode?: "page" | "drawer"; onClose?: () => void }) {
  const { currency: displayCurrency, rates: displayRates, arsPerUyu, arsUseBasePrice } = useStorefrontCurrency(exchangeRates);
  const locale = useLocale() as Locale;
  const t = useTranslations("cart");

  const format = (minor: number) => money(minor, "UYU", locale, displayRates, displayCurrency);
  const localizedProducts = useMemo(() => getLocalizedProducts(locale), [locale]);
  const titleFor = (item: RemoteItem) => catalog.find(p => p.variants.some(v => v.id === item.variant?.id))?.name ?? itemTitle(item, localizedProducts, t("piece"));
  const subtitleFor = (item: RemoteItem) => itemSubtitle(item, locale);
  const [rawCart, setCart] = useState<Cart | null>(null);
  const useArsBase = displayCurrency === "ARS" && arsUseBasePrice;
  const cart = rawCart && useArsBase ? { ...rawCart, items: priceRemoteItems(rawCart.items.map(item => ({ ...item, base_unit_price_minor: item.item_type === "catalog" ? item.catalog_base_unit_price_minor ?? item.variant?.base_price_minor ?? item.base_unit_price_minor : item.base_unit_price_minor })), wholesaleSettings) } : rawCart;
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState<Set<string>>(new Set());
  const addLock = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [installmentCount, setInstallmentCount] = useState<6 | 12>(12);
  const loadSequence = useRef(0);
  const quantityTimers = useRef(new Map<string, number>());
  const quantityVersions = useRef(new Map<string, number>());
  const quantityRequests = useRef(new Map<string, AbortController>());

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const [cartResponse, sessionResponse] = await Promise.all([
      fetch("/api/cart", { cache: "no-store" }),
      fetch("/api/session", { cache: "no-store" }),
    ]);
    const session = await sessionResponse.json();
    if (sequence !== loadSequence.current) return;
    setIsAuthenticated(!!session?.authenticated);
    if (cartResponse.status === 401) { setNeedsLogin(true); return; }
    const value = await cartResponse.json();
    if (sequence !== loadSequence.current) return;
    if (!cartResponse.ok) throw new Error(t("loadFailed"));
    setCart(value); setNeedsLogin(false);
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const refreshMergedCart = () => { void load().catch(() => setError(t("loadFailed"))); };
    window.addEventListener("matearte-cart-merged", refreshMergedCart);
    return () => window.removeEventListener("matearte-cart-merged", refreshMergedCart);
  }, [load, t]);

  useEffect(() => {
    if (rawCart && !needsLogin) window.dispatchEvent(new CustomEvent("matearte-cart-change", { detail: { count: countCartItems(rawCart.items) } }));
  }, [rawCart, needsLogin]);

  useEffect(() => () => {
    quantityTimers.current.forEach((timer) => window.clearTimeout(timer));
    quantityRequests.current.forEach((controller) => controller.abort());
  }, []);

  const checkoutHref = isAuthenticated ? "/checkout" as const : { pathname: "/perfil" as const, query: { redirect: "/checkout" } };

  const mutate = async (method: "PATCH" | "DELETE", itemId: string, quantity?: number) => {
    const timer = quantityTimers.current.get(itemId);
    if (timer) window.clearTimeout(timer);
    quantityTimers.current.delete(itemId);
    quantityVersions.current.set(itemId, (quantityVersions.current.get(itemId) || 0) + 1);
    quantityRequests.current.get(itemId)?.abort();
    setPendingQuantity(current => { const next = new Set(current); next.delete(itemId); return next; });
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
    setPendingQuantity(current => new Set(current).add(itemId));
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
      quantityTimers.current.delete(itemId);
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
      } catch {
        if (controller.signal.aborted) return;
        setError(t("updateFailed"));
        await load().catch(() => undefined);
      } finally {
        if (quantityRequests.current.get(itemId) === controller) quantityRequests.current.delete(itemId);
        if (quantityVersions.current.get(itemId) === version) setPendingQuantity(current => { const next = new Set(current); next.delete(itemId); return next; });
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
    wholesaleBasePriceMinor: number;
    priceMinor: number;
    availableWeb: boolean;
    category?: string | null;
    imageSrc: string;
  };

  const [rawLocalItems, setLocalItems] = useState<LocalResolvedItem[]>([]);
  const localBaseItems = useArsBase ? rawLocalItems.map(item => ({ ...item, basePriceMinor: item.wholesaleBasePriceMinor })) : rawLocalItems;
  const localAdjusted = applyWholesaleMateDiscount(localBaseItems.map(item => ({ itemType: "catalog" as const, quantity: item.quantity, unitPriceMinor: item.basePriceMinor, baseUnitPriceMinor: item.wholesaleBasePriceMinor, category: item.category })), wholesaleSettings);
  const localItems = localBaseItems.map((item, index) => ({ ...item, priceMinor: localAdjusted[index].unitPriceMinor }));

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
      const commercial = catalog.find(p => p.variants.some(v => v.id === variantId || v.commerceId === variantId));
      if (commercial) {
        const variant = commercial.variants.find(v => v.id === variantId || v.commerceId === variantId)!;
        const selected = { ...variant.options, ...normalizeCatalogValueMap(optionValues) };
        const label = formatPurchaseSelectionLabel(defaultCatalogTaxonomy, selected);
        resolved.push({ lineKey: localCartEntryKey(entry), title: commercial.name, variantLabel: label === "Única" ? "" : label.replaceAll(` ${String.fromCharCode(183)} `, ", "), variantId, optionValues: selected, quantity, basePriceMinor: variant.price!.amountMinor, wholesaleBasePriceMinor: variant.basePrice?.amountMinor ?? variant.price!.amountMinor, priceMinor: variant.price!.amountMinor, availableWeb: variant.available === true, category: commercial.category, imageSrc: commercial.images.find(i => i.variantId === variantId)?.src ?? commercial.images[0]?.src ?? "/assets/matearte/profile-orders-desktop/catalog-fallback.webp" });
        continue;
      }
      const pByVariant = products.find(p => p.variants.some(v => v.id === variantId));
      const pByIdOrSlug = products.find(p => p.id === variantId || p.slug === variantId);
      const product = pByVariant || pByIdOrSlug;

      if (product) {
        const localizedName = localizedProducts.find(lp => lp.id === product.id)?.name || product.name;
        const variant = product.variants.find(v => v.id === variantId);
        const priceMinor = variant?.price?.amountMinor ?? (product.filterData.priceUYU ? product.filterData.priceUYU * 100 : 0);
        const wholesaleBasePriceMinor = variant?.basePrice?.amountMinor ?? priceMinor;
        const variantImage = product.images.find(image => image.variantId === variantId);
        const generalImage = product.images.find(image => !image.variantId);
        const normalizedOptions = normalizeCatalogValueMap(optionValues);
        const selectedLabel = formatPurchaseSelectionLabel(defaultCatalogTaxonomy, normalizedOptions);
        resolved.push({
          lineKey: localCartEntryKey(entry),
          title: localizedName,
          variantLabel: selectedLabel === "Única" ? "" : selectedLabel.replaceAll(` ${String.fromCharCode(183)} `, ", "),
          variantId,
          optionValues: normalizedOptions,
          quantity,
          basePriceMinor: priceMinor,
          wholesaleBasePriceMinor,
          priceMinor,
          availableWeb: true,
          category: product.category,
          imageSrc: variantImage?.src || generalImage?.src || product.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.webp",
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
            base_price_minor,
            active,
            available_web,
             option_values,
             commerce_products (
               id,
               editorial_slug,
               name,
               category,
               category_code,
               published,
              commerce_product_images (
                storage_path,
                sort_order,
                variant_id
                ,option_values
              )
            )
          `)
          .in("id", missingUUIDs.map(m => m.variantId));



        for (const entry of missingUUIDs) {
          const { variantId, quantity, optionValues } = entry;
          const vData = dbVariants?.find((v) => v.id === variantId);
          if (vData) {
            const rawProduct = Array.isArray(vData.commerce_products)
              ? vData.commerce_products[0]
              : vData.commerce_products;
            const imagePath = orderItemImagePath({
              item_type: "catalog",
              source_variant_id: variantId,
              variant: { product: rawProduct, option_values: vData.option_values },
            });

            const localMatch = products.find(p => p.slug === rawProduct?.editorial_slug || p.id === rawProduct?.id || p.variants.some(v => v.id === variantId));
            const localVariantImage = localMatch?.images.find(image => image.variantId === variantId);
            const localGeneralImage = localMatch?.images.find(image => !image.variantId);
            const localImage = localVariantImage?.src || localGeneralImage?.src || localMatch?.images[0]?.src;

            const imageSrc = imagePath
              ? supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl
              : (localImage || "/assets/matearte/profile-orders-desktop/catalog-fallback.webp");
            const normalizedOptions = normalizeCatalogValueMap(optionValues);
            const selectedLabel = formatPurchaseSelectionLabel(defaultCatalogTaxonomy, normalizedOptions);

            resolved.push({
              lineKey: localCartEntryKey(entry),
              title: rawProduct?.name || "Producto MateArte",
              variantLabel: selectedLabel === "Única" ? "" : selectedLabel.replaceAll(` ${String.fromCharCode(183)} `, ", "),
              variantId,
              optionValues: normalizedOptions,
              quantity,
              basePriceMinor: vData.price_minor || 0,
              wholesaleBasePriceMinor: vData.base_price_minor ?? vData.price_minor ?? 0,
              priceMinor: vData.price_minor || 0,
              availableWeb: vData.active !== false && vData.available_web !== false && rawProduct?.published === true,
              category: rawProduct?.category_code || rawProduct?.category || null,
              imageSrc,
            });
          } else {

            resolved.push({
              lineKey: localCartEntryKey(entry),
              title: t("piece"),
              variantLabel: "",
              variantId,
              quantity,
              basePriceMinor: 0,
              wholesaleBasePriceMinor: 0,
              priceMinor: 0,
              availableWeb: false,
              imageSrc: "/assets/matearte/profile-orders-desktop/catalog-fallback.webp",
            });
          }
        }
      } catch {
        for (const entry of missingUUIDs) {
          const { variantId, quantity, optionValues } = entry;

          resolved.push({
            lineKey: localCartEntryKey(entry),
            title: t("piece"),
            variantLabel: "",
            variantId,
            optionValues,
            quantity,
            basePriceMinor: 0,
            wholesaleBasePriceMinor: 0,
            priceMinor: 0,
            availableWeb: false,
            imageSrc: "/assets/matearte/profile-orders-desktop/catalog-fallback.webp",
          });
        }
      }
    }

    const adjusted = applyWholesaleMateDiscount(resolved.map(item=>({
      itemType:"catalog" as const,
      quantity:item.quantity,
      unitPriceMinor:item.basePriceMinor,
      baseUnitPriceMinor:item.wholesaleBasePriceMinor,
      category:item.category,
    })),wholesaleSettings);
    setLocalItems(resolved.map((item,index)=>({...item,priceMinor:adjusted[index].unitPriceMinor})));
  }, [catalog,localizedProducts,wholesaleSettings,t]);

  useEffect(() => {
    if (!needsLogin) return;
    // The browser cart is an external store and must be loaded when this view mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resolveLocalCart();
    const handleCartChange = () => { void resolveLocalCart(); };
    window.addEventListener("matearte-cart-change", handleCartChange);
    return () => { window.removeEventListener("matearte-cart-change", handleCartChange); };
  }, [needsLogin, resolveLocalCart]);

  useEffect(() => {
    if (needsLogin) {
      if (localItems.some((item) => item.quantity > 0)) trackJourneyStep('catalog', 'cart');
      return;
    }
    if (cart?.items.some((item) => item.item_type === 'catalog' && item.quantity > 0)) trackJourneyStep('catalog', 'cart');
    if (cart?.items.some((item) => item.item_type === 'design' && item.quantity > 0)) trackJourneyStep('custom', 'cart');
  }, [needsLogin, localItems, cart?.items]);

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
        baseUnitPriceMinor: item.wholesaleBasePriceMinor,
        category: item.category,
      })), wholesaleSettings);
      return next.map((item, index) => ({ ...item, priceMinor: adjusted[index].unitPriceMinor }));
    });
    updateLocalCartItemQuantity(lineKey, quantity);
  };

  const sources: RecommendationSource[] = needsLogin
    ? localItems.map(i => ({ available: i.availableWeb, variantId: i.variantId, family: complementFamily({ id: "", slug: "", category: i.category ?? "", attributes: {} }), price: { amountMinor: i.basePriceMinor, currency: "UYU" } }))
    : (cart?.items ?? []).map(i => ({ available: i.item_type === "design" || Boolean(i.variant?.active && i.variant.available_web !== false && i.variant.product.published), variantId: i.variant?.id, productId: i.variant?.product.id,
      family: i.item_type === "design" ? "mate" : complementFamily({ id: i.variant?.product.id ?? "", slug: i.variant?.product.editorial_slug ?? "", category: i.variant?.product.category_code ?? i.variant?.product.category ?? "", attributes: i.variant?.product.attributes }),
      price: { amountMinor: i.base_unit_price_minor ?? i.unit_price_minor, currency: i.currency as Currency } }));
  const recommendations = recommendForCart(catalog, sources, displayRates, useArsBase);
  const formatPrice = (price: Money) => money(price.amountMinor, price.currency, locale, displayRates, displayCurrency);
  const addRecommendation = async (recommendation: CartRecommendation) => {
    if (addLock.current || busy || pendingQuantity.size || !recommendation.product.quickVariantId) return;
    addLock.current = true;
    setAdding(recommendation.product.id); setError(""); setConfirmation("");
    try {
      // Recheck current availability and required options, also for visitors.
      const check = await fetch(`/api/catalog/products?slug=${encodeURIComponent(recommendation.product.slug)}`, { cache: "no-store" });
      const current = await check.json();
      if (!check.ok || !current.available || !current.commerceEnabled || current.quickAddVariantId !== recommendation.product.quickVariantId) throw new Error();
      const selectedOptions = normalizeCatalogValueMap(current.quickAddOptionValues);
      const response = await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType: "catalog", variantId: current.quickAddVariantId, quantity: 1, locale, optionValuesOverride: selectedOptions }) });
      let count: number;
      if (response.status === 401 && needsLogin) {
        addLocalCartItem(current.quickAddVariantId, 1, selectedOptions);
        await resolveLocalCart();
        count = countCartItems(readLocalCart());
      } else {
        const next = await response.json();
        if (!response.ok || !Array.isArray(next.items)) throw new Error();
        setCart(next); setNeedsLogin(false); count = countCartItems(next.items);
      }
      const message = t("addedItem", { item: recommendation.product.name });
      setConfirmation(message);
      notifyCartAdded({ name: recommendation.product.name, price: formatPrice(recommendation.variant.price!), count, confirmation: message });
    } catch { setError(t("addFailed")); }
    finally { addLock.current = false; setAdding(""); }
  };

  if (!needsLogin && !cart) return <div className={mode === "drawer" ? drawerStyles.feedback : styles.feedback} role={error ? "alert" : "status"}>{error || t("loading")}</div>;
  const lines = needsLogin ? localItems.map(i => ({
    key: i.lineKey, title: i.title, subtitle: cartOptionLabel(i.optionValues, locale) || i.variantLabel, image: i.imageSrc,
    quantity: i.quantity, editable: true, price: i.priceMinor, basePrice: i.basePriceMinor, category: i.category,
    available: i.availableWeb, currency: "UYU" as Currency,
    change: (quantity: number) => updateLocalItemQuantity(i.lineKey, quantity), remove: () => removeLocalItem(i.lineKey),
  })) : (cart?.items ?? []).map(i => ({
    key: i.id, title: titleFor(i), subtitle: subtitleFor(i), image: itemImage(i), quantity: i.quantity,
    editable: i.item_type === "catalog", price: i.unit_price_minor, basePrice: i.base_unit_price_minor ?? i.variant?.price_minor ?? i.unit_price_minor,
    category: i.variant?.product.category_code ?? i.variant?.product.category, currency: i.currency as Currency,
    available: i.item_type === "design" || Boolean(i.variant?.active && i.variant.available_web !== false && i.variant.product.published),
    change: (quantity: number) => updateRemoteItemQuantity(i.id, quantity), remove: () => void mutate("DELETE", i.id),
  }));
  if (!lines.length) return <div className={mode === "drawer" ? drawerStyles.empty : styles.empty}>
    <Image src="/assets/matearte/cart-desktop/empty-cart.webp" alt={t("emptyAlt")} width={221} height={221} />
    <h2>{t("emptyTitle")}</h2><div>{t("emptyBody")}</div>
    <Link className={styles.viewProduct} href="/catalogo">{t("explore")}</Link>
    {needsLogin && <Link href="/perfil">{t("login")}</Link>}
  </div>;
  const sum = (base: boolean) => lines.reduce((total, i) => total + (base ? i.basePrice : i.price) * i.quantity, 0);
  const sumDisplay = (base: boolean) => displayCurrency === "ARS"
    ? money(lines.reduce((total, i) => total + toArsMinor(base ? i.basePrice : i.price, arsPerUyu) * i.quantity, 0), "ARS")
    : format(sum(base));
  const discount = sum(true) - sum(false);
  const unavailable = lines.some(i => !i.available);
  if (mode === "drawer") {
    const totalMinor = displayCurrency === "ARS"
      ? lines.reduce((total, item) => total + toArsMinor(item.price, arsPerUyu) * item.quantity, 0)
      : sum(false);
    const targetMinor = displayCurrency === "ARS" ? totalMinor : displayCurrency === "UYU" ? totalMinor : Math.round(totalMinor / ((displayRates as Record<string, number>)[displayCurrency] || 1));
    const installmentAmount = (targetMinor / installmentCount / 100).toLocaleString(locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : "es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const installmentPrice = displayCurrency === "USD" ? `US$ ${installmentAmount}` : displayCurrency === "BRL" ? `R$ ${installmentAmount}` : `$ ${installmentAmount} ${displayCurrency}`;
    return <div className={drawerStyles.content}>
      <section className={drawerStyles.items} aria-label={t("selectedItems")}>
        {lines.map(item => <article key={item.key} className={drawerStyles.item}>
          <div className={drawerStyles.thumbnail}><Image src={item.image} alt={item.title} fill sizes="(max-width: 600px) 96px, 104px" unoptimized={item.image.startsWith("http") || item.image.startsWith("/imagenes/")} /></div>
          <div className={drawerStyles.itemBody}>
            <h3>{item.title}</h3>
            {item.subtitle && <div className={drawerStyles.options}>{item.subtitle}</div>}
            <div className={drawerStyles.unitPrice}>{item.price > 0 ? t("unitPrice", { price: formatPrice({ amountMinor: item.price, currency: item.currency }) }) : t("unavailable")}</div>
            <div className={drawerStyles.itemActions}>
              {item.editable ? <QuantityControl disabled={Boolean(adding) || busy === item.key} className={drawerStyles.quantity} value={item.quantity} label={t("editQuantity", { item: item.title })} decreaseLabel={t(item.quantity <= 1 ? "removeItem" : "decreaseItem", { item: item.title })} increaseLabel={t("increaseItem", { item: item.title })} onChange={item.change} /> : <output className={drawerStyles.staticQuantity} aria-label={t("units", { count: item.quantity })}>{item.quantity}</output>}
              <button type="button" className={drawerStyles.remove} aria-label={t("removeItem", { item: item.title })} disabled={Boolean(adding) || busy === item.key} onClick={item.remove}><Trash size={20} aria-hidden="true" /></button>
            </div>
          </div>
        </article>)}
      </section>
      <div className={drawerStyles.offer}><strong>{t("firstPurchaseOffer")}</strong><div>{t("subscriberCodeHint")}</div></div>
      <section className={drawerStyles.summary} aria-label={t("summaryLabel")}>
        <h3>{t("summary")}</h3>
        <dl><div><dt>{t("subtotal")}</dt><dd>{sumDisplay(true)}</dd></div><div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
          {discount > 0 && <div><dt>{t("wholesaleDiscount")}</dt><dd>− {format(discount)}</dd></div>}
        </dl>
        <div className={drawerStyles.total}><strong>{t("total")}</strong><strong>{sumDisplay(false)}</strong></div>
      </section>
      <div className={drawerStyles.installments}>
        <div role="status" aria-live="polite">{t("installments", { count: installmentCount, price: installmentPrice })}</div>
        <div className={drawerStyles.installmentChoices} role="group" aria-label={t("installmentOptions")}>
          {([12, 6] as const).map(count => <button key={count} type="button" aria-pressed={installmentCount === count} onClick={() => setInstallmentCount(count)}>{count}</button>)}
        </div>
      </div>
      {unavailable ? <div role="alert" className={drawerStyles.feedback}>{t("unavailable")}</div> : <Link className={drawerStyles.cartLink} href="/carrito" onClick={onClose}>{t("goToCart")}</Link>}
      <div className={drawerStyles.secure}><Image src="/assets/matearte/cart-drawer/secure.svg" alt="" width={20} height={22} />{t("securePayment")}</div>
      <div className={drawerStyles.paymentLogos} aria-label={t("paymentMethods")}>
        <Image src="/assets/matearte/cart-drawer/oca.svg" alt="OCA" width={58} height={28} />
        <Image src="/assets/matearte/cart-drawer/mercado_pago.png" alt="Mercado Pago" width={40} height={28} />
        <Image src="/assets/matearte/cart-drawer/visa.png" alt="Visa" width={42} height={28} />
        <Image src="/assets/matearte/cart-drawer/mastercard.png" alt="Mastercard" width={50} height={28} />
        <Image src="/assets/matearte/cart-drawer/paypal.png" alt="PayPal" width={36} height={28} />
        <Image src="/assets/matearte/cart-drawer/bank.svg" alt={t("bankTransfer")} width={31} height={28} />
      </div>
      {error && <div role="alert" className={drawerStyles.feedback}>{error}</div>}
      <div role="status" aria-live="polite" className="sr-only">{confirmation}</div>
    </div>;
  }
  return <div className={styles.content}>
    <div className={styles.purchase}>
      <section className={styles.selection} aria-label={t("selectedItems")}>
        <div className={styles.items}>{lines.map(item => <article key={item.key} className={styles.item}>
          <div className={styles.thumbnail}><Image src={item.image} alt={item.title} fill sizes="104px" unoptimized={item.image.startsWith("http") || item.image.startsWith("/imagenes/")} /></div>
          <div className={styles.itemCopy}><h2>{item.title}</h2>{item.subtitle && <div>{item.subtitle}</div>}<div>{item.price > 0 ? t("unitPrice", { price: formatPrice({ amountMinor: item.price, currency: item.currency }) }) : t("unavailable")}</div></div>
          <div className={styles.actions}>
            {item.editable ? <QuantityControl disabled={Boolean(adding) || busy === item.key} className={styles.quantity} value={item.quantity} label={t("editQuantity", { item: item.title })} decreaseLabel={t(item.quantity <= 1 ? "removeItem" : "decreaseItem", { item: item.title })} increaseLabel={t("increaseItem", { item: item.title })} onChange={item.change} /> : <output className={styles.staticQuantity} aria-label={t("units", { count: 1 })}>1</output>}
            <button type="button" className={styles.remove} aria-label={t("removeItem", { item: item.title })} disabled={Boolean(adding) || busy === item.key} onClick={item.remove}><Trash size={20} weight="regular" aria-hidden="true" /></button>
          </div>
        </article>)}</div>
        <Link className={styles.continueShopping} href="/catalogo">{t("continueShopping")}</Link>
      </section>
      <aside className={styles.summary} aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">{t("summary")}</h2>
        <dl><div><dt>{t("subtotal")}</dt><dd>{sumDisplay(true)}</dd></div><div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
          {discount > 0 && <div><dt>{t("wholesaleDiscount", { discount: wholesaleSettings.wholesale_mate_discount_percent })}</dt><dd>− {format(discount)}</dd></div>}
        </dl>
        <div className={styles.total}>{t("total")}: {sumDisplay(false)}</div>
        {unavailable ? <div role="alert">{t("unavailable")}</div> : <Link className={styles.checkout} href={checkoutHref}>{t("continue")}</Link>}
      </aside>
    </div>
    {error && <div role="alert" className={styles.feedback}>{error}</div>}
    <div role="status" aria-live="polite" className="sr-only">{confirmation}</div>
    <CartRecommendations recommendations={recommendations} adding={adding} blocked={Boolean(busy) || pendingQuantity.size > 0} onAdd={item => void addRecommendation(item)} format={formatPrice} />
  </div>;
}
