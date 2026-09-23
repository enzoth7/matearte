"use client";

import { Bank, Check, GlobeHemisphereWest, MapPin, UploadSimple } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { PayPalCheckoutSection } from '@/components/PayPalCheckoutSection';
import { localizeCanonicalPath } from '@/i18n/paths';
import { formatMoney } from "@/lib/money";
import { countryCallingCode, countryOptionsForLocale, countryPhoneOptionsForLocale, countryRegions, countryName, internationalPhoneNumber, localPhoneNumber, parsePhoneNumber } from "@/lib/countries";
import { getInternationalShippingRate, DEFAULT_INTERNATIONAL_SHIPPING_RATES, type InternationalShippingRow } from "@/lib/international-shipping";
import type { Locale } from "@/types/catalog";

type Rate = { id: string; name: string; rate_minor: number; is_pickup: boolean; departments: string[] };
type CustomerForm = { fullName: string; phone: string; department: string; city: string; address: string };
type InitialDestination = { international: boolean; country: string; city: string };
type PurchaseRegion = "uruguay" | "international";
type CartItem = { quantity: number; unit_price_minor: number };
type WholesaleState = { eligible: boolean; mate_quantity: number; threshold: number; discount_percent: number; savings_minor: number; checkout_mode: string };
type BankTransferDetails = { account_holder: string; transfer_account: string; cash_deposit_account: string; cash_deposit_label: string };
type AppliedDiscount = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountMinor: number;
  itemsSubtotalMinor: number;
  discountedItemsSubtotalMinor: number;
};

const departments = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];
const receiptTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const discountErrorTranslationKeys = {
  not_found: "discountErrors.not_found",
  disabled: "discountErrors.disabled",
  not_started: "discountErrors.not_started",
  expired: "discountErrors.expired",
  already_used: "discountErrors.already_used",
  in_use: "discountErrors.in_use",
  not_applicable: "discountErrors.not_applicable",
  invalid: "discountErrors.invalid",
} as const;

function MoneyValue({ amount, locale, exchangeRates }: { amount: number | null, locale: string, exchangeRates?: Record<string, number> }) {
  return <span>{amount === null ? "—" : formatMoney(amount, "UYU", locale, exchangeRates)}</span>;
}

export function CheckoutForm({
  initialCustomer,
  initialDestination = { international: false, country: "", city: "" },
  exchangeRates,
  initialPhoneCountryOptions,
  initialCountryOptions,
}: {
  initialCustomer: CustomerForm;
  initialDestination?: InitialDestination;
  exchangeRates?: Record<string, number>;
  initialPhoneCountryOptions?: ReturnType<typeof countryPhoneOptionsForLocale>;
  initialCountryOptions?: ReturnType<typeof countryOptionsForLocale>;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const phoneCountryOptions = useMemo(
    () => initialPhoneCountryOptions || countryPhoneOptionsForLocale(locale),
    [initialPhoneCountryOptions, locale]
  );
  const destinationCountryOptions = useMemo(
    () => initialCountryOptions || countryOptionsForLocale(locale),
    [initialCountryOptions, locale]
  );
  const [purchaseRegion, setPurchaseRegion] = useState<PurchaseRegion>(initialDestination.international ? "international" : "uruguay");
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateId, setRateId] = useState("");
  const [parsedPhone] = useState(() => parsePhoneNumber(initialCustomer.phone, "UY"));
  const [phoneCountry, setPhoneCountry] = useState(parsedPhone.phoneCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(parsedPhone.localNumber);
  const [form, setForm] = useState(() => ({
    ...initialCustomer,
    phone: parsedPhone.localNumber
      ? internationalPhoneNumber(parsedPhone.phoneCountryCode, parsedPhone.localNumber)
      : initialCustomer.phone,
  }));
  const [international, setInternational] = useState({ country: initialDestination.country, city: initialDestination.city });
  const [internationalRates, setInternationalRates] = useState<InternationalShippingRow[]>(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
  const [cartWeightGrams, setCartWeightGrams] = useState<number>(0);
  const [subtotalMinor, setSubtotalMinor] = useState<number | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [wholesale, setWholesale] = useState<WholesaleState | null>(null);
  const [bankTransfer, setBankTransfer] = useState<BankTransferDetails | null>(null);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [paypalAmountUsd, setPaypalAmountUsd] = useState('');
  const [error, setError] = useState("");
  const [cartError, setCartError] = useState("");
  const rate = useMemo(() => rates.find((item) => item.id === rateId), [rates, rateId]);
  const isDelivery = Boolean(rate && !rate.is_pickup);
  const isWholesale = Boolean(wholesale?.eligible);
  const isInternational = !isWholesale && isDelivery && purchaseRegion === "international";

  const internationalShippingCalc = useMemo(() => {
    if (!isInternational || !international.country) return null;
    return getInternationalShippingRate(
      cartWeightGrams,
      international.country,
      internationalRates.length ? internationalRates : DEFAULT_INTERNATIONAL_SHIPPING_RATES
    );
  }, [isInternational, international.country, cartWeightGrams, internationalRates]);

  const internationalShippingMinor = useMemo(() => {
    if (!internationalShippingCalc) return null;
    return Math.round(internationalShippingCalc.rate * 100);
  }, [internationalShippingCalc]);

  const shippingMinor = isInternational
    ? internationalShippingMinor
    : (rate ? 0 : null);

  const discountMinor = appliedDiscount?.discountMinor || 0;
  const totalMinor = subtotalMinor === null
    ? null
    : isInternational
      ? (internationalShippingMinor === null ? null : subtotalMinor - discountMinor + internationalShippingMinor)
      : (shippingMinor === null ? null : subtotalMinor - discountMinor + shippingMinor);

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
      if (Array.isArray(value.internationalRates) && value.internationalRates.length > 0) {
        setInternationalRates(value.internationalRates as InternationalShippingRow[]);
      }
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
    setCartError("");
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const text = await response.text();
      if (!text || !response.ok) throw new Error(tCart("loadFailed"));
      const value = JSON.parse(text);
      if (typeof value.total_weight_grams === "number") {
        setCartWeightGrams(value.total_weight_grams);
      }
      if (!Array.isArray(value.items)) return;
      const nextWholesale = value.wholesale && typeof value.wholesale === "object" ? value.wholesale as WholesaleState : null;
      const nextBankTransfer = value.bank_transfer && typeof value.bank_transfer === "object" ? value.bank_transfer as BankTransferDetails : null;
      setWholesale(nextWholesale);
      setBankTransfer(nextBankTransfer);
      if (nextWholesale?.eligible && !nextBankTransfer) setCartError(t("bankTransferUnavailable"));
      const items = value.items as CartItem[];
      setSubtotalMinor(items.reduce((total, item) => total + Number(item.unit_price_minor || 0) * Number(item.quantity || 0), 0));
    } catch (reason) {
      setSubtotalMinor(null);
      setWholesale(null);
      setBankTransfer(null);
      setCartError(reason instanceof Error ? reason.message : tCart("loadFailed"));
    }
  }, [t, tCart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRates();
      void loadSubtotal();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRates, loadSubtotal]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateInternational = (key: keyof typeof international, value: string) => setInternational((current) => ({ ...current, [key]: value }));

  const callingCode = countryCallingCode(phoneCountry);

  const updatePhoneCountry = (countryCode: string) => {
    setPhoneCountry(countryCode);
    const fullPhone = internationalPhoneNumber(countryCode, phoneNumber);
    setForm((current) => ({ ...current, phone: fullPhone }));
  };

  const updatePhone = (value: string) => {
    const localNumber = localPhoneNumber(value, phoneCountry);
    setPhoneNumber(localNumber);
    const fullPhone = internationalPhoneNumber(phoneCountry, localNumber);
    setForm((current) => ({ ...current, phone: fullPhone }));
  };

  const validateDiscount = async () => {
    setDiscountBusy(true);
    setDiscountError("");
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCode }),
      });
      const text = await response.text();
      const value = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const reason = typeof value?.details?.reason === "string" ? value.details.reason : "invalid";
        const translationKey = discountErrorTranslationKeys[reason as keyof typeof discountErrorTranslationKeys] || "discountErrors.invalid";
        throw new Error(t(translationKey));
      }
      const next = value as AppliedDiscount;
      if (!next.code || !Number.isSafeInteger(next.discountMinor) || next.discountMinor <= 0) {
        throw new Error(t("discountErrors.invalid"));
      }
      setDiscountCode(next.code);
      setAppliedDiscount(next);
    } catch (reason) {
      setAppliedDiscount(null);
      setDiscountError(reason instanceof Error ? reason.message : t("discountErrors.invalid"));
    } finally {
      setDiscountBusy(false);
    }
  };

  const responseError = (value: Record<string, unknown>, fallback: string) => {
    const details = value.details && typeof value.details === "object" ? value.details as Record<string, unknown> : null;
    const reason = typeof details?.reason === "string" ? details.reason : "";
    const translationKey = discountErrorTranslationKeys[reason as keyof typeof discountErrorTranslationKeys];
    return translationKey ? t(translationKey) : (typeof value.error === "string" ? value.error : fallback);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fullPhone = internationalPhoneNumber(phoneCountry, phoneNumber);
    const customerPayload = { ...form, phone: fullPhone };
    setForm((current) => ({ ...current, phone: fullPhone }));
    try {
      if (isWholesale) {
        if (!bankTransfer || !cartReady) throw new Error(t("bankTransferUnavailable"));
        if (!receipt) throw new Error(t("receiptRequired"));
        const storedKey = sessionStorage.getItem("matearte_bank_transfer_idempotency");
        const idempotencyKey = storedKey || crypto.randomUUID();
        sessionStorage.setItem("matearte_bank_transfer_idempotency", idempotencyKey);
        const payload = new FormData();
        payload.set("shippingRateId", rateId);
        payload.set("customer", JSON.stringify(customerPayload));
        payload.set("locale", locale);
        payload.set("receipt", receipt);
        const response = await fetch("/api/checkout/bank-transfer", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: payload,
        });
        const text = await response.text();
        const value = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(value.error || t("bankTransferFailed"));
        sessionStorage.removeItem("matearte_bank_transfer_idempotency");
        window.location.assign(localizeCanonicalPath(`/pedidos/${value.orderId}`, locale));
        return;
      }
      if (isInternational) {
        // PayPal flow (único método internacional)
        const storedKey = sessionStorage.getItem("matearte_paypal_order_idempotency");
        const idempotencyKey = storedKey || crypto.randomUUID();
        sessionStorage.setItem("matearte_paypal_order_idempotency", idempotencyKey);
        const response = await fetch("/api/checkout/paypal", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
            body: JSON.stringify({
              customer: customerPayload,
              destination: { ...international, country: countryName(international.country, locale), department: form.department, address: form.address },
              locale,
              discountCode: appliedDiscount?.code,
            }),
        });
        const text = await response.text();
        const value = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(responseError(value, t("paymentStartFailed")));
        setPaypalOrderId(value.orderId);
        setPaypalAmountUsd(value.amountUsd);
        setPaypalReady(true);
        setBusy(false);
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem("matearte_checkout_idempotency", idempotencyKey);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ shippingRateId: rateId, customer: customerPayload, locale, discountCode: appliedDiscount?.code }),
      });
      const text = await response.text();
      const value = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(responseError(value, t("paymentStartFailed")));
      window.location.assign(value.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("continueFailed"));
      setBusy(false);
    }
  };

  const internationalReady = Boolean(rateId) && Boolean(international.country.trim());
  const domesticReady = Boolean(rateId) && !ratesLoading;
  const cartReady = subtotalMinor !== null && !cartError;

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
              <div className="mt-2 flex min-h-12 w-full rounded-lg border border-[#b8a88a]/60 bg-transparent transition focus-within:border-[var(--leather)] focus-within:ring-2 focus-within:ring-[var(--rawhide)]/30">
                <select
                  aria-label={t("phoneCountryAria")}
                  suppressHydrationWarning
                  value={phoneCountry}
                  onChange={(event) => updatePhoneCountry(event.target.value)}
                  className="max-w-[42%] shrink-0 rounded-l-lg border-r border-[#b8a88a]/60 bg-transparent px-2.5 text-xs text-[var(--walnut)] outline-none transition sm:max-w-[48%] sm:text-sm"
                >
                  {phoneCountryOptions.map((c) => (
                    <option key={c.code} value={c.code} suppressHydrationWarning className="bg-[#fffdf8] text-[#17130f]">
                      {c.code} ({c.callingCode}) · {c.name}
                    </option>
                  ))}
                </select>
                <input
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  maxLength={32}
                  value={phoneNumber}
                  onChange={(event) => updatePhone(event.target.value)}
                  aria-label={callingCode ? `${t("phone")}. ${callingCode}` : t("phone")}
                  className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-[15px] text-[var(--walnut)] outline-none"
                />
              </div>
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
                      {item.is_pickup ? t("free") : t("payOnDelivery")}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {/* El destino sólo aplica al envío a domicilio. */}
          {isDelivery && !isWholesale && <fieldset>
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
          {isDelivery && (isWholesale || purchaseRegion === "uruguay" ? (
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
                <select name="country-name" autoComplete="country-name" required suppressHydrationWarning value={international.country} onChange={(event) => { updateInternational("country", event.target.value); update("department", ""); }} className={fieldClass}>
                  <option value="" suppressHydrationWarning>{t("choose")}</option>
                  {destinationCountryOptions.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>)}
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
          {/* ── Resumen de compra (visible siempre) ── */}
          <p className="eyebrow text-[0.65rem] text-[var(--paper)] opacity-80 before:w-5">{tCart("summary")}</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-white/75">{tCart("subtotal")}</dt>
              <dd className="font-semibold"><MoneyValue amount={subtotalMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
            </div>
            {appliedDiscount && (
              <div className="flex items-baseline justify-between gap-4" aria-live="polite">
                <dt className="text-white/75">{t("discount")}</dt>
                <dd className="font-semibold">−<MoneyValue amount={appliedDiscount.discountMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-white/75">{tCart("shipping")}</dt>
              <dd className="font-semibold">
                {isInternational ? (
                  internationalShippingMinor !== null ? (
                    <MoneyValue amount={internationalShippingMinor} locale={locale} exchangeRates={exchangeRates} />
                  ) : "—"
                ) : (
                  rate?.is_pickup ? t("free") : t("payOnDelivery")
                )}
              </dd>
            </div>
            <div className="border-t border-white/25 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold">{tCart("total")}</dt>
                <dd className="text-2xl font-bold"><MoneyValue amount={totalMinor} locale={locale} exchangeRates={exchangeRates} /></dd>
              </div>
            </div>
          </dl>

          {!isInternational && (
            <p className="mt-5 text-xs leading-5 text-white/70">{isWholesale ? t("wholesaleServerRecalc") : t("serverRecalc")}</p>
          )}

          {isWholesale && bankTransfer && (
            <section className="mt-6 border-t border-white/25 pt-6" aria-labelledby="bank-transfer-title">
              <div className="flex items-center gap-2">
                <Bank size={22} aria-hidden="true" />
                <h2 id="bank-transfer-title" className="text-base font-bold">{t("bankTransferTitle")}</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/75">{t("bankTransferBody")}</p>
              <dl className="mt-4 space-y-3 rounded-xl border border-white/20 bg-black/10 p-4 text-sm">
                <div><dt className="text-xs text-white/65">{t("accountHolder")}</dt><dd className="mt-1 font-bold">{bankTransfer.account_holder}</dd></div>
                <div><dt className="text-xs text-white/65">{t("bankTransferAccount")}</dt><dd className="mt-1 font-bold break-words">{bankTransfer.transfer_account}</dd></div>
                <div><dt className="text-xs text-white/65">{bankTransfer.cash_deposit_label}</dt><dd className="mt-1 font-bold break-words">{bankTransfer.cash_deposit_account}</dd></div>
              </dl>

              {!transferConfirmed ? (
                <button
                  type="button"
                  disabled={!domesticReady || !bankTransfer || !cartReady}
                  onClick={() => setTransferConfirmed(true)}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-white/70 px-5 text-sm font-bold transition hover:bg-white/10 focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("transferMade")}
                </button>
              ) : (
                <div className="mt-5 rounded-xl border border-white/25 bg-white/10 p-4">
                  <label htmlFor="bank-transfer-receipt" className="block text-sm font-bold">{t("receiptLabel")}</label>
                  <p id="bank-transfer-receipt-help" className="mt-1 text-xs leading-5 text-white/70">{t("receiptHelp")}</p>
                  <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/70 px-4 text-center text-sm font-semibold transition hover:bg-white/10 focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--paper)]">
                    <UploadSimple size={20} aria-hidden="true" />
                    <span>{receipt ? receipt.name : t("chooseReceipt")}</span>
                    <input
                      id="bank-transfer-receipt"
                      type="file"
                      name="receipt"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      aria-describedby="bank-transfer-receipt-help"
                      className="sr-only"
                      required
                      onChange={(event) => {
                        const next = event.target.files?.[0] || null;
                        if (next && next.size > 5 * 1024 * 1024) {
                          setReceipt(null);
                          setError(t("receiptTooLarge"));
                          event.currentTarget.value = "";
                          return;
                        }
                        if (next && !receiptTypes.has(next.type)) {
                          setReceipt(null);
                          setError(t("receiptInvalidType"));
                          event.currentTarget.value = "";
                          return;
                        }
                        setError("");
                        setReceipt(next);
                      }}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !domesticReady || !receipt || !cartReady}
                    className="mt-4 flex min-h-13 w-full items-center justify-center rounded-xl bg-[var(--walnut)] px-6 text-sm font-bold text-[var(--paper)] transition hover:bg-[#4a2a1c] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? t("uploadingReceipt") : t("completeOrder")}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Pago internacional — solo PayPal ── */}
          {isInternational && (
            paypalReady ? (
              <div className="mt-6 border-t border-white/20 pt-6">
                <p className="eyebrow text-[0.65rem] text-[var(--paper)] opacity-80 before:w-5">{t("securePayment")}</p>
                <p className="mt-3 text-lg font-bold">US$ {paypalAmountUsd}</p>
                <div className="mt-5">
                  <PayPalCheckoutSection
                    orderId={paypalOrderId}
                    amountUsd={paypalAmountUsd}
                    onSuccess={() => {
                      sessionStorage.removeItem("matearte_paypal_order_idempotency");
                      window.location.assign(`${localizeCanonicalPath(`/pedidos/${paypalOrderId}`, locale)}?payment=success`);
                    }}
                    onError={(msg) => setError(msg)}
                  />
                </div>
              </div>
            ) : null
          )}

          <div className="grow" />

          {cartError && <p role="alert" className="mt-5 rounded-lg border border-white/35 bg-black/15 p-3 text-sm font-semibold text-[var(--paper)]">{cartError}</p>}
          {error && <p role="alert" className="mt-5 text-sm font-semibold text-[var(--paper)]">{error}</p>}

          {!paypalReady && !isWholesale && (
            <button
              disabled={busy || !cartReady || (isInternational ? !internationalReady : !domesticReady)}
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
              {isInternational && !busy && (
                <Image
                  src="/assets/matearte/PayPal.png"
                  alt=""
                  width={20}
                  height={20}
                  className="shrink-0 object-contain"
                  aria-hidden="true"
                />
              )}
              {busy ? t("preparing") : isInternational ? t("continueToPaypal") : t("mercadoPagoAction")}
            </button>
          )}

          {!paypalReady && !isWholesale && (
            <div className="mt-3">
              <button
                type="button"
                aria-expanded={discountOpen}
                aria-controls="discount-code-panel"
                onClick={() => setDiscountOpen((current) => !current)}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white bg-white px-5 text-sm font-bold text-[var(--walnut)] transition hover:bg-[#f7f0e5] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--paper)]"
              >
                {t("discountToggle")}
              </button>
              {discountOpen && (
                <div id="discount-code-panel" className="mt-3 rounded-xl border border-white/30 bg-black/10 p-4">
                  <label htmlFor="discount-code" className="block text-sm font-bold text-[var(--paper)]">
                    {t("discountCodeLabel")}
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="discount-code"
                      name="discount-code"
                      autoComplete="off"
                      maxLength={32}
                      disabled={discountBusy}
                      value={discountCode}
                      onChange={(event) => {
                        setDiscountCode(event.target.value.toUpperCase());
                        setAppliedDiscount(null);
                        setDiscountError("");
                      }}
                      className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/50 bg-white px-4 text-sm font-semibold uppercase tracking-wide text-[var(--walnut)] outline-none focus:border-[var(--walnut)] focus:ring-2 focus:ring-white/60 disabled:opacity-70"
                    />
                    <button
                      type="button"
                      disabled={discountBusy || discountCode.trim().length < 4 || !cartReady}
                      onClick={() => void validateDiscount()}
                      className="min-h-12 rounded-lg border border-white/70 bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {discountBusy ? t("discountValidating") : t("discountValidate")}
                    </button>
                  </div>
                  <div aria-live="polite" className="mt-2 min-h-5 text-xs leading-5">
                    {discountError && <p role="alert" className="font-semibold text-white">{discountError}</p>}
                    {appliedDiscount && !discountError && (
                      <p className="font-semibold text-white">{t("discountApplied", { code: appliedDiscount.code })}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
