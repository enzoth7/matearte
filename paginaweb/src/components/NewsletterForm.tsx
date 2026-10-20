"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeToNewsletter } from "@/app/actions/newsletter";
import { initialNewsletterState } from "@/lib/newsletter";

type NewsletterFormProps = {
  source?: "footer" | "welcome";
  onSuccess?: () => void;
  emailLabel: string;
  nameLabel: string;
  subscribeLabel: string;
  subscribeMobileLabel: string;
  subscribingLabel: string;
  successMessage: string;
  invalidEmailMessage: string;
  invalidNameMessage?: string;
  errorMessage: string;
  consentMessage: string;
};

export function NewsletterForm({
  source = "footer",
  onSuccess,
  emailLabel,
  nameLabel,
  subscribeLabel,
  subscribeMobileLabel,
  subscribingLabel,
  successMessage,
  invalidEmailMessage,
  invalidNameMessage,
  errorMessage,
  consentMessage,
}: NewsletterFormProps) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialNewsletterState);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldPrefix = source === "welcome" ? "welcome-newsletter" : "site-newsletter";

  useEffect(() => {
    if (state.status === "success") { formRef.current?.reset(); onSuccess?.(); }
  }, [state.status, onSuccess]);

  const feedback = state.status === "success"
    ? successMessage
    : state.status === "invalid"
      ? invalidEmailMessage
      : state.status === "invalid_name"
        ? invalidNameMessage || errorMessage
      : state.status === "error"
        ? errorMessage
        : "";

  return (
    <form ref={formRef} action={formAction} onSubmit={(event) => {
      const input = event.currentTarget.elements.namedItem("utm_source");
      if (input instanceof HTMLInputElement) input.value = new URLSearchParams(window.location.search).get("utm_source") || "";
    }}>
      <input type="hidden" name="source" value={source} />
      {source === "welcome" && <input type="hidden" name="utm_source" defaultValue="" />}
      {source === "welcome" && <><label htmlFor={`${fieldPrefix}-name`}>{nameLabel}</label><input id={`${fieldPrefix}-name`} name="nombre" type="text" autoComplete="given-name" placeholder={nameLabel} maxLength={100} required aria-invalid={state.status === "invalid_name"} aria-describedby={`${fieldPrefix}-feedback`} /></>}
      <label htmlFor={`${fieldPrefix}-email`}>{emailLabel}</label>
      <input
        id={`${fieldPrefix}-email`}
        name="email"
        type="email"
        autoComplete="email"
        placeholder={emailLabel}
        required
        aria-invalid={state.status === "invalid"}
        aria-describedby={`${fieldPrefix}-feedback ${fieldPrefix}-consent`}
      />
      <input className="home-footer-newsletter-trap" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div>
        {source === "footer" && <input name="nombre" type="text" autoComplete="name" placeholder={nameLabel} aria-label={nameLabel} />}
        <button type="submit" disabled={pending}>
          {pending ? subscribingLabel : (
            <>
              <span className="home-footer-button-desktop">{subscribeLabel}</span>
              <span className="home-footer-button-mobile">{subscribeMobileLabel}</span>
            </>
          )}
        </button>
      </div>
      <p id={`${fieldPrefix}-consent`} className="home-footer-newsletter-consent">{consentMessage}</p>
      <p
        id={`${fieldPrefix}-feedback`}
        className={`home-footer-newsletter-feedback${state.status === "error" || state.status === "invalid" || state.status === "invalid_name" ? " is-error" : ""}`}
        role={state.status === "error" || state.status === "invalid" || state.status === "invalid_name" ? "alert" : "status"}
        aria-live="polite"
      >
        {feedback}
      </p>
    </form>
  );
}
