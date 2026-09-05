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
  variant: null | { name: string; price_minor: number; currency: string; product: { name: string } };
  design: null | { title: string };
};
type Cart = { id: string; items: RemoteItem[] };

import { formatMoney as money } from "@/lib/money";

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

  const remoteName = normalizeProductName(item.variant?.product.name || "");
  if (remoteName) {
    const product = products.find((candidate) => {
      const localName = normalizeProductName(candidate.name);
      return localName.includes(remoteName) || remoteName.includes(localName);
    });
    if (product) return product.images[0].src;
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

  if (needsLogin) return (
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
