"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialNewsletterState, subscribeToNewsletter } from "@/app/actions/newsletter";

type NewsletterFormProps = {
  emailLabel: string;
  nameLabel: string;
  subscribeLabel: string;
  subscribeMobileLabel: string;
  subscribingLabel: string;
  successMessage: string;
  invalidEmailMessage: string;
  errorMessage: string;
  consentMessage: string;
};

export function NewsletterForm({
  emailLabel,
  nameLabel,
  subscribeLabel,
  subscribeMobileLabel,
  subscribingLabel,
  successMessage,
  invalidEmailMessage,
  errorMessage,
  consentMessage,
}: NewsletterFormProps) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialNewsletterState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  const feedback = state.status === "success"
    ? successMessage
    : state.status === "invalid"
      ? invalidEmailMessage
      : state.status === "error"
        ? errorMessage
        : "";

  return (
    <form ref={formRef} action={formAction}>
      <label htmlFor="site-newsletter-email">{emailLabel}</label>
      <input
        id="site-newsletter-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={emailLabel}
        required
        aria-invalid={state.status === "invalid"}
        aria-describedby="site-newsletter-feedback site-newsletter-consent"
      />
      <input className="home-footer-newsletter-trap" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div>
        <input name="nombre" type="text" autoComplete="name" placeholder={nameLabel} aria-label={nameLabel} />
        <button type="submit" disabled={pending}>
          {pending ? subscribingLabel : (
            <>
              <span className="home-footer-button-desktop">{subscribeLabel}</span>
              <span className="home-footer-button-mobile">{subscribeMobileLabel}</span>
            </>
          )}
        </button>
      </div>
      <p id="site-newsletter-consent" className="home-footer-newsletter-consent">{consentMessage}</p>
      <p
        id="site-newsletter-feedback"
        className={`home-footer-newsletter-feedback${state.status === "error" || state.status === "invalid" ? " is-error" : ""}`}
        role={state.status === "error" || state.status === "invalid" ? "alert" : "status"}
        aria-live="polite"
      >
        {feedback}
      </p>
    </form>
  );
}
