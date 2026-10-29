import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { exchange_rate: 0.04 }, error: null }) }) }) }) }),
  createPublicSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
}));

import { getArgentinaDisplayRate, getArgentinaSettings } from "./argentina-server";

describe("Argentina display and checkout availability", () => {
  it("offers the finance rate while bank transfer remains disabled", async () => {
    expect(await getArgentinaDisplayRate()).toBe(25);
    expect(await getArgentinaSettings()).toBeNull();
  });
});
