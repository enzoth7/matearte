"use client";

import { CheckCircle, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { countryCallingCode, countryOptions, countryRegions, internationalPhoneNumber, localPhoneNumber } from "@/lib/countries";

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
      setError("Completá los campos obligatorios. También necesitamos el estado, provincia o departamento del país elegido.");
      firstInvalid.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.set(key, value));
      if (avatar) body.set("avatar", avatar);
      const response = await fetch("/api/profile", { method: "POST", body });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "No pudimos guardar tus datos.");
      setSaved(true);
      window.setTimeout(() => {
        router.push("/perfil");
        router.refresh();
      }, 500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar tus datos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]">
      <div className="border-b border-black/10 bg-[var(--cream-deep)]/55 p-6 sm:p-8">
        <p className="eyebrow text-[var(--leather)]">{welcome ? "Bienvenido a MateArte" : "Datos de tu cuenta"}</p>
        <h1 className="display-font mt-5 text-4xl sm:text-5xl">{welcome ? "Completá tu perfil" : "Editar mis datos"}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60">Usamos esta información para preparar tus pedidos y saber a qué país debemos enviarlos. Tu cuenta es la misma en la tienda y en el visualizador.</p>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Correo electrónico<input value={email} readOnly aria-readonly="true" className="mt-2 h-12 w-full border border-black/15 bg-black/[0.035] px-4 text-black/55" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Nombre completo *<input ref={firstInvalid} name="name" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          <label className="text-sm font-semibold">Fecha de cumpleaños *<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          <label className="text-sm font-semibold">
            Teléfono / WhatsApp
            <span className="mt-2 flex h-12 overflow-hidden border border-black/20 bg-transparent focus-within:border-[var(--leather)] focus-within:ring-2 focus-within:ring-[var(--leather)]/20">
              <span className="grid min-w-20 place-items-center border-r border-black/15 bg-[var(--cream-deep)]/55 px-3 text-sm font-semibold tabular-nums text-black/65" aria-label={callingCode ? `Prefijo internacional ${callingCode}` : "Elegí un país para obtener el prefijo"}>
                {callingCode || "—"}
              </span>
              <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={32} value={phoneNumber} onChange={(event) => updatePhone(event.target.value)} placeholder="Número de teléfono" aria-label="Número de teléfono sin prefijo internacional" className="min-w-0 flex-1 bg-transparent px-4 outline-none" />
            </span>
            <span className="mt-1.5 block text-xs font-normal leading-5 text-black/50">El prefijo cambia automáticamente según el país.</span>
          </label>
          <label className="text-sm font-semibold">País *<select autoComplete="country" required value={form.countryCode} onChange={(event) => updateCountry(event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4"><option value="">Elegí tu país</option>{countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          {regions.length > 0 ? (
            <label className="text-sm font-semibold">{form.countryCode === "UY" ? "Departamento" : "Estado / provincia"} *<select autoComplete="address-level1" required value={form.department} onChange={(event) => update("department", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4"><option value="">Elegí una opción</option>{regions.map((region) => <option key={region.code} value={region.name}>{region.name}</option>)}</select></label>
          ) : (
            <label className="text-sm font-semibold">Estado / provincia <span className="font-normal text-black/45">(opcional)</span><input autoComplete="address-level1" maxLength={80} value={form.department} onChange={(event) => update("department", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          )}
          <label className="text-sm font-semibold">Ciudad / localidad *<input autoComplete="address-level2" required maxLength={120} value={form.city} onChange={(event) => update("city", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          <label className="text-sm font-semibold">Código postal<input autoComplete="postal-code" maxLength={20} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Dirección *<input autoComplete="street-address" required maxLength={180} value={form.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Empresa / marca <span className="font-normal text-black/45">(opcional)</span><input maxLength={120} value={form.company} onChange={(event) => update("company", event.target.value)} className="mt-2 h-12 w-full border border-black/20 bg-transparent px-4" /></label>
        </div>

        <aside className="h-fit border border-black/15 bg-[var(--cream-deep)]/35 p-5">
          <UploadSimple size={25} className="text-[var(--leather)]" aria-hidden="true" />
          <h2 className="display-font mt-4 text-2xl">Foto de perfil</h2>
          <p className="mt-3 text-xs leading-6 text-black/55">PNG, JPEG o WebP. Máximo 2 MB.</p>
          <label className="mt-5 block cursor-pointer border border-black/20 bg-[var(--paper)] p-4 text-center text-sm font-semibold">
            {avatar ? avatar.name : "Seleccionar imagen"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] || null)} className="sr-only" />
          </label>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 p-6 sm:px-8">
        {error && <p role="alert" className="mr-auto text-sm text-[var(--danger)]">{error}</p>}
        {saved && <p role="status" className="mr-auto flex items-center gap-2 text-sm font-semibold text-[var(--whatsapp)]"><CheckCircle size={20} aria-hidden="true" />Datos guardados</p>}
        {!welcome && <button type="button" onClick={() => router.push("/perfil")} className="button-secondary">Cancelar</button>}
        <button type="submit" disabled={busy} className="button-primary disabled:cursor-wait disabled:opacity-60">{busy ? "Guardando…" : "Guardar datos"}</button>
      </div>
    </form>
  );
}
