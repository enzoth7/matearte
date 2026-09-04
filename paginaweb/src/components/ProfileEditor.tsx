"use client";

import { CheckCircle, UploadSimple } from "@phosphor-icons/react";
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

export function ProfileEditor({ initial, email, welcome }: { initial: ProfileFormData; email: string; welcome: boolean }) {
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
    setForm((current) => ({
      ...current,
      countryCode,
      department: "",
      phone: internationalPhoneNumber(countryCode, phoneNumber),
    }));
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

  return (
    <div className="flex flex-col gap-6">
      {/* ── Cabecera oscura (Figma: Cuenta / Cabecera) ── */}
      <header
        className="rounded-2xl px-8 py-8 sm:px-10 sm:py-10"
        style={{ background: "var(--walnut)" }}
      >
        <h1 className="display-font text-4xl font-medium leading-tight tracking-tight text-[var(--paper)] sm:text-5xl">
          {welcome ? t("welcomeTitle") : t("editTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--paper)]/70">
          {t("intro")}
        </p>
      </header>

      {/* ── Formulario (Figma: ProfileEditor) ── */}
      <form
        onSubmit={(event) => void submit(event)}
        className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--paper)] shadow-[var(--shadow-soft)]"
      >
        <div className="grid gap-0 lg:grid-cols-[18rem_1fr]">
          {/* Foto de perfil — columna izquierda en desktop */}
          <aside className="flex flex-col items-center justify-center gap-4 border-b border-black/10 bg-[var(--cream-deep)]/35 p-8 lg:border-b-0 lg:border-r">
            {/* Drop zone */}
            <div
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--alpaca)] bg-[var(--paper)] px-6 py-10 text-center"
              style={{ minHeight: "11rem" }}
            >
              <UploadSimple size={28} className="text-[var(--leather)]" aria-hidden="true" />
              <p className="display-font text-xl font-medium text-[var(--walnut)]">
                {t("profilePhoto")}
              </p>
              <p className="text-xs leading-5 text-black/50">
                {t("fileHelp")}
              </p>
            </div>

            {/* Botón seleccionar imagen */}
            <label className="mt-1 w-full cursor-pointer rounded-2xl border border-[var(--alpaca)] bg-[var(--paper)] py-3 text-center text-sm font-semibold text-[var(--walnut)] transition-colors hover:border-[var(--walnut)] hover:bg-[var(--cream-deep)]/40">
              {avatar ? avatar.name : t("selectImage")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setAvatar(event.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
          </aside>

          {/* Campos del formulario — columna derecha */}
          <div className="p-6 sm:p-8">
            {/* Eyebrow cuando es bienvenida */}
            {welcome && (
              <p className="eyebrow mb-6 text-[var(--leather)]">{t("welcomeEyebrow")}</p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Email — read only */}
              <label className="text-sm font-semibold sm:col-span-2">
                {t("email")}
                <input
                  value={email}
                  readOnly
                  aria-readonly="true"
                  className="mt-2 h-12 w-full rounded-lg border border-black/10 bg-black/[0.035] px-4 text-black/50"
                />
              </label>

              {/* Nombre completo */}
              <label className="text-sm font-semibold sm:col-span-2">
                {t("fullName")} *
                <input
                  ref={firstInvalid}
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={form.fullName}
                  onChange={(event) => update("fullName", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>

              {/* Fecha de cumpleaños */}
              <label className="text-sm font-semibold">
                {t("birthday")} *
                <input
                  type="date"
                  required
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.birthDate}
                  onChange={(event) => update("birthDate", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>

              {/* Celular */}
              <label className="text-sm font-semibold">
                {t("phone")}
                <span className="mt-2 flex h-12 overflow-hidden rounded-lg border border-black/20 bg-transparent focus-within:border-[var(--leather)] focus-within:ring-2 focus-within:ring-[var(--leather)]/20">
                  <span
                    className="grid min-w-20 place-items-center border-r border-black/15 bg-[var(--cream-deep)]/55 px-3 text-sm font-semibold tabular-nums text-black/65"
                    aria-label={callingCode ? t("callingCode", { code: callingCode }) : t("chooseCountryForCode")}
                  >
                    {callingCode || "—"}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={32}
                    value={phoneNumber}
                    onChange={(event) => updatePhone(event.target.value)}
                    placeholder={t("phonePlaceholder")}
                    aria-label={t("phoneAria")}
                    className="min-w-0 flex-1 bg-transparent px-4 outline-none"
                  />
                </span>
                <span className="mt-1.5 block text-xs font-normal leading-5 text-black/50">
                  {t("phoneHelp")}
                </span>
              </label>

              {/* País */}
              <label className="text-sm font-semibold">
                {t("country")} *
                <select
                  autoComplete="country"
                  required
                  value={form.countryCode}
                  onChange={(event) => updateCountry(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                >
                  <option value="">{t("chooseCountry")}</option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>

              {/* Departamento / Estado */}
              {regions.length > 0 ? (
                <label className="text-sm font-semibold">
                  {form.countryCode === "UY" ? t("department") : t("state")} *
                  <select
                    autoComplete="address-level1"
                    required
                    value={form.department}
                    onChange={(event) => update("department", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                  >
                    <option value="">{t("chooseOption")}</option>
                    {regions.map((region) => (
                      <option key={region.code} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="text-sm font-semibold">
                  {t("state")} <span className="font-normal text-black/45">({t("optional")})</span>
                  <input
                    autoComplete="address-level1"
                    maxLength={80}
                    value={form.department}
                    onChange={(event) => update("department", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                  />
                </label>
              )}

              {/* Ciudad */}
              <label className="text-sm font-semibold">
                {t("city")} *
                <input
                  autoComplete="address-level2"
                  required
                  maxLength={120}
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>

              {/* Código postal */}
              <label className="text-sm font-semibold">
                {t("postalCode")}
                <input
                  autoComplete="postal-code"
                  maxLength={20}
                  value={form.postalCode}
                  onChange={(event) => update("postalCode", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>

              {/* Dirección de entrega */}
              <label className="text-sm font-semibold sm:col-span-2">
                {t("address")} *
                <input
                  autoComplete="street-address"
                  required
                  maxLength={180}
                  value={form.addressLine1}
                  onChange={(event) => update("addressLine1", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>

              {/* Empresa (opcional) */}
              <label className="text-sm font-semibold sm:col-span-2">
                {t("company")} <span className="font-normal text-black/45">({t("optional")})</span>
                <input
                  maxLength={120}
                  value={form.company}
                  onChange={(event) => update("company", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-black/20 bg-transparent px-4 focus:border-[var(--leather)] focus:outline-none focus:ring-2 focus:ring-[var(--leather)]/20"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Footer del formulario — botones ── */}
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 px-6 py-5 sm:px-8">
          {error && (
            <p role="alert" className="mr-auto text-sm text-[var(--danger)]">{error}</p>
          )}
          {saved && (
            <p role="status" className="mr-auto flex items-center gap-2 text-sm font-semibold text-[var(--whatsapp)]">
              <CheckCircle size={20} aria-hidden="true" />
              {t("saved")}
            </p>
          )}
          {!welcome && (
            <button
              type="button"
              onClick={() => router.push("/perfil")}
              className="button-secondary"
            >
              {t("cancel")}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="button-primary disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
