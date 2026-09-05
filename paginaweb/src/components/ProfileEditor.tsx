"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { countryCallingCode, countryOptionsForLocale, countryRegions, internationalPhoneNumber, localPhoneNumber } from "@/lib/countries";
import type { Locale } from "@/types/catalog";

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

export function ProfileEditor({ initial, welcome }: { initial: ProfileFormData; welcome: boolean }) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("profileEditor");
  const countryOptions = countryOptionsForLocale(locale);
  const firstInvalid = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initial);
  const [phoneNumber, setPhoneNumber] = useState(() => localPhoneNumber(initial.phone, initial.countryCode));
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ProfileFormData, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const regions = countryRegions(form.countryCode);
  const callingCode = countryCallingCode(form.countryCode);

  const updateCountry = (countryCode: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, countryCode, department: "", phone: internationalPhoneNumber(countryCode, phoneNumber) }));
  };

  const updatePhone = (value: string) => {
    const localNumber = localPhoneNumber(value, form.countryCode);
    setPhoneNumber(localNumber);
    update("phone", internationalPhoneNumber(form.countryCode, localNumber));
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
        router.push("/perfil");
        router.refresh();
      }, 500);
    } catch (reason) {
      console.error("Profile update failed", reason);
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-[#311c12]/75 bg-[#fffdf8] px-4 text-sm text-[#311c12] outline-none transition focus:border-[#79452d] focus:ring-2 focus:ring-[#c7a071]/45";

  return (
    <div className="flex flex-col gap-11 lg:gap-12">
      <header className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-[#311c12] px-6 py-8 text-center text-[#fffdf8] sm:min-h-48 sm:px-10 lg:min-h-55">
        <h1 className="display-font text-4xl font-medium leading-none tracking-tight sm:text-5xl">{welcome ? t("welcomeTitle") : t("editTitle")}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-white/90 sm:text-base sm:leading-7">{t("intro")}</p>
      </header>

      <form onSubmit={(event) => void submit(event)} className="border border-[#79452d]/25 bg-[#fffdf8] p-6 sm:p-8 lg:p-6">
        {welcome && <p className="eyebrow mb-7 text-[var(--leather)]">{t("welcomeEyebrow")}</p>}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19.5rem] lg:gap-5">
          <div>
            <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#17130f]">
                {t("fullName")}
                <input ref={firstInvalid} name="name" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className={fieldClass} />
              </label>

              <label className="text-xs font-semibold text-[#17130f]">
                {t("phone")}
                <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={32} value={phoneNumber} onChange={(event) => updatePhone(event.target.value)} aria-label={callingCode ? `${t("phone")}. ${t("callingCode", { code: callingCode })}` : t("chooseCountryForCode")} className={fieldClass} />
                <span className="sr-only">{callingCode ? t("callingCode", { code: callingCode }) : t("chooseCountryForCode")}. {t("phoneHelp")}</span>
              </label>

              <label className="text-xs font-semibold text-[#17130f]">
                {t("birthday")}
                <input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className={fieldClass} />
              </label>

              <label className="text-xs font-semibold text-[#17130f]">
                {t("country")}
                <select autoComplete="country" required value={form.countryCode} onChange={(event) => updateCountry(event.target.value)} className={fieldClass}>
                  <option value="">{t("chooseCountry")}</option>
                  {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </label>

              <label className="text-xs font-semibold text-[#17130f]">
                {t("city")}
                <input autoComplete="address-level2" required maxLength={120} value={form.city} onChange={(event) => update("city", event.target.value)} className={fieldClass} />
              </label>

              {regions.length > 0 ? (
                <label className="text-xs font-semibold text-[#17130f]">
                  {form.countryCode === "UY" ? t("department") : t("state")}
                  <select autoComplete="address-level1" required value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass}>
                    <option value="">{t("chooseOption")}</option>
                    {regions.map((region) => <option key={region.code} value={region.name}>{region.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-xs font-semibold text-[#17130f]">
                  {t("state")} <span className="font-normal text-black/45">({t("optional")})</span>
                  <input autoComplete="address-level1" maxLength={80} value={form.department} onChange={(event) => update("department", event.target.value)} className={fieldClass} />
                </label>
              )}

              <label className="text-xs font-semibold text-[#17130f] sm:col-span-1">
                {t("address")}
                <input autoComplete="street-address" required maxLength={180} value={form.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} className={fieldClass} />
              </label>
            </div>
            {(error || saved) && <div className="mt-5" aria-live="polite">
              {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
              {saved && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-[var(--whatsapp)]"><CheckCircle size={20} aria-hidden="true" />{t("saved")}</p>}
            </div>}
          </div>

          <aside className="flex flex-col gap-7">
            <div className="flex min-h-60 flex-col items-center justify-center rounded-[14px] bg-[#908c76] px-5 py-7 text-center text-[#fffdf8]">
              <p className="display-font text-2xl font-medium">{t("profilePhoto")}</p>
              <p className="mt-3 max-w-40 text-xs leading-5 text-white/85">{t("fileHelp")}</p>
              <label className="mt-8 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#fffdf8] px-4 text-sm font-semibold text-[#311c12] transition hover:bg-[#f5f0e8] focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[#fffdf8]">
                <span className="truncate">{avatar ? avatar.name : t("selectImage")}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] || null)} className="sr-only" />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              {!welcome && <button type="button" onClick={() => router.push("/perfil")} className="min-h-12 rounded-xl border border-[#311c12] bg-[#fffdf8] px-6 text-sm font-semibold text-[#311c12] transition hover:bg-[#f5f0e8] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c7a071]">{t("cancel")}</button>}
              <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#311c12] px-6 text-sm font-semibold text-[#fffdf8] transition hover:bg-[#4a2a1c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c7a071] disabled:cursor-wait disabled:opacity-60">{busy ? t("saving") : t("save")}</button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
