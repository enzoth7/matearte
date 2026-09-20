"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CheckCircle, Clock, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { Link } from "@/i18n/navigation";
import { localizeCatalogSnapshotTitle } from "@/content/catalog-localization";
import { formatOrderMoney } from "@/lib/order-money";
import type { Locale } from "@/types/catalog";

type Snapshot = Record<string, unknown> | null;
type OrderItem = {
  id: string;
  item_type: "catalog" | "design";
  title: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  image_url: string | null;
};
type OrderValue = {
  id: string;
  order_number: number;
  status: string;
  shipping_method: string;
  shipping_snapshot: Snapshot;
  shipping_carrier: string | null;
  tracking_code: string | null;
  shipped_at: string | null;
  customer_snapshot: Snapshot;
  items_subtotal_minor: number;
  shipping_minor: number;
  payment_fee_minor: number;
  total_minor: number;
  currency: string;
  paypal_amount_usd_minor: number | null;
  created_at: string;
  order_items: OrderItem[];
};

const date = (value: string, locale: Locale) => new Intl.DateTimeFormat({ es: "es-UY", en: "en", pt: "pt-BR" }[locale], { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
function snapshotText(snapshot: Snapshot, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function itemCopy(item: OrderItem, locale: Locale, labels: { custom: string; catalog: string; piece: string; units: (count: number) => string }) {
  const title = item.item_type === "design" ? item.title : localizeCatalogSnapshotTitle(item.title, locale);
  const [name, ...details] = title.split(" — ");
  const baseSubtitle = details.join(" — ") || (item.item_type === "design" ? labels.custom : labels.catalog);
  return {
    name: name || labels.piece,
    subtitle: item.quantity > 1 ? `${baseSubtitle} · ${labels.units(item.quantity)}` : baseSubtitle,
  };
}

function itemImage(item: OrderItem) {
  if (item.item_type === "design") return "/assets/matearte/profile-orders-desktop/design-fallback.png";
  return item.image_url || "/assets/matearte/profile-orders-desktop/catalog-fallback.png";
}

function shippingAddress(order: OrderValue, pickup: string, toConfirm: string) {
  if (order.shipping_method === "pickup") return pickup;

  if (order.shipping_method === "international_coordination" || order.shipping_method === "international_shipping") {
    const values = [
      snapshotText(order.shipping_snapshot, "address"),
      snapshotText(order.shipping_snapshot, "city"),
      snapshotText(order.shipping_snapshot, "country"),
    ].filter(Boolean);
    return values.join(", ") || toConfirm;
  }

  const address = snapshotText(order.customer_snapshot, "address");
  const department = snapshotText(order.customer_snapshot, "department");
  const repeatedDepartment = department && address.toLocaleLowerCase("es").includes(department.toLocaleLowerCase("es"));
  return [address, repeatedDepartment ? "" : department, "UY"].filter(Boolean).join(", ") || toConfirm;
}

function orderCode(order: OrderValue) {
  const compactId = order.id?.replaceAll("-", "").slice(0, 12).toUpperCase();
  return compactId || `MA${String(order.order_number).padStart(8, "0")}`;
}

function trackingAccessToken(orderId: string) {
  const storageKey = `matearte:order-access:${orderId}`;
  const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("access") || "";
  if (/^[A-Za-z0-9_-]{43}$/.test(hashToken)) {
    try { window.sessionStorage.setItem(storageKey, hashToken); } catch { /* The fragment still works when storage is unavailable. */ }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    return hashToken;
  }
  try {
    const stored = window.sessionStorage.getItem(storageKey) || "";
    return /^[A-Za-z0-9_-]{43}$/.test(stored) ? stored : "";
  } catch {
    return "";
  }
}

export function OrderStatus({ orderId, paymentOutcome, exchangeRates }: { orderId: string; paymentOutcome?: string; exchangeRates?: Record<string, number> }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("order");
  const statusLabels: Record<string, string> = {
    pending_payment: t("statuses.pending_payment"), paid_pending_review: t("statuses.paid_pending_review"),
    ready_for_fulfillment: t("statuses.ready_for_fulfillment"), ready_for_production: t("statuses.ready_for_production"),
    shipped: t("statuses.shipped"),
    payment_failed: t("statuses.payment_failed"), cancelled: t("statuses.cancelled"),
    refunded: t("statuses.refunded"), manual_review: t("statuses.manual_review"),
  };
  const statusDescriptions: Record<string, string> = {
    pending_payment: t("descriptions.pending_payment"), paid_pending_review: t("descriptions.paid_pending_review"),
    ready_for_fulfillment: t("descriptions.ready_for_fulfillment"), ready_for_production: t("descriptions.ready_for_production"),
    shipped: t("descriptions.shipped"),
    payment_failed: t("descriptions.payment_failed"), cancelled: t("descriptions.cancelled"),
    refunded: t("descriptions.refunded"), manual_review: t("descriptions.manual_review"),
  };
  const itemLabels = { custom: t("customMate"), catalog: t("catalogProduct"), piece: t("piece"), units: (count: number) => t("units", { count }) };
  const [order, setOrder] = useState<OrderValue | null>(null);
  const [error, setError] = useState("");
  const [accessIssue, setAccessIssue] = useState<"auth" | "unavailable" | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const load = async () => {
      try {
        if (paymentOutcome === "failure") return;
        setAccessIssue(null);
        const awaiting = paymentOutcome === "success" || paymentOutcome === "pending";
        const token = trackingAccessToken(orderId);
        const response = await fetch(`/api/orders/${orderId}${awaiting ? "?awaiting=1" : ""}`, {
          cache: "no-store",
          headers: token ? { "X-MateArte-Order-Access": token } : undefined,
        });
        const value = await response.json();
        if (response.status === 202 && value.pending) {
          setError("");
          if (!stopped) timer = setTimeout(load, 3_000);
          return;
        }
        if (response.status === 401) {
          setError("");
          setAccessIssue("auth");
          return;
        }
        if (response.status === 403 || response.status === 404) {
          setError("");
          setAccessIssue("unavailable");
          return;
        }
        if (!response.ok) {
          setError(t("loadFailed"));
          return;
        }
        setError("");
        setOrder(value as OrderValue);
        if (!stopped && value.status === "pending_payment") timer = setTimeout(load, 5_000);
      } catch {
        setError(t("connectionFailed"));
      }
    };

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, paymentOutcome, retryKey, t]);

  if (paymentOutcome === "failure") {
    return (
      <div role="status" className="order-status-feedback border border-black/15 bg-[var(--paper)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <WarningCircle size={30} className="text-[var(--leather)]" aria-hidden="true" />
        <h2 className="display-font mt-4 text-3xl">{t("paymentNotCompletedTitle")}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-black/60">{t("paymentNotCompletedBody")}</p>
        <Link className="button-primary mt-6" href="/carrito">{t("backToCart")}</Link>
      </div>
    );
  }

  if (accessIssue) {
    const authenticationRequired = accessIssue === "auth";
    return (
      <div role="status" className="order-status-feedback border border-black/15 bg-[var(--paper)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        {authenticationRequired
          ? <Clock size={30} className="text-[var(--leather)]" aria-hidden="true" />
          : <WarningCircle size={30} className="text-[var(--danger)]" aria-hidden="true" />}
        <h2 className="display-font mt-4 text-3xl">{authenticationRequired ? t("authRequiredTitle") : t("unavailableTitle")}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-black/60">{authenticationRequired ? t("authRequiredBody") : t("unavailableBody")}</p>
        <div className="mt-6 max-w-sm">
          <GoogleAuthButton postLoginRedirect={`/pedidos/${orderId}`} />
        </div>
        <Link className="button-secondary mt-4" href="/perfil">{t("back")}</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="order-status-feedback border border-[var(--danger)]/30 bg-[var(--paper)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <WarningCircle size={30} className="text-[var(--danger)]" aria-hidden="true" />
        <h2 className="display-font mt-4 text-3xl">{t("loadTitle")}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-black/60">{error}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="button-primary cursor-pointer" onClick={() => setRetryKey((value) => value + 1)}>{t("retry")}</button>
          <Link className="button-secondary" href="/perfil">{t("back")}</Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div role="status" aria-live="polite" className="order-status-feedback overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]">
        <div className="h-1.5 bg-[var(--leather)]" />
        <div className="grid gap-8 p-6 motion-safe:animate-pulse sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-10">
          <div>
            <div className="h-3 w-28 rounded bg-black/10" />
            <div className="mt-6 h-9 max-w-xl rounded bg-black/10" />
            <div className="mt-4 h-4 w-52 rounded bg-black/10" />
            <div className="mt-10 h-24 rounded bg-black/5" />
          </div>
          <div className="h-56 rounded bg-black/10" />
        </div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  const status = order.status;
  const isInternational = order.shipping_method === "international_coordination" || order.shipping_method === "international_shipping";
  const isPending = status === "pending_payment";
  const isProblem = ["payment_failed", "cancelled", "refunded"].includes(status);
  const StatusIcon = status === "shipped" ? CheckCircle : isInternational && status === "manual_review" ? WhatsappLogo : isPending ? Clock : isProblem ? WarningCircle : CheckCircle;
  const statusDescription = isInternational && status === "manual_review"
    ? t("internationalStatus")
    : statusDescriptions[status] || t("processingFallback");
  const desktopStatusTitle = isPending ? t("processingPayment") : statusLabels[status] || status;
  const desktopStatusDescription = isPending
    ? t("updatesAutomatically")
    : statusDescription;
  const items = order.order_items || [];
  const money = (amountMinor: number) => formatOrderMoney(order, amountMinor, locale, exchangeRates);
  const shippingDetail = order.shipping_minor > 0
    ? money(order.shipping_minor)
    : order.shipping_method === "pickup"
      ? t("pickup")
      : order.shipping_method === "international_coordination"
        ? t("toConfirm")
        : t("shippingPayOnDelivery");
  const showTracking = status === "shipped" && Boolean(order.shipping_carrier && order.tracking_code);
  const isTrackingUrl = Boolean(order.tracking_code && (order.tracking_code.startsWith("http://") || order.tracking_code.startsWith("https://")));

  return (
    <>
      <section className="order-status-mobile" aria-labelledby="order-detail-mobile-title">
        <header className="order-mobile-header">
          <h1 id="order-detail-mobile-title">{t("title")}</h1>
          <p>{t("intro")}</p>
        </header>

        <div className="order-mobile-product-section">
          <div className="order-mobile-divider" aria-hidden="true" />
          {items.length ? (
            <div className="order-mobile-items">
              {items.map((item, index) => {
                const copy = itemCopy(item, locale, itemLabels);
                return (
                  <article className="order-mobile-item" key={item.id}>
                    <div className="order-mobile-thumbnail">
                      <Image src={itemImage(item)} alt={copy.name} fill priority={index === 0} sizes="96px" />
                    </div>
                    <div className="order-mobile-item-copy">
                      <h2>{copy.name}</h2>
                      <p>{copy.subtitle}</p>
                      <span>{money(item.total_minor)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="order-mobile-empty-items">{t("itemsPending")}</div>
          )}
        </div>

        <div className="order-mobile-status-section">
          <div className="order-mobile-divider" aria-hidden="true" />
          <div className="order-mobile-status">
            <div className="order-mobile-status-icon">
              {isPending ? (
                <Image src="/assets/matearte/order-mobile/status-pending.svg" alt="" width={24} height={24} aria-hidden="true" />
              ) : (
                <StatusIcon size={24} aria-hidden="true" />
              )}
            </div>
            <div className="order-mobile-status-copy">
              <h2>{desktopStatusTitle}</h2>
              <p>{desktopStatusDescription}</p>
            </div>
          </div>
        </div>

        <aside className="order-mobile-summary" aria-label={t("summary")}>
          <div className="order-mobile-summary-heading">
            <span aria-hidden="true" />
            <p>{t("summary")}</p>
          </div>
          <dl className="order-mobile-summary-list">
            <div><dt>{t("productsTotal")}</dt><dd>{money(order.items_subtotal_minor)}</dd></div>
            <div><dt>{t("shippingDetail")}</dt><dd>{shippingDetail}</dd></div>
            {order.payment_fee_minor > 0 && <div><dt>{t("paymentFee")}</dt><dd>{money(order.payment_fee_minor)}</dd></div>}
            <div className="order-summary-purchase-total"><dt>{t("purchaseTotal")}</dt><dd>{money(order.total_minor)}</dd></div>
            <div><dt>{t("purchaseDate")}</dt><dd>{date(order.created_at, locale)}</dd></div>
            <div className="order-mobile-summary-tall"><dt>{t("shippingAddress")}</dt><dd>{shippingAddress(order, t("pickup"), t("toConfirm"))}</dd></div>
            {showTracking&&<><div><dt>{t("shippingCarrier")}</dt><dd>{order.shipping_carrier}</dd></div><div><dt>{t("trackingCode")}</dt><dd>{isTrackingUrl ? <a href={order.tracking_code!} target="_blank" rel="noreferrer" className="underline hover:opacity-80">{order.tracking_code}</a> : order.tracking_code}</dd></div></>}
            <div><dt>{t("purchaseCode")}</dt><dd>{orderCode(order)}</dd></div>
          </dl>
          <div className="order-mobile-summary-divider" aria-hidden="true" />
          <Link className="order-mobile-back" href="/perfil">{t("back")}</Link>
        </aside>
      </section>

      <section className="order-status-desktop" aria-labelledby="order-status-desktop-title">
        <div className="order-desktop-selection">
          <div className="order-desktop-selection-divider" aria-hidden="true" />
          {items.length ? (
            <div className="order-desktop-items">
              {items.map((item, index) => {
                const copy = itemCopy(item, locale, itemLabels);
                return (
                  <article className="order-desktop-item" key={item.id}>
                    <div className="order-desktop-thumbnail">
                      <Image src={itemImage(item)} alt={copy.name} fill priority={index === 0} sizes="120px" />
                    </div>
                    <div className="order-desktop-item-copy">
                      <h2>{copy.name}</h2>
                      <p>{copy.subtitle}</p>
                      <span>{money(item.total_minor)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="order-desktop-empty-items">{t("itemsPending")}</div>
          )}
          <div className="order-desktop-status-divider" aria-hidden="true" />
          <div className="order-desktop-status">
            <div className="order-desktop-status-icon">
              {isPending ? (
                <Image src="/assets/matearte/order-desktop/status-pending.svg" alt="" width={24} height={24} aria-hidden="true" />
              ) : (
                <StatusIcon size={24} aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="order-status-desktop-title">{desktopStatusTitle}</h2>
              <p>{desktopStatusDescription}</p>
            </div>
          </div>
        </div>

        <aside className="order-desktop-summary" aria-label={t("summary")}>
          <div className="order-desktop-summary-heading">
            <span aria-hidden="true" />
            <p>{t("summary")}</p>
          </div>
          <dl className="order-desktop-summary-list">
            <div><dt>{t("productsTotal")}</dt><dd>{money(order.items_subtotal_minor)}</dd></div>
            <div><dt>{t("shippingDetail")}</dt><dd>{shippingDetail}</dd></div>
            {order.payment_fee_minor > 0 && <div><dt>{t("paymentFee")}</dt><dd>{money(order.payment_fee_minor)}</dd></div>}
            <div className="order-summary-purchase-total"><dt>{t("purchaseTotal")}</dt><dd>{money(order.total_minor)}</dd></div>
            <div><dt>{t("purchaseDate")}</dt><dd>{date(order.created_at, locale)}</dd></div>
            <div><dt>{t("shippingAddress")}</dt><dd title={shippingAddress(order, t("pickup"), t("toConfirm"))}>{shippingAddress(order, t("pickup"), t("toConfirm"))}</dd></div>
            {showTracking&&<><div><dt>{t("shippingCarrier")}</dt><dd>{order.shipping_carrier}</dd></div><div><dt>{t("trackingCode")}</dt><dd title={order.tracking_code||undefined}>{isTrackingUrl ? <a href={order.tracking_code!} target="_blank" rel="noreferrer" className="underline hover:opacity-80">{order.tracking_code}</a> : order.tracking_code}</dd></div></>}
            <div><dt>{t("purchaseCode")}</dt><dd>{orderCode(order)}</dd></div>
          </dl>
          <div className="order-desktop-summary-divider" aria-hidden="true" />
          <Link className="order-desktop-back" href="/perfil">{t("back")}</Link>
        </aside>
      </section>
    </>
  );
}
