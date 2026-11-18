"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { WelcomeOfferDialog, type WelcomeOffer } from "./StorefrontAnnouncement";
import { topBarText, type TopBarMessageRow } from "../../../shared/top-bar-messages";
import { useLocale, useTranslations } from "next-intl";
import { activeStorewideSalePercent, DEFAULT_STOREWIDE_SALE, salePriceMinor, type StorewideSaleSettings } from "../../../shared/storewide-sale";

const StorewideSaleContext = createContext<StorewideSaleSettings>(DEFAULT_STOREWIDE_SALE);

export function StorewideSaleProvider({ settings, children }: { settings: StorewideSaleSettings; children: ReactNode }) {
  return <StorewideSaleContext.Provider value={settings}>{children}</StorewideSaleContext.Provider>;
}

/** Descuento general vigente hoy en Montevideo. La base de datos decide el cobro; esto solo lo muestra. */
export function useStorewideSale() {
  const settings = useContext(StorewideSaleContext);
  const percent = activeStorewideSalePercent(settings);
  return useMemo(() => ({
    active: percent > 0,
    percent,
    priceMinor: (amountMinor: number) => salePriceMinor(amountMinor, percent),
    priceUyu: (amountUyu: number) => salePriceMinor(Math.round(amountUyu * 100), percent) / 100,
  }), [percent]);
}

/** Precio anterior tachado y precio con descuento, sin contenedor para usarlo dentro de cualquier texto de precio. */
export function SalePrice({ list, current }: { list: string; current: string }) {
  const t = useTranslations("storewideSale");
  return <>
    <del className="storewide-price-old"><small className="sr-only">{t("was")} </small>{list}</del>{" "}
    <ins className="storewide-price-new"><small className="sr-only">{t("now")} </small>{current}</ins>
  </>;
}

type TopBarMessage = { id: string; text: string; action?: { label: string; onClick?: () => void; href?: string } };

/**
 * Barra negra fija sobre el encabezado. Rota solo los mensajes
 * que se editan en Gestión, Marketing, Avisos. El de suscripción solo aparece si hay oferta activa
 * y la persona todavía no se suscribió.
 */
export function StorewideSaleBar({ rows = [] }: { rows?: TopBarMessageRow[] }) {
  const t = useTranslations("storewideSale");
  const locale = useLocale();
  const bar = useRef<HTMLDivElement>(null);
  const [offer, setOffer] = useState<WelcomeOffer | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const wantsOffer = rows.some((row) => row.action === "subscribe");

  useEffect(() => {
    let active = true;
    if (!wantsOffer || sessionStorage.getItem("matearte-welcome-submitted") === "1") return;
    void createBrowserSupabase().from("marketing_active_offer")
      .select("headline,description,image_url").eq("id", true).maybeSingle()
      .then(({ data }) => { if (active && data) setOffer(data as WelcomeOffer); }, () => undefined);
    return () => { active = false; };
  }, [wantsOffer]);

  const messages: TopBarMessage[] = [
    ...rows.flatMap((row): TopBarMessage[] => {
      const text = topBarText(row, locale);
      const label = row.action_label?.trim() || t("subscribeAction");
      if (row.action === "subscribe") return offer ? [{ id: row.id, text, action: { label, onClick: () => setOfferOpen(true) } }] : [];
      if (row.action === "link" && row.link_url) return [{ id: row.id, text, action: { label, href: row.link_url } }];
      return [{ id: row.id, text }];
    }),
  ];
  const current = messages.length ? messages[index % messages.length] : null;
  const closeOffer = useCallback(() => {
    setOfferOpen(false);
    if (sessionStorage.getItem("matearte-welcome-submitted") === "1") setOffer(null);
  }, []);

  useEffect(() => {
    if (paused || offerOpen || messages.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [paused, offerOpen, messages.length]);

  useEffect(() => {
    // Los paneles fijos del encabezado bajan lo que mide la barra, que queda fija al hacer scroll.
    const root = document.documentElement;
    const sync = () => {
      const height = Math.round(bar.current?.getBoundingClientRect().height ?? 0);
      root.style.setProperty("--storewide-bar-height", `${height}px`);
      root.style.setProperty("--storewide-bar-offset", `${height}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    if (bar.current) observer.observe(bar.current);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--storewide-bar-height");
      root.style.removeProperty("--storewide-bar-offset");
    };
  }, []);

  if (!current) return null;
  return <>
    <div ref={bar} className="storewide-sale-bar" role="region" aria-label={t("label")}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div key={current.id + index} className="storewide-sale-bar-message" aria-live={paused ? "polite" : "off"}>
        <strong>{current.text}</strong>
        {current.action?.href
          ? <a className="storewide-sale-bar-action" href={current.action.href} {...(current.action.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{current.action.label}</a>
          : current.action && <button type="button" className="storewide-sale-bar-action" onClick={current.action.onClick}>{current.action.label}</button>}
      </div>
    </div>
    {offerOpen && offer && createPortal(<WelcomeOfferDialog offer={offer} onClose={closeOffer} />, document.body)}
  </>;
}

/** Precio de lista para el catálogo y la ficha: tachado cuando hay descuento y el producto se puede comprar. */
export function CatalogSalePrice({ list, current }: { list: string; current: string | null }) {
  return current === null ? <>{list}</> : <SalePrice list={list} current={current} />;
}
