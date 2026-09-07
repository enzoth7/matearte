import { describe, expect, it } from "vitest";
import { newsletterUnsubscribeToken, verifyNewsletterUnsubscribeToken } from "@/lib/newsletter-unsubscribe";

describe("baja de Novedades", () => {
  it("firma el correo normalizado y valida el token", () => {
    const token = newsletterUnsubscribeToken(" Persona@Example.com ", "secret-test");
    expect(verifyNewsletterUnsubscribeToken("persona@example.com", token, "secret-test")).toBe(true);
  });

  it("rechaza un token alterado", () => {
    const token = newsletterUnsubscribeToken("persona@example.com", "secret-test");
    expect(verifyNewsletterUnsubscribeToken("otra@example.com", token, "secret-test")).toBe(false);
  });
});
