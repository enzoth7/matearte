"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useActionState, useEffect, useRef } from "react";
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

export function RuralRaffleForm() {
  const [state, formAction, pending] = useActionState(enterRuralRaffle, initialRuralRaffleState);
  const formRef = useRef<HTMLFormElement>(null);

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
      ? "Revisá el email, el celular y el producto seleccionado."
      : state.status === "error"
        ? "No pudimos guardar tus datos. Esperá un momento e intentá nuevamente."
        : "";

  return (
    <form ref={formRef} action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="rural-email">Email</label>
        <input id="rural-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="rural-phone">Celular</label>
        <input id="rural-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="099 123 456" required />
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
