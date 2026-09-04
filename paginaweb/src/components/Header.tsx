"use client";

import { Globe, List, MagnifyingGlass, ShoppingCart, UserCircle, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "@/i18n/navigation";
import { canonicalPathname, localizeCurrentPathname } from "@/i18n/paths";
import { persistLocalePreference } from "@/lib/locale-preference";
import type { Locale } from "@/types/catalog";

const navigation = [
  { label: "catalog", href: "/catalogo" },
  { label: "custom", href: "/personalizados" },
  { label: "customers", href: "/clientes" },
  { label: "about", href: "/nosotros" },
  { label: "contact", href: "/contacto" },
] as const;

const localeOptions: Locale[] = ["es", "en", "pt"];

export function Header() {
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [fragment, setFragment] = useState("");
  const [session, setSession] = useState<{ authenticated: boolean; user: { name: string } | null; cartCount: number }>({ authenticated: false, user: null, cartCount: 0 });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale() as Locale;
  const t = useTranslations("header");
  const language = useTranslations("language");
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const canonical = canonicalPathname(pathname, locale);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    headerRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (languageOpen) languageButtonRef.current?.focus();
        setLanguageOpen(false);
        setOpen(false);
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
    fetch("/api/session", { signal: controller.signal, credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => value && setSession(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  const isActive = (href: string) => canonical === href || canonical.startsWith(`${href}/`);

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
            <Image src="/assets/matearte/home-v2/logo.png" alt="" width={48} height={48} priority />
            <span><strong>MateArte</strong><small>{t("tagline")}</small></span>
          </Link>
          <nav className="home-header-nav home-header-navigation" aria-label={t("primaryNav")}>
            {navigation.map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : undefined} aria-current={canonical !== "/" && isActive(item.href) ? "page" : undefined}>{t(item.label)}</Link>)}
          </nav>
          <nav className="home-header-nav home-header-actions" aria-label={t("actionsNav")}>
            <Link href="/catalogo" className="home-header-icon" aria-label={t("search")}><MagnifyingGlass size={19} aria-hidden="true" /></Link>
            <div className="home-header-language-wrap" ref={languageMenuRef}>
              <button ref={languageButtonRef} type="button" className="home-header-language" aria-label={t("openLanguage", { language: language(locale) })} aria-haspopup="menu" aria-expanded={languageOpen} aria-controls="home-language-menu" onClick={() => setLanguageOpen((value) => !value)}><Globe size={18} aria-hidden="true" /><span>{locale.toUpperCase()}</span></button>
              {languageOpen && (
                <div id="home-language-menu" className="home-language-menu" role="menu" aria-label={t("language")} onKeyDown={handleLanguageKeys}>
                  {localeOptions.map((option) => <a key={option} role="menuitem" href={languageHref(option)} hrefLang={option === "pt" ? "pt-BR" : option} aria-current={option === locale ? "true" : undefined} onClick={(event) => chooseLanguage(option, event)}>{language(option)}</a>)}
                </div>
              )}
            </div>
            <Link href="/perfil" className="home-header-icon" aria-label={session.authenticated ? t("openAccount") : t("signIn")}><UserCircle size={20} aria-hidden="true" /></Link>
            <Link href="/carrito" className="home-header-icon home-header-cart" aria-label={session.cartCount ? t("cartCount", { count: session.cartCount }) : t("cart")}><ShoppingCart size={20} aria-hidden="true" />{session.cartCount > 0 && <span>{Math.min(99, session.cartCount)}</span>}</Link>
          </nav>
          <button type="button" className="home-header-menu" aria-label={open ? t("closeMenu") : t("openMenu")} aria-expanded={open} aria-controls="home-menu-mobile" onClick={() => setOpen((value) => !value)}>
            {open ? <X size={25} aria-hidden="true" /> : <List size={25} aria-hidden="true" />}
          </button>
        </div>
      </header>
      {open && (
        <div id="home-menu-mobile" className="home-mobile-menu">
          <nav aria-label={t("mobileNav")}>
            {navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(item.href) ? "page" : undefined}><span>{t(item.label)}</span></Link>)}
            <Link href="/perfil" onClick={() => setOpen(false)}><span>{session.authenticated ? t("account") : t("signIn")}</span><UserCircle size={24} aria-hidden="true" /></Link>
            <Link href="/carrito" onClick={() => setOpen(false)}><span>{t("cart")}</span><ShoppingCart size={24} aria-hidden="true" /></Link>
            <div className="home-mobile-languages" aria-label={t("language")}>
              <span>{t("language")}</span>
              <div>{localeOptions.map((option) => <a key={option} href={languageHref(option)} hrefLang={option === "pt" ? "pt-BR" : option} aria-current={option === locale ? "true" : undefined} onClick={(event) => chooseLanguage(option, event)}>{language(option)}</a>)}</div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
