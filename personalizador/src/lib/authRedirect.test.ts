import { describe, expect, it } from "vitest";
import { getMisroutedStoreAuthCallbackUrl, shouldCompleteProfileInPersonalizer, shouldLeaveAccessAfterAuthentication } from "./authRedirect";

describe("getMisroutedStoreAuthCallbackUrl", () => {
  it("reenvía a la tienda un código OAuth que cayó en la raíz del personalizador", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://personalizador.matearteuruguay.com", pathname: "/", search: "?code=oauth-code" },
      "https://matearte.vercel.app",
    )).toBe("https://matearte.vercel.app/auth/handoff?flow=store&code=oauth-code");
  });

  it("no interfiere con el callback propio del personalizador", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://personalizador.matearteuruguay.com", pathname: "/access", search: "?code=oauth-code" },
      "https://matearte.vercel.app",
    )).toBeNull();
  });

  it("reenvía errores OAuth sin transportar tokens", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://personalizador.matearteuruguay.com", pathname: "/", search: "?error=access_denied&error_description=cancelled&access_token=secret" },
      "https://matearte.vercel.app",
    )).toBe("https://matearte.vercel.app/auth/handoff?flow=store&error=access_denied&error_description=cancelled");
  });
});

describe("shouldCompleteProfileInPersonalizer", () => {
  it("deja que una cuenta nueva vuelva a la tienda para completar sus datos allí", () => {
    expect(shouldCompleteProfileInPersonalizer(false, "main-profile")).toBe(false);
  });

  it("no fuerza el perfil al iniciar sesión sin una acción pendiente", () => {
    expect(shouldCompleteProfileInPersonalizer(false, null)).toBe(false);
    expect(shouldCompleteProfileInPersonalizer(false, "profile")).toBe(false);
    expect(shouldCompleteProfileInPersonalizer(false, "edit-contact")).toBe(false);
  });

  it("pide los datos solamente para acciones que los necesitan", () => {
    expect(shouldCompleteProfileInPersonalizer(false, "save-personalizer")).toBe(true);
    expect(shouldCompleteProfileInPersonalizer(false, "save-summary")).toBe(true);
    expect(shouldCompleteProfileInPersonalizer(false, "checkout")).toBe(true);
  });

  it("no pide completar un perfil que ya está completo", () => {
    expect(shouldCompleteProfileInPersonalizer(true, "main-profile")).toBe(false);
    expect(shouldCompleteProfileInPersonalizer(true, "profile")).toBe(false);
  });
});

describe("shouldLeaveAccessAfterAuthentication", () => {
  it("sale de Google si la sesión se recuperó y no hay otra acción pendiente", () => {
    expect(shouldLeaveAccessAfterAuthentication({ step: "access", handoffPending: false, pendingAuthAction: null, authenticated: true })).toBe(true);
  });

  it("espera la validación de un enlace o una acción de acceso pendiente", () => {
    expect(shouldLeaveAccessAfterAuthentication({ step: "access", handoffPending: true, pendingAuthAction: null, authenticated: true })).toBe(false);
    expect(shouldLeaveAccessAfterAuthentication({ step: "access", handoffPending: false, pendingAuthAction: "checkout", authenticated: true })).toBe(false);
    expect(shouldLeaveAccessAfterAuthentication({ step: "access", handoffPending: false, pendingAuthAction: null, authenticated: false })).toBe(false);
  });
});
