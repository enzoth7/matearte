// @vitest-environment node
import { expect, it, vi } from "vitest";
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("@/lib/supabase/server", () => ({ createAdminSupabase: () => ({ from: () => ({ upsert }) }) }));
vi.mock("@/lib/rural-locations", () => ({ resolveRuralLocation: () => ({ city: "Paysandú", country: "Uruguay" }) }));
import { enterRuralRaffle } from "./rural-raffle";
it("inserta sin sobrescribir una inscripción existente y devuelve el mismo éxito", async () => {
  const form = new FormData();
  Object.entries({ fullName: "Ana Pérez", email: "ana@example.com", phone: "099123456", countryCode: "UY", city: "Paysandú", birthDate: "1995-04-12", productInterest: "mates", privacyConsent: "on" }).forEach(([key, value]) => form.set(key, value));
  expect(await enterRuralRaffle({ status: "idle" }, form)).toEqual({ status: "success" });
  form.set("fullName", "Otro nombre");
  expect(await enterRuralRaffle({ status: "idle" }, form)).toEqual({ status: "success" });
  expect(upsert).toHaveBeenLastCalledWith(expect.any(Object), { onConflict: "campaign,email", ignoreDuplicates: true });
});
