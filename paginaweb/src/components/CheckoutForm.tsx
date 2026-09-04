"use client";

import { GlobeHemisphereWest, MapPin, WhatsappLogo } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/types/catalog";

type Rate = { id: string; name: string; rate_minor: number; is_pickup: boolean; departments: string[] };
type CustomerForm = { fullName: string; phone: string; department: string; address: string };
type InitialDestination = { international: boolean; country: string; city: string };
type PurchaseRegion = "uruguay" | "international";

const departments = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];
export function CheckoutForm({ initialCustomer, initialDestination = { international: false, country: "", city: "" } }: { initialCustomer: CustomerForm; initialDestination?: InitialDestination }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("checkout");
  const [purchaseRegion, setPurchaseRegion] = useState<PurchaseRegion>(initialDestination.international ? "international" : "uruguay");
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateId, setRateId] = useState("");
  const [form, setForm] = useState(initialCustomer);
  const [international, setInternational] = useState({ country: initialDestination.country, city: initialDestination.city });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rate = useMemo(() => rates.find((item) => item.id === rateId), [rates, rateId]);

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const response = await fetch("/api/shipping-rates", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(t("ratesLoadFailed"));
      const nextRates = Array.isArray(value.rates) ? value.rates as Rate[] : [];
      if (!nextRates.length) throw new Error(t("noRates"));
      setRates(nextRates);
      setRateId((current) => nextRates.some((item) => item.id === current) ? current : nextRates[0].id);
    } catch (reason) {
      setRates([]);
      setRateId("");
      setRatesError(reason instanceof Error ? reason.message : t("ratesLoadFailed"));
    } finally {
      setRatesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRates(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRates]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateInternational = (key: keyof typeof international, value: string) => setInternational((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (purchaseRegion === "international") {
        const storedKey = sessionStorage.getItem("matearte_international_order_idempotency");
        const idempotencyKey = storedKey || crypto.randomUUID();
        sessionStorage.setItem("matearte_international_order_idempotency", idempotencyKey);
        const response = await fetch("/api/orders/international", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ customer: form, destination: international, locale }),
        });
        const value = await response.json();
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
      const value = await response.json();
      if (!response.ok) throw new Error(t("paymentStartFailed"));
      window.location.assign(value.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("continueFailed"));
      setBusy(false);
    }
  };

  const internationalReady = Boolean(international.country.trim());
  const domesticReady = Boolean(rateId) && !ratesLoading;

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <fieldset>
          <legend className="display-font text-3xl">{t("customerData")}</legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">{t("fullName")}<input name="name" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
            <label className="text-sm font-medium">{t("phone")}<input name="tel" type="tel" inputMode="tel" autoComplete="tel" required maxLength={40} value={form.phone} onChange={(event) => update("phone", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="display-font text-3xl">{t("destinationLegend")}</legend>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className={`flex min-h-20 cursor-pointer items-center gap-4 border p-4 transition-colors ${purchaseRegion === "uruguay" ? "border-[var(--leather)] bg-[var(--cream-deep)]/55" : "border-black/15"}`}>
              <input type="radio" name="purchase-region" checked={purchaseRegion === "uruguay"} onChange={() => setPurchaseRegion("uruguay")} />
              <MapPin size={23} className="shrink-0 text-[var(--leather)]" aria-hidden="true" />
              <span><strong className="block text-sm">{t("uruguay")}</strong><span className="mt-1 block text-xs text-black/55">{t("domesticOption")}</span></span>
            </label>
            <label className={`flex min-h-20 cursor-pointer items-center gap-4 border p-4 transition-colors ${purchaseRegion === "international" ? "border-[var(--leather)] bg-[var(--cream-deep)]/55" : "border-black/15"}`}>
              <input type="radio" name="purchase-region" checked={purchaseRegion === "international"} onChange={() => setPurchaseRegion("international")} />
              <GlobeHemisphereWest size={23} className="shrink-0 text-[var(--leather)]" aria-hidden="true" />
              <span><strong className="block text-sm">{t("abroad")}</strong><span className="mt-1 block text-xs text-black/55">{t("internationalOption")}</span></span>
            </label>
          </div>
        </fieldset>

        {purchaseRegion === "uruguay" ? (
          <fieldset>
            <legend className="display-font text-3xl">{t("delivery")}</legend>
            {ratesLoading && <p role="status" className="mt-5 text-sm text-black/60">{t("loadingRates")}</p>}
            {ratesError && <div role="alert" className="mt-5 border border-red-700/30 p-4 text-sm text-red-800"><p>{ratesError}</p><button type="button" onClick={() => void loadRates()} className="mt-3 min-h-11 border border-red-800 px-4 font-semibold">{t("retry")}</button></div>}
            <div className="mt-5 space-y-3">
              {rates.map((item) => <label key={item.id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border border-black/15 p-4"><span><input type="radio" name="rate" required checked={rateId === item.id} onChange={() => setRateId(item.id)} className="mr-3" />{item.is_pickup ? t("shippingPickup") : t("shippingDelivery")}</span><strong>{item.rate_minor ? formatMoney(item.rate_minor) : t("free")}</strong></label>)}
            </div>
            {rate && !rate.is_pickup && <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">{t("department")}<select name="address-level1" autoComplete="address-level1" required value={form.department} onChange={(event) => update("department", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4"><option value="">{t("choose")}</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-sm font-medium">{t("address")}<input name="street-address" autoComplete="street-address" required maxLength={240} value={form.address} onChange={(event) => update("address", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label></div>}
          </fieldset>
        ) : (
          <fieldset className="border border-[var(--leather)]/30 bg-[var(--paper)] p-5 sm:p-6">
            <legend className="px-2 text-sm font-bold tracking-[0.12em] text-[var(--leather)] uppercase">{t("internationalPurchase")}</legend>
            <p className="text-sm leading-7 text-black/65">{t("internationalBody")}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">{t("country")}<input name="country-name" autoComplete="country-name" required maxLength={100} value={international.country} onChange={(event) => updateInternational("country", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
              <label className="text-sm font-medium">{t("city")} <span className="font-normal text-black/45">({t("optional")})</span><input name="address-level2" autoComplete="address-level2" maxLength={100} value={international.city} onChange={(event) => updateInternational("city", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
            </div>
          </fieldset>
        )}
      </div>

      <aside className="h-fit bg-[var(--paper)] p-6">
        {purchaseRegion === "uruguay" ? (
          <>
            <p className="eyebrow">{t("securePayment")}</p>
            <h2 className="display-font mt-4 text-3xl">Mercado Pago</h2>
            <p className="mt-4 text-sm leading-6 text-black/60">{t("serverRecalc")}</p>
          </>
        ) : (
          <>
            <WhatsappLogo size={29} weight="fill" className="text-[var(--whatsapp)]" aria-hidden="true" />
            <p className="eyebrow mt-4">{t("personalAttention")}</p>
            <h2 className="display-font mt-4 text-3xl">{t("coordinateWhatsapp")}</h2>
            <p className="mt-4 text-sm leading-6 text-black/60">{t("whatsappSummary")}</p>
          </>
        )}
        {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
        <button disabled={busy || (purchaseRegion === "uruguay" ? !domesticReady : !internationalReady)} className={`mt-6 min-h-12 w-full px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${purchaseRegion === "international" ? "bg-[var(--whatsapp)]" : "bg-[var(--walnut)]"}`}>
          {busy ? t("preparing") : purchaseRegion === "international" ? t("coordinateAction") : t("mercadoPagoAction")}
        </button>
        {purchaseRegion === "international" && <p className="mt-4 text-center text-[0.7rem] leading-5 text-black/45">{t("internationalNotice")}</p>}
      </aside>
    </form>
  );
}
