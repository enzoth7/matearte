"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useActionState, useEffect, useRef, useState } from "react";
import { enterRuralRaffle } from "@/app/actions/rural-raffle";
import { initialRuralRaffleState } from "@/lib/rural-raffle";
import styles from "@/app/rural/RuralPage.module.css";

const productOptions = [
  ["", "Elegí una opción"],
  ["mates", "Mates"],
  ["bombillas", "Bombillas"],
  ["materas", "Materas"],
  ["termos", "Termos"],
  ["personalizados", "Productos personalizados"],
  ["botas", "Botas"],
  ["carteras", "Carteras"],
  ["otros-articulos-cuero", "Otros artículos en cuero"],
] as const;

export function RuralRaffleForm({ countries, initialCities }: { countries: { code: string; name: string }[]; initialCities: string[] }) {
  const [state, formAction, pending] = useActionState(enterRuralRaffle, initialRuralRaffleState);
  const formRef = useRef<HTMLFormElement>(null);
  const [countryCode, setCountryCode] = useState("UY");
  const [city, setCity] = useState("Paysandú");
  const [cityQuery, setCityQuery] = useState("");
  const [cityOptions, setCityOptions] = useState(initialCities);
  const [moreCities, setMoreCities] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [retryCities, setRetryCities] = useState(0);

  useEffect(() => {
    if (countryCode === "UY") return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/rural/cities?country=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(cityQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("No se pudieron cargar las ciudades.");
        const result = await response.json() as { cities: string[]; truncated: boolean };
        setCityOptions(result.cities);
        setMoreCities(result.truncated);
        setCityError(false);
      } catch {
        if (!controller.signal.aborted) setCityError(true);
      } finally {
        if (!controller.signal.aborted) setLoadingCities(false);
      }
    }, 180);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [countryCode, cityQuery, initialCities, retryCities]);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className={styles.success} role="status" aria-live="polite">
        <CheckCircle size={46} weight="fill" aria-hidden="true" />
        <h2>¡Listo, ya estás participando!</h2>
        <p>Guardamos tus datos. Si resultás ganador/a, te vamos a contactar por email o celular.</p>
      </div>
    );
  }

  const feedback = state.status === "consent-required"
    ? "Necesitamos tu autorización para registrar la participación."
    : state.status === "invalid"
      ? "Revisá los datos personales y el producto seleccionado."
      : state.status === "error"
        ? "No pudimos guardar tus datos. Esperá un momento e intentá nuevamente."
        : "";

  return (
    <form ref={formRef} action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="rural-full-name">Nombre y apellido</label>
        <input id="rural-full-name" name="fullName" type="text" autoComplete="name" maxLength={120} placeholder="Tu nombre y apellido" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-email">Email</label>
        <input id="rural-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-phone">Celular</label>
        <input id="rural-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="099 123 456" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-country">País</label>
        <select id="rural-country" name="countryCode" value={countryCode} onChange={(event) => {
          const nextCountry = event.target.value;
          setCountryCode(nextCountry);
          setCity(nextCountry === "UY" ? "Paysandú" : "");
          setCityQuery("");
          setCityOptions(nextCountry === "UY" ? initialCities : []);
          setMoreCities(false);
          setLoadingCities(nextCountry !== "UY");
          setCityError(false);
        }} required>
          {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-city">Ciudad</label>
        {(moreCities || cityQuery) && <input type="search" aria-label="Buscar ciudad" placeholder="Buscar ciudad" value={cityQuery} onChange={(event) => {
          setCityQuery(event.target.value);
          setCity("");
          setCityOptions([]);
          setLoadingCities(true);
        }} />}
        <select id="rural-city" name="city" value={city} onChange={(event) => setCity(event.target.value)} disabled={loadingCities || cityError} required>
          <option value="" disabled>{loadingCities ? "Cargando ciudades…" : cityOptions.length ? "Elegí una ciudad" : "No hay ciudades disponibles"}</option>
          {cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {cityError && <button className={styles.cityRetry} type="button" onClick={() => { setCityError(false); setLoadingCities(true); setRetryCities((value) => value + 1); }}>No pudimos cargar las ciudades. Reintentar</button>}
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-birth-date">Fecha de cumpleaños</label>
        <input id="rural-birth-date" name="birthDate" type="date" autoComplete="bday" min="1900-01-01" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-interest">¿Qué producto te interesa?</label>
        <select id="rural-interest" name="productInterest" defaultValue="" required>
          {productOptions.map(([value, label]) => <option value={value} disabled={!value} key={value || "empty"}>{label}</option>)}
        </select>
      </div>

      <input className={styles.trap} name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <label className={styles.check}>
        <input name="privacyConsent" type="checkbox" required />
        <span>Acepto que MateArte use estos datos para gestionar mi participación y contactarme si resulto ganador/a. Consultá la <a href="/compras/politica-de-privacidad" target="_blank">política de privacidad</a>.</span>
      </label>

      <label className={styles.check}>
        <input name="marketingOptIn" type="checkbox" />
        <span>Quiero recibir novedades y promociones de MateArte.</span>
      </label>

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Participar del sorteo"}
      </button>

      <p className={styles.feedback} role={feedback ? "alert" : "status"} aria-live="polite">{feedback}</p>
    </form>
  );
}
