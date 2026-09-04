"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { persistLocalePreference } from "@/lib/locale-preference";

export function GoogleAuthButton({ variant = "default" }: { variant?: "default" | "editorial" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locale = useLocale();
  const t = useTranslations("auth");
  const editorial = variant === "editorial";

  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      persistLocalePreference(locale);
      const client = createBrowserSupabase();
      // Supabase requires an exact match with the configured redirect URL.
      // Keep the callback free of query parameters so it matches the production allow list.
      const redirectTo = `${window.location.origin}/auth/handoff`;
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (reason) {
      console.error("Google sign-in failed", reason);
      setError(t("googleFailed"));
      setBusy(false);
    }
  };

  return (
    <div className={editorial ? "profile-guest-google-auth" : undefined}>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        className={editorial
          ? "profile-guest-google-button"
          : "mt-8 flex min-h-12 w-full items-center justify-center gap-3 border border-black/20 bg-[var(--paper)] px-6 text-sm font-semibold text-[var(--walnut)] transition-colors hover:border-[var(--leather)] hover:bg-[var(--cream-deep)] disabled:cursor-wait disabled:opacity-60"}
      >
        {editorial ? (
          <Image src="/assets/matearte/profile-guest-desktop/google.png" alt="" width={35} height={35} aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 18 18" className="size-5" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.615Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.036-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.592.101-1.168.282-1.707V4.961H.956A9 9 0 0 0 0 9c0 1.45.347 2.823.956 4.039l3.008-2.332Z" />
            <path fill="#EA4335" d="M9 3.579c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.008 2.332C4.672 5.164 6.656 3.579 9 3.579Z" />
          </svg>
        )}
        {busy ? t("openGoogle") : t("continueGoogle")}
      </button>
      {error && <p role="alert" className={editorial ? "profile-guest-google-error" : "mt-4 text-sm text-[var(--danger)]"}>{error}</p>}
    </div>
  );
}
