import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth }),
}));

const handoffCode = "a".repeat(43);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("recuperación de enlaces del perfil", () => {
  it("no cierra una sesión existente si el código ya venció", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Código usado o vencido." }),
    }));
    const { consumeMainSiteHandoff } = await import("./supabase");

    await expect(consumeMainSiteHandoff(handoffCode)).rejects.toThrow("Código usado o vencido.");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("conecta la cuenta recibida sin cerrar la sesión antes de validar el enlace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokenHash: "valid-token" }),
    }));
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: "customer-id" } }, error: null });
    const { consumeMainSiteHandoff } = await import("./supabase");

    await expect(consumeMainSiteHandoff(handoffCode)).resolves.toBe("customer-id");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "valid-token" });
  });
});
