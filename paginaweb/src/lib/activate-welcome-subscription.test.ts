import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminSupabase: vi.fn(), subscribeNewsletterContact: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createAdminSupabase: mocks.createAdminSupabase }));
vi.mock("@/lib/newsletter", () => ({ subscribeNewsletterContact: mocks.subscribeNewsletterContact }));

import { activateWelcomeSubscriptionForVerifiedUser } from "./activate-welcome-subscription";

const user = (confirmedAt: string | null) => ({
  id: "user-1", email: " Test@Example.com ", email_confirmed_at: confirmedAt,
}) as User;

describe("welcome subscription after account registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_NEWSLETTER_TOPIC_ID", "");
  });

  it("activates a pending welcome subscription when the account email is verified", async () => {
    const lookup = {
      select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: "Ana", source: "welcome" }, error: null }),
    };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    const update = {
      update: vi.fn(), eq: vi.fn(), select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: "Ana" }, error: null }),
    };
    update.update.mockReturnValue(update);
    update.eq.mockReturnValue(update);
    update.select.mockReturnValue(update);
    mocks.createAdminSupabase.mockReturnValue({ from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update) });

    expect(await activateWelcomeSubscriptionForVerifiedUser(user("2026-10-20T21:51:53Z"))).toBe(true);
    expect(lookup.eq).toHaveBeenCalledWith("email", "test@example.com");
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active", marketing_synced_at: null }));
    expect(update.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("does not activate a subscription without verified email ownership", async () => {
    expect(await activateWelcomeSubscriptionForVerifiedUser(user(null))).toBe(false);
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });
});
