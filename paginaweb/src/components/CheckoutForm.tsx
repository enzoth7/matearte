"use client";

import { Check, GlobeHemisphereWest, MapPin, WhatsappLogo } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { formatMoney } from "@/lib/money";
import { countryOptionsForLocale, countryRegions, countryName } from "@/lib/countries";
import type { Locale } from "@/types/catalog";

type Rate = { id: string; name: string; rate_minor: number; is_pickup: boolean; departments: string[] };
type CustomerForm = { fullName: string; phone: string; department: string; city: string; address: string };
type InitialDestination = { international: boolean; country: string; city: string };
type PurchaseRegion = "uruguay" | "international";
type CartItem = { quantity: number; unit_price_minor: number };

const departments = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];

function MoneyValue({ amount, locale, exchangeRates }: { amount: number | null, locale: string, exchangeRates?: Record<string, number> }) {
  return <span>{amount === null ? "—" : formatMoney(amount, "UYU", locale, exchangeRates)}</span>;
}

export function CheckoutForm({ initialCustomer, initialDestination = { international: false, country: "", city: "" }, exchangeRates }: { initialCustomer: CustomerForm; initialDestination?: InitialDestination, exchangeRates?: Record<string, number> }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const [purchaseRegion, setPurchaseRegion] = useState<PurchaseRegion>(initialDestination.international ? "international" : "uruguay");
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateId, setRateId] = useState("");
  const [form, setForm] = useState(initialCustomer);
  const [international, setInternational] = useState({ country: initialDestination.country, city: initialDestination.city });
  const [subtotalMinor, setSubtotalMinor] = useState<number | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rate = useMemo(() => rates.find((item) => item.id === rateId), [rates, rateId]);
  const isDelivery = Boolean(rate && !rate.is_pickup);
  const isInternational = isDelivery && purchaseRegion === "international";
  const shippingMinor = rate ? rate.rate_minor : null;
  const totalMinor = subtotalMinor === null || shippingMinor === null ? null : subtotalMinor + shippingMinor;

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const response = await fetch("/api/shipping-rates", { cache: "no-store" });
      const text = await response.text();
      const value = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(t("ratesLoadFailed"));
      const nextRates = Array.isArray(value.rates) ? value.rates as Rate[] : [];
      if (!nextRates.length) throw new Error(t("noRates"));
      setRates(nextRates);
      setRateId((current) => nextRates.some((item) => item.id === current) ? current : "");
    } catch (reason) {
      setRates([]);
      setRateId("");
      setRatesError(reason instanceof Error ? reason.message : t("ratesLoadFailed"));
    } finally {
      setRatesLoading(false);
    }
  }, [t]);

  const loadSubtotal = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const text = await response.text();
      if (!text || !response.ok) return;
      const value = JSON.parse(text);
      if (!Array.isArray(value.items)) return;
      const items = value.items as CartItem[];
      setSubtotalMinor(items.reduce((total, item) => total + Number(item.unit_price_minor || 0) * Number(item.quantity || 0), 0));
    } catch {
      setSubtotalMinor(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRates();
      void loadSubtotal();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRates, loadSubtotal]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateInternational = (key: keyof typeof international, value: string) => setInternational((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isInternational) {
        const storedKey = sessionStorage.getItem("matearte_international_order_idempotency");
        const idempotencyKey = storedKey || crypto.randomUUID();
        sessionStorage.setItem("matearte_international_order_idempotency", idempotencyKey);
        const response = await fetch("/api/orders/international", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ customer: form, destination: { ...international, country: countryName(international.country, locale), department: form.department, address: form.address }, locale }),
        });
        const text = await response.text();
        const value = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(t("prepareMessageFailed"));
        if (typeof value.whatsappUrl !== "string" || !value.whatsappUrl.startsWith("https://wa.me/")) throw new Error(t("unsafeWhatsapp"));
        sessionStorage.removeItem("matearte_international_order_idempotency");
        window.location.assign(value.whatsappUrl);
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem("matearte_checkout_idempotency", idempotencyKey);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ shippingRateId: rateId, customer: form, locale }),
      });
      const text = await response.text();
      const value = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(t("paymentStartFailed"));
      window.location.assign(value.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("continueFailed"));
      setBusy(false);
    }
  };

  const internationalReady = Boolean(rateId) && Boolean(international.country.trim());
  const domesticReady = Boolean(rateId) && !ratesLoading;

  // Campo class — igual al Figma: borde sutil, sin border-radius exagerado
  const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-[#b8a88a]/60 bg-transparent px-4 text-[15px] text-[var(--walnut)] outline-none transition focus:border-[var(--leather)] focus:ring-2 focus:ring-[var(--rawhide)]/30";

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--paper)] shadow-[var(--shadow-soft)]">
      {/* ── Header — dentro del card, con borde inferior ── */}
      <header className="border-b border-black/[0.07] px-8 py-9 sm:px-10">
        <h1 className="display-font text-5xl font-medium leading-none tracking-tight text-[var(--walnut)] sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-black/55">
          {t("intro")}
        </p>
      </header>

      {/* ── Form grid: columna izquierda + sidebar ── */}
      <form
        onSubmit={submit}
        className="lg:grid lg:grid-cols-[1fr_22rem]"
      >
        {/* ── Columna izquierda — formulario ── */}
        <div className="space-y-6 p-8 sm:p-10">

          {/* Nombre + Teléfono */}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[var(--walnut)]">
              {t("fullName")}
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={120}
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold text-[var(--walnut)]">
              {t("phone")}
              <input
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                maxLength={40}
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          {/* Modalidad de entrega */}
          <fieldset>
            <legend className="sr-only">{t("delivery")}</legend>
            {ratesLoading && <p role="status" className="text-sm text-black/55">{t("loadingRates")}</p>}
            {ratesError && (
              <div role="alert" className="rounded-xl border border-red-700/25 bg-red-50 p-4 text-sm text-red-800">
                <p>{ratesError}</p>
                <button type="button" onClick={() => void loadRates()} className="mt-3 min-h-10 border border-red-800 px-4 font-semibold">{t("retry")}</button>
              </div>
            )}
            {!ratesLoading && !ratesError && (
              <div className="grid gap-3 sm:grid-cols-2">
                {rates.map((item) => (
                  <label
                    key={item.id}
                    className={`relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition focus-within:ring-2 focus-within:ring-[var(--rawhide)]/50 ${rateId === item.id ? "border-[#6b7a4a] bg-[#6b7a4a] text-[var(--paper)]" : "border-[#6b7a4a]/30 bg-[var(--cream)] text-[var(--walnut)]"}`}
                  >
                    <input type="radio" name="rate" required checked={rateId === item.id} onChange={() => setRateId(item.id)} className="sr-only" />
                    {rateId === item.id && <Check size={18} weight="bold" className="absolute top-3 right-3" aria-hidden="true" />}
                    <strong className="text-sm">{item.is_pickup ? t("pickupAtStore") : t("homeDelivery")}</strong>
                    <span className={`text-sm font-medium ${rateId === item.id ? "text-white/90" : "text-black/55"}`}>
                      {item.is_pickup ? t("free") : item.rate_minor ? formatMoney(item.rate_minor, "UYU", locale, exchangeRates) : tCart("toCalculate")}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {/* El destino sólo aplica al envío a domicilio. */}
          {isDelivery && <fieldset>
            <legend className="sr-only">{t("destinationLegend")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-5 py-4 text-left transition focus-within:ring-2 focus-within:ring-[var(--rawhide)]/50 ${purchaseRegion === "uruguay" ? "border-[var(--walnut)] bg-[var(--walnut)] text-[var(--paper)]" : "border-[var(--walnut)]/25 bg-[var(--paper)] text-[var(--walnut)]"}`}>
                <input type="radio" name="purchase-region" checked={purchaseRegion === "uruguay"} onChange={() => setPurchaseRegion("uruguay")} className="sr-only" />
                {purchaseRegion === "uruguay" && <Check size={16} weight="bold" className="absolute top-3 right-3 opacity-70" aria-hidden="true" />}
                <MapPin size={20} className="shrink-0" aria-hidden="true" />
                <span>
                  <strong className="block text-sm">{t("uruguay")}</strong>
                  <span className={`mt-0.5 block text-xs ${purchaseRegion === "uruguay" ? "text-white/65" : "text-black/50"}`}>{t("domesticOption")}</span>
                </span>
              </label>
              <label className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-5 py-4 text-left transition focus-within:ring-2 focus-within:ring-[var(--rawhide)]/50 ${purchaseRegion === "international" ? "border-[var(--walnut)] bg-[var(--walnut)] text-[var(--paper)]" : "border-[var(--walnut)]/25 bg-[var(--paper)] text-[var(--walnut)]"}`}>
                <input type="radio" name="purchase-region" checked={purchaseRegion === "international"} onChange={() => setPurchaseRegion("international")} className="sr-only" />
                {purchaseRegion === "international" && <Check size={16} weight="bold" className="absolute top-3 right-3 opacity-70" aria-hidden="true" />}
                <GlobeHemisphereWest size={20} className="shrink-0" aria-hidden="true" />
                <span>
                  <strong className="block text-sm">{t("abroad")}</strong>
                  <span className={`mt-0.5 block text-xs ${purchaseRegion === "international" ? "text-white/65" : "text-black/50"}`}>{t("internationalOption")}</span>
                </span>
              </label>
            </div>
          </fieldset>}

          {/* Campos de dirección — según el destino del envío */}
          {isDelivery && (purchaseRegion === "uruguay" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[var(--walnut)]">
                  {t("department")}
                  <select name="address-level1" autoComplete="address-level1" required value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass}>
                    <option value="">{t("choose")}</option>
                    {departments.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[var(--walnut)]">
                  {t("city")}
                  <input name="address-level2" autoComplete="address-level2" required maxLength={100} value={form.city} onChange={(event) => update("city", event.target.value)} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-[var(--walnut)]">
                  {t("address")}
                  <input name="street-address" autoComplete="street-address" required maxLength={240} value={form.address} onChange={(event) => update("address", event.target.value)} className={fieldClass} />
                </label>
              </div>
          ) : (
            /* Exterior: país, departamento/estado, ciudad y dirección. */
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[var(--walnut)]">
                {t("country")}
                <select name="country-name" autoComplete="country-name" required value={international.country} onChange={(event) => { updateInternational("country", event.target.value); update("department", ""); }} className={fieldClass}>
                  <option value="">{t("choose")}</option>
                  {countryOptionsForLocale(locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--walnut)]">
                {t("state")}
                {countryRegions(international.country).length > 0 ? (
                  <select name="address-level1" autoComplete="address-level1" value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass}>
                    <option value="">{t("choose")}</option>
                    {countryRegions(international.country).map((r) => <option key={r.code} value={r.name}>{r.name}</option>)}
                  </select>
                ) : (
                  <input name="address-level1" autoComplete="address-level1" maxLength={80} value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass} />
                )}
              </label>
              <label className="text-sm font-semibold text-[var(--walnut)]">
                {t("city")}
                <input name="address-level2" autoComplete="address-level2" maxLength={100} value={international.city} onChange={(event) => updateInternational("city", event.target.value)} className={fieldClass} />
              </label>
              <label className="text-sm font-semibold text-[var(--walnut)]">
                {t("address")}
                <input name="street-address" autoComplete="street-address" maxLength={240} value={form.address} onChange={(event) => update("address", event.target.value)} className={fieldClass} />
              </label>
            </div>
          ))}
        </div>

        {/* ── Sidebar derecha — resumen o WhatsApp ── */}
        <aside className="flex flex-col bg-[#908c76] p-7 text-[var(--paper)] sm:p-8 lg:p-10">
          {!isInternational ? (
            <>
              <p className="eyebrow text-[0.65rem] text-[var(--paper)] opacity-80 before:w-5">{tCart("summary")}</p>
              <dl className="mt-6 grow space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-white/75">{tCart("subtotal")}</dt>
                  <dd className="font-semibold"><MoneyValue amount={subtotalMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-white/75">{tCart("shipping")}</dt>
                  <dd className="font-semibold"><MoneyValue amount={shippingMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
                </div>
                <div className="border-t border-white/25 pt-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-semibold">{tCart("total")}</dt>
                    <dd className="text-2xl font-bold"><MoneyValue amount={totalMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
                  </div>
                </div>
              </dl>
              <p className="mt-5 text-xs leading-5 text-white/60">{t("serverRecalc")}</p>
            </>
          ) : (
            <>
              <WhatsappLogo size={30} weight="fill" className="text-[var(--paper)]" aria-hidden="true" />
              <p className="eyebrow mt-6 text-[0.65rem] text-[var(--paper)] opacity-80 before:w-5">{t("personalAttention")}</p>
              <h2 className="display-font mt-4 grow text-2xl leading-tight">{t("coordinateWhatsapp")}</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">{t("whatsappSummary")}</p>
            </>
          )}

          {error && <p role="alert" className="mt-5 text-sm font-semibold text-[var(--paper)]">{error}</p>}

          <button
            disabled={busy || (isInternational ? !internationalReady : !domesticReady)}
            className="mt-8 flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--walnut)] px-6 text-sm font-bold text-[var(--paper)] transition hover:bg-[#4a2a1c] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isInternational && !busy && (
              <Image
                src="/assets/matearte/01-marca/mercado-pago.png"
                alt=""
                width={28}
                height={20}
                className="shrink-0 object-contain"
                aria-hidden="true"
              />
            )}
            {busy ? t("preparing") : isInternational ? t("contactUs") : t("mercadoPagoAction")}
          </button>

          {isInternational && (
            <p className="mt-4 text-center text-[0.7rem] leading-5 text-white/60">{t("internationalNotice")}</p>
          )}
        </aside>
      </form>
    </div>
  );
}
