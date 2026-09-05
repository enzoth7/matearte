"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { getLocalizedProducts } from "@/content/catalog-localization";
import { products } from "@/data/catalog";
import { Link } from "@/i18n/navigation";
import type { Locale, Product } from "@/types/catalog";

type RemoteItem = {
  id: string; item_type: "catalog" | "design"; quantity: number;
  unit_price_minor: number; currency: string;
  variant: null | { name: string; price_minor: number; currency: string; product: { name: string; commerce_product_images?: { storage_path: string; sort_order: number }[] } };
  design: null | { title: string };
};
type Cart = { id: string; items: RemoteItem[] };

import { formatMoney as money } from "@/lib/money";
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
  return item.item_type === "design" ? customDesign : catalogPiece;
}

function itemImage(item: RemoteItem) {
  if (item.item_type === "design") {
    return "/assets/matearte/profile-orders-desktop/design-fallback.png";
  }

  const images = [...(item.variant?.product.commerce_product_images || [])].sort((a, b) => a.sort_order - b.sort_order);
  const imagePath = images[0]?.storage_path;

  const remoteName = normalizeProductName(item.variant?.product.name || "");
  let localImage;
  if (remoteName) {
    const product = products.find((candidate) => {
      const localName = normalizeProductName(candidate.name);
      return localName.includes(remoteName) || remoteName.includes(localName);
    });
    if (product) localImage = product.images[0]?.src;
  }

  if (localImage) return localImage;
  
  if (imagePath) {
    const supabase = createBrowserSupabase();
    return supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
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

export function CartPanel({ exchangeRates }: { exchangeRates?: Record<string, number> }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("cart");

  const format = (minor: number) => money(minor, "UYU", locale, exchangeRates);
  const localizedProducts = getLocalizedProducts(locale);
  const titleFor = (item: RemoteItem) => itemTitle(item, localizedProducts, t("piece"));
  const subtitleFor = (item: RemoteItem) => itemSubtitle(item, t("customDesign"), t("catalogPiece"));
  const [cart, setCart] = useState<Cart | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

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

  const checkoutHref = isAuthenticated ? "/checkout" : "/perfil?redirect=/checkout";

  const mutate = async (method: "PATCH" | "DELETE", itemId: string, quantity?: number) => {
    setBusy(itemId); setError("");
    try {
      const response = await fetch("/api/cart/items", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, quantity }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setCart(value);
    } catch { setError(t("updateFailed")); }
    finally { setBusy(""); }
  };

  // Guest cart: read localStorage items and resolve to catalog or DB products
  type LocalResolvedItem = {
    title: string;
    variantLabel: string;
    variantId: string;
    quantity: number;
    priceMinor: number;
    imageSrc: string;
  };

  const [localItems, setLocalItems] = useState<LocalResolvedItem[]>([]);

  const resolveLocalCart = useCallback(async () => {
    const { readLocalCart } = require("@/lib/browser-cart") as typeof import("@/lib/browser-cart");
    const entries = readLocalCart();
    if (entries.length === 0) {
      setLocalItems([]);
      return;
    }

    const resolved: LocalResolvedItem[] = [];
    const missingUUIDs: Array<{ variantId: string; quantity: number }> = [];

    for (const { variantId, quantity } of entries) {
      const pByVariant = products.find(p => p.variants.some(v => v.id === variantId));
      const pByIdOrSlug = products.find(p => p.id === variantId || p.slug === variantId);
      const product = pByVariant || pByIdOrSlug;

      if (product) {
        const localizedName = localizedProducts.find(lp => lp.id === product.id)?.name || product.name;
        const variant = product.variants.find(v => v.id === variantId);
        const priceMinor = variant?.price?.amountMinor ?? (product.filterData.priceUYU ? product.filterData.priceUYU * 100 : 0);
        resolved.push({
          title: localizedName,
          variantLabel: variant?.label ?? "",
          variantId,
          quantity,
          priceMinor,
          imageSrc: product.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
        });
      } else {
        missingUUIDs.push({ variantId, quantity });
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
            commerce_products (
              id,
              editorial_slug,
              name,
              commerce_product_images (
                storage_path,
                sort_order
              )
            )
          `)
          .in("id", missingUUIDs.map(m => m.variantId));

        const supabaseUrlBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://agdkljuulwjwjasftcce.supabase.co").trim();

        for (const { variantId, quantity } of missingUUIDs) {
          const vData = dbVariants?.find((v: any) => v.id === variantId);
          if (vData) {
            const rawProduct = vData.commerce_products as any;
            const images = (rawProduct?.commerce_product_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
            const imagePath = images[0]?.storage_path;

            // Try matching a local catalog image first for 100% reliable loading
            const rawNameNorm = normalizeProductName(rawProduct?.name || "");
            const localMatch = products.find(p => {
              const pNameNorm = normalizeProductName(p.name);
              return p.slug === rawProduct?.editorial_slug
                || p.id === rawProduct?.editorial_slug
                || (rawNameNorm && (pNameNorm.includes(rawNameNorm) || rawNameNorm.includes(pNameNorm)));
            });
            const localImage = localMatch?.images[0]?.src;

            const imageSrc = localImage || (imagePath
              ? supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl
              : "/assets/matearte/profile-orders-desktop/catalog-fallback.png");

            resolved.push({
              title: rawProduct?.name || "Producto MateArte",
              variantLabel: vData.name || "",
              variantId,
              quantity,
              priceMinor: vData.price_minor || 0,
              imageSrc,
            });
          } else {
            const fallbackP = products[0];
            resolved.push({
              title: fallbackP?.name || "Producto",
              variantLabel: "",
              variantId,
              quantity,
              priceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
              imageSrc: fallbackP?.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
            });
          }
        }
      } catch {
        for (const { variantId, quantity } of missingUUIDs) {
          const fallbackP = products[0];
          resolved.push({
            title: fallbackP?.name || "Producto",
            variantLabel: "",
            variantId,
            quantity,
            priceMinor: (fallbackP?.filterData?.priceUYU || 500) * 100,
            imageSrc: fallbackP?.images[0]?.src || "/assets/matearte/profile-orders-desktop/catalog-fallback.png",
          });
        }
      }
    }

    setLocalItems(resolved);
  }, [localizedProducts]);

  useEffect(() => {
    if (!needsLogin) return;
    void resolveLocalCart();
    const handleCartChange = () => { void resolveLocalCart(); };
    window.addEventListener("matearte-cart-change", handleCartChange);
    return () => { window.removeEventListener("matearte-cart-change", handleCartChange); };
  }, [needsLogin, resolveLocalCart]);

  const removeLocalItem = (variantId: string) => {
    const { readLocalCart } = require("@/lib/browser-cart") as typeof import("@/lib/browser-cart");
    const updated = readLocalCart().filter((e: any) => e.variantId !== variantId);
    localStorage.setItem("matearte_visitor_cart_v1", JSON.stringify(updated));
    window.dispatchEvent(new Event("matearte-cart-change"));
    setLocalItems(prev => prev.filter(i => i.variantId !== variantId));
  };

  const updateLocalItemQuantity = (variantId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeLocalItem(variantId);
      return;
    }
    const { readLocalCart } = require("@/lib/browser-cart") as typeof import("@/lib/browser-cart");
    const cart = readLocalCart();
    const item = cart.find((e: any) => e.variantId === variantId);
    if (item) {
      item.quantity = Math.min(99, newQuantity);
      localStorage.setItem("matearte_visitor_cart_v1", JSON.stringify(cart));
      window.dispatchEvent(new Event("matearte-cart-change"));
    }
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

    const guestSubtotal = localItems.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);
    const guestFormat = (minor: number) => money(minor, "UYU", locale, exchangeRates);
    return (
      <>
        <div className="cart-populated-mobile-state">
          <section className="cart-mobile-selection" aria-labelledby="cart-mobile-selection-title">
            <h2 id="cart-mobile-selection-title" className="sr-only">{t("selectedItems")}</h2>
            <div className="cart-mobile-selection-divider" aria-hidden="true" />
            <div className="cart-mobile-items">
              {localItems.map((item) => (
                <article key={item.variantId} className="cart-mobile-item">
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
                      <div className="cart-mobile-quantity-control" role="group">
                        <button type="button" aria-label="Disminuir" onClick={() => updateLocalItemQuantity(item.variantId, item.quantity - 1)}>
                          <span aria-hidden="true">−</span>
                        </button>
                        <output aria-live="polite">{item.quantity}</output>
                        <button type="button" aria-label="Aumentar" disabled={item.quantity >= 99} onClick={() => updateLocalItemQuantity(item.variantId, item.quantity + 1)}>
                          <span aria-hidden="true">+</span>
                        </button>
                      </div>
                    </div>
                    <button type="button" className="cart-mobile-remove" onClick={() => removeLocalItem(item.variantId)}>
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
              <div><dt>{t("subtotal")}</dt><dd>{guestFormat(guestSubtotal)}</dd></div>
              <div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
            </dl>
            <div className="cart-mobile-summary-divider" aria-hidden="true" />
            <div className="cart-mobile-total"><span>{t("total")}</span><strong>{guestFormat(guestSubtotal)}</strong></div>
            <Link href={"/perfil?redirect=/checkout" as any} className="cart-mobile-checkout">{t("continue")}</Link>
          </aside>
        </div>

        <div className="cart-populated-desktop-state">
          <section className="cart-desktop-selection" aria-labelledby="cart-selection-title">
            <h2 id="cart-selection-title" className="sr-only">{t("selectedItems")}</h2>
            <div className="cart-desktop-selection-divider" aria-hidden="true" />
            <div className="cart-desktop-items">
              {localItems.map((item) => (
                <article key={item.variantId} className="cart-desktop-item">
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
                    <div className="cart-desktop-quantity-control" role="group">
                      <button type="button" aria-label="Disminuir" onClick={() => updateLocalItemQuantity(item.variantId, item.quantity - 1)}>
                        <span aria-hidden="true">−</span>
                      </button>
                      <output aria-live="polite">{item.quantity}</output>
                      <button type="button" aria-label="Aumentar" disabled={item.quantity >= 99} onClick={() => updateLocalItemQuantity(item.variantId, item.quantity + 1)}>
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </div>
                  <button type="button" className="cart-desktop-remove" onClick={() => removeLocalItem(item.variantId)}>
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
              <div><dt>{t("subtotal")}</dt><dd>{guestFormat(guestSubtotal)}</dd></div>
              <div><dt>{t("shipping")}</dt><dd>{t("toCalculate")}</dd></div>
            </dl>
            <div className="cart-desktop-summary-divider" aria-hidden="true" />
            <div className="cart-desktop-total"><span>{t("total")}</span><strong>{guestFormat(guestSubtotal)}</strong></div>
            <Link href={"/perfil?redirect=/checkout" as any} className="cart-desktop-checkout">{t("continue")}</Link>
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
  const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, 0);
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
                      alt={titleFor(item)}
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
                      <div className="cart-mobile-quantity-control" role="group" aria-labelledby={`cart-mobile-quantity-${item.id}`}>
                        <button
                          type="button"
                          aria-label={item.quantity <= 1 ? t("removeItem", { item: titleFor(item) }) : t("decreaseItem", { item: titleFor(item) })}
                          disabled={busy === item.id}
                          onClick={() => void mutate(item.quantity <= 1 ? "DELETE" : "PATCH", item.id, item.quantity - 1)}
                        >
                          <span aria-hidden="true">−</span>
                        </button>
                        <output aria-live="polite" aria-label={t("units", { count: item.quantity })}>{item.quantity}</output>
                        <button
                          type="button"
                          aria-label={t("increaseItem", { item: titleFor(item) })}
                          disabled={busy === item.id || item.quantity >= 99}
                          onClick={() => void mutate("PATCH", item.id, item.quantity + 1)}
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                      </div>
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
              <dd>{format(subtotal)}</dd>
            </div>
            <div>
              <dt>{t("shipping")}</dt>
              <dd>{t("toCalculate")}</dd>
            </div>
          </dl>
          <div className="cart-mobile-summary-divider" aria-hidden="true" />
          <div className="cart-mobile-total">
            <span>{t("total")}</span>
            <strong>{format(subtotal)}</strong>
          </div>
          <Link href={checkoutHref as any} className="cart-mobile-checkout">{t("continue")}</Link>
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
                  alt={titleFor(item)}
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
                  <div className="cart-desktop-quantity-control" role="group" aria-labelledby={`cart-quantity-${item.id}`}>
                    <button
                      type="button"
                      aria-label={item.quantity <= 1 ? t("removeItem", { item: titleFor(item) }) : t("decreaseItem", { item: titleFor(item) })}
                      disabled={busy === item.id}
                      onClick={() => void mutate(item.quantity <= 1 ? "DELETE" : "PATCH", item.id, item.quantity - 1)}
                    >
                      <span aria-hidden="true">−</span>
                    </button>
                    <output aria-live="polite" aria-label={t("units", { count: item.quantity })}>{item.quantity}</output>
                    <button
                      type="button"
                      aria-label={t("increaseItem", { item: titleFor(item) })}
                      disabled={busy === item.id || item.quantity >= 99}
                      onClick={() => void mutate("PATCH", item.id, item.quantity + 1)}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
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
              <dd>{format(subtotal)}</dd>
            </div>
            <div>
              <dt>{t("shipping")}</dt>
              <dd>{t("toCalculate")}</dd>
            </div>
          </dl>
          <div className="cart-desktop-summary-divider" aria-hidden="true" />
          <div className="cart-desktop-total">
            <span>{t("total")}</span>
            <strong>{format(subtotal)}</strong>
          </div>
          <Link href={checkoutHref as any} className="cart-desktop-checkout">{t("continue")}</Link>
        </aside>
      </div>
    </>
  );
}
