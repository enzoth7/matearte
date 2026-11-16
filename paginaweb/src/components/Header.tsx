"use client";

import { Globe, List, MagnifyingGlass, ShoppingCart, UserCircle, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "lenis/react";
import { Toaster, toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { canonicalPathname, localizeCurrentPathname } from "@/i18n/paths";
import { readLocalCart } from "@/lib/browser-cart";
import { CART_ADDED_EVENT, type CartAddedDetail } from "@/lib/cart-feedback";
import { CurrencySelector } from "./StorefrontCurrency";
import { persistLocalePreference } from "@/lib/locale-preference";
import type { Locale } from "@/types/catalog";
import type { WholesaleDiscountSettings } from "@/lib/wholesale-pricing";
import { CartPanel } from "./CartPanel";
import drawerStyles from "./CartDrawer.module.css";

const navigation = [
  { label: "catalog", href: "/catalogo" },
  { label: "custom", href: "/personalizados" },
  { label: "companies", href: "/empresas" },
  { label: "customers", href: "/clientes" },
  { label: "about", href: "/nosotros" },
  { label: "contact", href: "/contacto" },
] as const;

const localeOptions: Locale[] = ["es", "en", "pt"];
const mobileLocaleOptions: Locale[] = ["es", "pt", "en"];

export function Header({ wholesaleSettings, exchangeRates }: { wholesaleSettings: WholesaleDiscountSettings; exchangeRates: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [fragment, setFragment] = useState("");
  const [session, setSession] = useState<{ authenticated: boolean; user: { name: string } | null; cartCount: number }>({ authenticated: false, user: null, cartCount: 0 });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("header");
  const language = useTranslations("language");
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const cartCloseRef = useRef<HTMLButtonElement>(null);
  const cartPanelRef = useRef<HTMLElement>(null);
  const lenis = useLenis();
  const cartCountRevision = useRef(0);
  const canonical = canonicalPathname(pathname, locale);

  useEffect(() => {
    document.body.style.overflow = open || cartOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, cartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    cartCloseRef.current?.focus();
    const trigger = cartButtonRef.current;
    return () => trigger?.focus();
  }, [cartOpen]);

  useEffect(() => {
    if (!cartOpen || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [cartOpen, lenis]);

  useEffect(() => {
    headerRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (languageOpen) languageButtonRef.current?.focus();
        setLanguageOpen(false);
        setOpen(false);
        setSearchOpen(false);
        setCartOpen(false);
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [languageOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (languageOpen) languageMenuRef.current?.querySelector<HTMLAnchorElement>("[role='menuitem']")?.focus();
  }, [languageOpen]);

  useEffect(() => {
    const updateFragment = () => setFragment(window.location.hash);
    updateFragment();
    window.addEventListener("hashchange", updateFragment);
    return () => window.removeEventListener("hashchange", updateFragment);
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedCartRevision = cartCountRevision.current;
    fetch("/api/session", { signal: controller.signal, credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => {
        if (!value) return;
        if (value.authenticated) {
          setSession(prev => ({ ...value, cartCount: requestedCartRevision === cartCountRevision.current ? value.cartCount : prev.cartCount }));
        } else {
          try {
            const entries = readLocalCart();
            const count = entries.reduce((sum, item) => sum + (item.quantity || 1), 0);
            setSession({ authenticated: false, user: null, cartCount: count });
          } catch {
            setSession(value);
          }
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    const syncGuestCartCount = (event?: Event) => {
      const remoteCount = (event as CustomEvent<{ count?: number }> | undefined)?.detail?.count;
      if (typeof remoteCount === "number" && Number.isFinite(remoteCount)) {
        cartCountRevision.current += 1;
        setSession(prev => ({ ...prev, cartCount: remoteCount }));
        return;
      }
      try {
        const entries = readLocalCart();
        const count = entries.reduce((sum, item) => sum + (item.quantity || 1), 0);
        setSession(prev => prev.authenticated ? prev : { ...prev, cartCount: count });
      } catch {}
    };
    syncGuestCartCount();
    window.addEventListener("matearte-cart-change", syncGuestCartCount);
    return () => window.removeEventListener("matearte-cart-change", syncGuestCartCount);
  }, []);

  useEffect(() => {
    const showCartConfirmation = (event: Event) => {
      const detail = (event as CustomEvent<CartAddedDetail>).detail;
      if (!detail || !Number.isFinite(detail.count)) return;
      cartCountRevision.current += 1;
      setSession(prev => ({ ...prev, cartCount: detail.count }));
      toast.custom(() => (
        <div className="cart-added-notice" role="status">
          <strong>{detail.confirmation.replace(/\.$/, "")}</strong>
          <div className="cart-added-notice-content">
            {detail.imageSrc && <div className="cart-added-notice-image"><Image src={detail.imageSrc} alt="" fill sizes="(max-width: 479px) 84px, 104px" style={detail.imageStyle} unoptimized={detail.imageUnoptimized} /></div>}
            <div className="cart-added-notice-copy">
              <strong data-inline className="cart-added-notice-name">{detail.name}</strong>
              <strong data-inline className="cart-added-notice-price">{detail.price}</strong>
            </div>
          </div>
        </div>
      ), { duration: 2000 });
    };
    window.addEventListener(CART_ADDED_EVENT, showCartConfirmation);
    return () => window.removeEventListener(CART_ADDED_EVENT, showCartConfirmation);
  }, []);

  const isActive = (href: string) => canonical === href || canonical.startsWith(`${href}/`);

  const toggleSearch = () => {
    setOpen(false);
    setCartOpen(false);
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    setSearchValue(searchParams.get("filter") ?? "");
    setSearchOpen(true);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = searchValue.trim();
    router.push({ pathname: "/catalogo", query: value ? { filter: value } : {} });
    setSearchOpen(false);
  };

  const languageHref = (targetLocale: Locale) => {
    const path = localizeCurrentPathname(pathname, locale, targetLocale);
    const query = searchParams.toString();
    return `${path}${query ? `?${query}` : ""}${fragment}`;
  };

  const chooseLanguage = (targetLocale: Locale, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    persistLocalePreference(targetLocale);
    setLanguageOpen(false);
    setOpen(false);
    setCartOpen(false);
    // A locale change must refresh the root document so `html[lang]` and server messages update together.
    window.location.assign(languageHref(targetLocale));
  };

  const handleLanguageKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("[role='menuitem']"));
    if (!items.length) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLAnchorElement));
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <>
      <header ref={headerRef} className="home-header">
        <div className="home-header-inner">
          <Link className="home-header-brand" href="/" aria-label={t("homeLabel")}>
            <Image src="/assets/matearte/home-v2/logo.webp" alt="" width={48} height={48} priority />
            <strong data-inline><strong>MateArte</strong><small>{t("tagline")}</small></strong>
          </Link>
          <nav className="home-header-nav home-header-navigation" aria-label={t("primaryNav")}>
            {navigation.map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : undefined} aria-current={canonical !== "/" && isActive(item.href) ? "page" : undefined}>{t(item.label)}</Link>)}
          </nav>
          <nav className="home-header-nav home-header-actions" aria-label={t("actionsNav")}>
            <button type="button" className="home-header-icon home-header-search" aria-label={t("search")} aria-expanded={searchOpen} aria-controls="home-catalog-search" onClick={toggleSearch}><MagnifyingGlass size={19} aria-hidden="true" /></button>
            <CurrencySelector />
            <div className="home-header-language-wrap" ref={languageMenuRef}>
              <button ref={languageButtonRef} type="button" className="home-header-language" aria-label={t("openLanguage", { language: language(locale) })} aria-haspopup="menu" aria-expanded={languageOpen} aria-controls="home-language-menu" onClick={() => setLanguageOpen((value) => !value)}><Globe size={18} aria-hidden="true" /><strong data-inline>{locale.toUpperCase()}</strong></button>
              {languageOpen && (
                <div id="home-language-menu" className="home-language-menu" role="menu" aria-label={t("language")} onKeyDown={handleLanguageKeys}>
                  {localeOptions.map((option) => <a key={option} role="menuitem" href={languageHref(option)} hrefLang={option === "pt" ? "pt-BR" : option} aria-current={option === locale ? "true" : undefined} onClick={(event) => chooseLanguage(option, event)}>{language(option)}</a>)}
                </div>
              )}
            </div>
            <Link href="/perfil" className="home-header-icon" aria-label={session.authenticated ? t("openAccount") : t("signIn")}><UserCircle size={20} aria-hidden="true" /></Link>
            <button ref={cartButtonRef} type="button" className="home-header-icon home-header-cart" aria-label={session.cartCount ? t("cartCount", { count: session.cartCount }) : t("cart")} aria-haspopup="dialog" aria-expanded={cartOpen} aria-controls="cart-drawer" onClick={() => { setOpen(false); setSearchOpen(false); setCartOpen(true); }}><ShoppingCart size={20} aria-hidden="true" />{session.cartCount > 0 && <strong data-inline>{Math.min(99, session.cartCount)}</strong>}</button>
          </nav>
          <div className="home-header-mobile-actions">
            <button type="button" className="home-header-mobile-search" aria-label={t("search")} aria-expanded={searchOpen} aria-controls="home-catalog-search" onClick={toggleSearch}><MagnifyingGlass size={23} aria-hidden="true" /></button>
            <button type="button" className="home-header-mobile-cart" aria-label={session.cartCount ? t("cartCount", { count: session.cartCount }) : t("cart")} aria-haspopup="dialog" aria-expanded={cartOpen} aria-controls="cart-drawer" onClick={() => { setOpen(false); setSearchOpen(false); setCartOpen(true); }}><ShoppingCart size={23} aria-hidden="true" />{session.cartCount > 0 && <strong data-inline>{Math.min(99, session.cartCount)}</strong>}</button>
            <button type="button" className="home-header-menu" aria-label={open ? t("closeMenu") : t("openMenu")} aria-expanded={open} aria-controls="home-menu-mobile" onClick={() => { setSearchOpen(false); setOpen((value) => !value); }}>
              {open ? <X size={25} aria-hidden="true" /> : <List size={25} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      {searchOpen && (
        <div id="home-catalog-search" data-clarity-mask="true" className="home-catalog-search">
          <form role="search" onSubmit={submitSearch}>
            <MagnifyingGlass size={22} aria-hidden="true" />
            <label className="sr-only" htmlFor="home-catalog-search-input">{t("search")}</label>
            <input
              ref={searchInputRef}
              id="home-catalog-search-input"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
            />
            <button type="submit">{t("searchAction")}</button>
            <button type="button" className="home-catalog-search-close" aria-label={t("closeSearch")} onClick={() => setSearchOpen(false)}><X size={20} aria-hidden="true" /></button>
          </form>
        </div>
      )}
      {open && (
        <>
          <button type="button" className="home-mobile-menu-backdrop" aria-label={t("closeMenu")} onClick={() => setOpen(false)} />
          <div id="home-menu-mobile" className="home-mobile-menu">
            <nav aria-label={t("mobileNav")}>
              {navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(item.href) ? "page" : undefined}><strong data-inline>{t(item.label)}</strong></Link>)}
              <Link href="/perfil" onClick={() => setOpen(false)}><strong data-inline>{session.authenticated ? t("account") : t("signIn")}</strong><UserCircle size={24} aria-hidden="true" /></Link>
              <Link href="/carrito" onClick={() => setOpen(false)}><strong data-inline>{t("cart")}</strong><ShoppingCart size={24} aria-hidden="true" /></Link>
              <div className="home-mobile-languages" aria-label={t("language")}>
                <strong data-inline>{t("language")}</strong>
                <div>{mobileLocaleOptions.map((option) => <a key={option} href={languageHref(option)} hrefLang={option === "pt" ? "pt-BR" : option} aria-label={language(option)} title={language(option)} aria-current={option === locale ? "true" : undefined} onClick={(event) => chooseLanguage(option, event)}><Image src={`/assets/matearte/flags/${option}.svg`} alt="" width={30} height={20} aria-hidden="true" /></a>)}<CurrencySelector /></div>
              </div>
            </nav>
          </div>
        </>
      )}
      {cartOpen && createPortal(<div className={drawerStyles.layer} onWheel={(event) => {
        if (!cartPanelRef.current?.contains(event.target as Node)) cartPanelRef.current?.scrollBy({ top: event.deltaY });
      }}>
        <button type="button" tabIndex={-1} className={drawerStyles.backdrop} aria-label={t("closeCart")} onClick={() => setCartOpen(false)} />
        <section ref={cartPanelRef} id="cart-drawer" data-lenis-prevent className={drawerStyles.panel} role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)'));
          if (!controls.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
          <header className={drawerStyles.header}>
            <h2 id="cart-drawer-title">{t("yourCart")}</h2>
            {session.cartCount > 0 && <strong className={drawerStyles.count}>{Math.min(99, session.cartCount)}</strong>}
            <button ref={cartCloseRef} type="button" className={drawerStyles.close} aria-label={t("closeCart")} onClick={() => setCartOpen(false)}><X size={26} aria-hidden="true" /></button>
          </header>
          <CartPanel mode="drawer" wholesaleSettings={wholesaleSettings} exchangeRates={exchangeRates} onClose={() => setCartOpen(false)} />
        </section>
      </div>, document.body)}
      <Toaster toastOptions={{ style: { background: "var(--paper)", color: "var(--ink)", borderColor: "var(--ink)" } }} position="top-right" visibleToasts={1} duration={2000} offset={{ top: 102, right: 24 }} mobileOffset={{ top: 84, right: 12, left: 12 }} />
    </>
  );
}
