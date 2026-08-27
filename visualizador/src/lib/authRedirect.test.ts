import { describe, expect, it } from "vitest";
import { getMisroutedStoreAuthCallbackUrl } from "./authRedirect";

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
