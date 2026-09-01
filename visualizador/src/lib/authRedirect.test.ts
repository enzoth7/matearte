import { describe, expect, it } from "vitest";
import { getMisroutedStoreAuthCallbackUrl, shouldCompleteProfileInVisualizer } from "./authRedirect";

describe("getMisroutedStoreAuthCallbackUrl", () => {
  it("reenvía a la tienda un código OAuth que cayó en la raíz del visualizador", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://matearte-visualizador.vercel.app", pathname: "/", search: "?code=oauth-code" },
      "https://matearte.vercel.app",
    )).toBe("https://matearte.vercel.app/auth/handoff?flow=store&code=oauth-code");
  });

  it("no interfiere con el callback propio del visualizador", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://matearte-visualizador.vercel.app", pathname: "/access", search: "?code=oauth-code" },
      "https://matearte.vercel.app",
    )).toBeNull();
  });

  it("reenvía errores OAuth sin transportar tokens", () => {
    expect(getMisroutedStoreAuthCallbackUrl(
      { origin: "https://matearte-visualizador.vercel.app", pathname: "/", search: "?error=access_denied&error_description=cancelled&access_token=secret" },
      "https://matearte.vercel.app",
    )).toBe("https://matearte.vercel.app/auth/handoff?flow=store&error=access_denied&error_description=cancelled");
  });
});

describe("shouldCompleteProfileInVisualizer", () => {
  it("deja que una cuenta nueva vuelva a la tienda para completar sus datos allí", () => {
    expect(shouldCompleteProfileInVisualizer(false, "main-profile")).toBe(false);
  });

  it("no fuerza el perfil al iniciar sesión sin una acción pendiente", () => {
    expect(shouldCompleteProfileInVisualizer(false, null)).toBe(false);
    expect(shouldCompleteProfileInVisualizer(false, "profile")).toBe(false);
    expect(shouldCompleteProfileInVisualizer(false, "edit-contact")).toBe(false);
  });

  it("pide los datos solamente para acciones que los necesitan", () => {
    expect(shouldCompleteProfileInVisualizer(false, "save-customizer")).toBe(true);
    expect(shouldCompleteProfileInVisualizer(false, "save-summary")).toBe(true);
    expect(shouldCompleteProfileInVisualizer(false, "checkout")).toBe(true);
  });

  it("no pide completar un perfil que ya está completo", () => {
    expect(shouldCompleteProfileInVisualizer(true, "main-profile")).toBe(false);
    expect(shouldCompleteProfileInVisualizer(true, "profile")).toBe(false);
  });
});
