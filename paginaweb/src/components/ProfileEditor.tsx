"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { countryCallingCode, countryOptionsForLocale, countryPhoneOptionsForLocale, countryRegions, internationalPhoneNumber, localPhoneNumber, parsePhoneNumber } from "@/lib/countries";
import type { Locale } from "@/types/catalog";
import { isOrderRedirect, type StoreRedirect } from "@/lib/auth-redirect";
import { localizeCanonicalPath } from "@/i18n/paths";

export type ProfileFormData = {
  fullName: string;
  phone: string;
  company: string;
  birthDate: string;
  countryCode: string;
  department: string;
  city: string;
  addressLine1: string;
  postalCode: string;
};

export function ProfileEditor({ initial, welcome, postSaveRedirect, countryChoices, phoneCountryChoices }: {
  initial: ProfileFormData;
  welcome: boolean;
  postSaveRedirect?: StoreRedirect;
  countryChoices?: ReturnType<typeof countryOptionsForLocale>;
  phoneCountryChoices?: ReturnType<typeof countryPhoneOptionsForLocale>;
}) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("profileEditor");
  const countryOptions = countryChoices ?? countryOptionsForLocale(locale);
  const phoneCountryOptions = phoneCountryChoices ?? countryPhoneOptionsForLocale(locale);
  const firstInvalid = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initial);
  const [parsedPhone] = useState(() => parsePhoneNumber(initial.phone, initial.countryCode || "UY"));
  const [phoneCountry, setPhoneCountry] = useState(parsedPhone.phoneCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(parsedPhone.localNumber);
  const [phoneCountryManuallyChanged, setPhoneCountryManuallyChanged] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ProfileFormData, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const regions = countryRegions(form.countryCode);
  const callingCode = countryCallingCode(phoneCountry);

  const updateCountry = (countryCode: string) => {
    setSaved(false);
    const nextPhoneCountry = !phoneCountryManuallyChanged ? countryCode : phoneCountry;
    if (!phoneCountryManuallyChanged) {
      setPhoneCountry(countryCode);
    }
    setForm((current) => ({
      ...current,
      countryCode,
      department: "",
      phone: internationalPhoneNumber(nextPhoneCountry, phoneNumber),
    }));
  };

  const updatePhoneCountry = (code: string) => {
    setSaved(false);
    setPhoneCountryManuallyChanged(true);
    setPhoneCountry(code);
    setForm((current) => ({
      ...current,
      phone: internationalPhoneNumber(code, phoneNumber),
    }));
  };

  const updatePhone = (value: string) => {
    const localNumber = localPhoneNumber(value, phoneCountry);
    setPhoneNumber(localNumber);
    update("phone", internationalPhoneNumber(phoneCountry, localNumber));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (!form.fullName.trim() || !form.birthDate || !form.countryCode || !form.city.trim() || !form.addressLine1.trim() || (regions.length > 0 && !form.department.trim())) {
      setError(t("requiredError"));
      firstInvalid.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.set(key, value));
      if (avatar) body.set("avatar", avatar);
      const response = await fetch("/api/profile", { method: "POST", body });
      await response.json();
      if (!response.ok) throw new Error(t("saveFailed"));
      setSaved(true);
      window.setTimeout(() => {
        if (postSaveRedirect && isOrderRedirect(postSaveRedirect)) {
          window.location.assign(localizeCanonicalPath(postSaveRedirect, locale));
          return;
        }
        router.push(postSaveRedirect || "/perfil");
        router.refresh();
      }, 500);
    } catch (reason) {
      console.error("Profile update failed", reason);
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const fieldClass = "mt-1.5 h-[53px] w-full rounded-lg border border-[#67564c] bg-[#fffdf8] px-4 text-sm font-normal text-[#311c12] outline-none transition focus:border-[#79452d] focus:ring-2 focus:ring-[#c7a071]/45";

  return (
    <div className="flex flex-col gap-8 lg:gap-[52px]">
      <header className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-[#311c12] px-6 py-9 text-center text-[#fffdf8] sm:min-h-52 sm:px-10 lg:min-h-[250px]">
        <h1 className="display-font text-4xl font-medium leading-none tracking-tight sm:text-5xl">{t("editTitle")}</h1>
        <p className="mt-5 max-w-4xl text-sm leading-6 text-white/90 sm:text-lg sm:leading-7 lg:text-xl">{t("intro")}</p>
      </header>

      <form onSubmit={(event) => void submit(event)} className="border border-[#79452d]/15 bg-[#fffdf8] p-6 sm:p-8 lg:min-h-[533px] lg:pb-[38px] lg:pl-[38px] lg:pr-[30px] lg:pt-[78px]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_355px] lg:gap-[29px]">
          <div className="min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-[14px] gap-y-6 sm:grid-cols-2 lg:gap-y-8">
              <label className="text-[13px] font-bold text-[#17130f]">
                {t("fullName")}
                <input ref={firstInvalid} name="name" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className={fieldClass} />
              </label>

              <label className="text-[13px] font-bold text-[#17130f]">
                {t("phone")}
                <div className="mt-1.5 flex h-[53px] w-full rounded-lg border border-[#67564c] bg-[#fffdf8] transition focus-within:border-[#79452d] focus-within:ring-2 focus-within:ring-[#c7a071]/45">
                  <select
                    aria-label={t("phoneCountryAria")}
                    value={phoneCountry}
                    onChange={(event) => updatePhoneCountry(event.target.value)}
                    className="max-w-[60%] shrink-0 rounded-l-lg border-r border-[#311c12]/30 bg-transparent px-2.5 text-xs font-normal text-[#311c12] outline-none transition sm:max-w-[48%] sm:text-sm"
                  >
                    {phoneCountryOptions.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} ({country.callingCode}) · {country.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={32}
                    value={phoneNumber}
                    onChange={(event) => updatePhone(event.target.value)}
                    aria-label={callingCode ? `${t("phone")}. ${t("callingCode", { code: callingCode })}` : t("chooseCountryForCode")}
                    className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-sm font-normal text-[#311c12] outline-none"
                  />
                </div>
                <span className="sr-only">{callingCode ? t("callingCode", { code: callingCode }) : t("chooseCountryForCode")}. {t("phoneHelp")}</span>
              </label>

              <label className="text-[13px] font-bold text-[#17130f]">
                {t("birthday")}
                <input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className={fieldClass} />
              </label>

              <label className="text-[13px] font-bold text-[#17130f]">
                {t("country")}
                <select autoComplete="country" required value={form.countryCode} onChange={(event) => updateCountry(event.target.value)} className={fieldClass}>
                  <option value="">{t("chooseCountry")}</option>
                  {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </label>

              <label className="text-[13px] font-bold text-[#17130f]">
                {t("city")}
                <input autoComplete="address-level2" required maxLength={120} value={form.city} onChange={(event) => update("city", event.target.value)} className={fieldClass} />
              </label>

              {regions.length > 0 ? (
                <label className="text-[13px] font-bold text-[#17130f]">
                  {form.countryCode === "UY" ? t("department") : t("state")}
                  <select autoComplete="address-level1" required value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass}>
                    <option value="">{t("chooseOption")}</option>
                    {regions.map((region) => <option key={region.code} value={region.name}>{region.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-[13px] font-bold text-[#17130f]">
                  {t("state")} <span className="font-normal text-black/45">({t("optional")})</span>
                  <input autoComplete="address-level1" maxLength={80} value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass} />
                </label>
              )}

              <label className="text-[13px] font-bold text-[#17130f] sm:col-span-1">
                {t("address")}
                <input autoComplete="street-address" required maxLength={180} value={form.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} className={fieldClass} />
              </label>
            </div>
            {(error || saved) && <div className="mt-5" aria-live="polite">
              {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
              {saved && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-[var(--whatsapp)]"><CheckCircle size={20} aria-hidden="true" />{t("saved")}</p>}
            </div>}
          </div>

          <aside className="flex min-w-0 flex-col gap-7 lg:pt-6">
            <div className="flex min-h-[276px] flex-col items-center justify-center rounded-[14px] bg-[#908c76] px-8 py-8 text-center text-[#fffdf8]">
              <p className="text-[26px] font-normal leading-tight">{t("profilePhoto")}</p>
              <p className="mt-3 max-w-40 text-[13px] leading-5 text-white/90">{t("fileHelp")}</p>
              <label className="mt-11 flex min-h-[50px] w-full cursor-pointer items-center justify-center rounded-xl bg-[#fffdf8] px-4 text-sm font-bold text-[#311c12] transition hover:bg-[#f5f0e8] focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[#fffdf8]">
                <span className="truncate">{avatar ? avatar.name : t("selectImage")}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] || null)} className="sr-only" />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3.5 lg:mt-4">
              <button type="button" onClick={() => router.push(welcome ? (postSaveRedirect === "/checkout" ? "/carrito" : "/") : "/perfil")} className="min-h-[52px] rounded-xl border border-[#67564c] bg-[#fffdf8] px-7 text-sm font-bold text-[#311c12] transition hover:bg-[#f5f0e8] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c7a071]">{t("cancel")}</button>
              <button type="submit" disabled={busy} className="min-h-[52px] rounded-xl bg-[#311c12] px-5 text-sm font-bold text-[#fffdf8] transition hover:bg-[#4a2a1c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c7a071] disabled:cursor-wait disabled:opacity-60">{busy ? t("saving") : t("save")}</button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
