const STORE_AUTH_QUERY_KEYS = ["code", "error", "error_code", "error_description"] as const;
const PROFILE_REQUIRED_ACTIONS = new Set(["save-personalizer", "save-summary", "checkout"]);

type BrowserLocation = Pick<Location, "origin" | "pathname" | "search">;

export function getMisroutedStoreAuthCallbackUrl(
  location: BrowserLocation,
  configuredMainSite?: string,
) {
  if (location.pathname !== "/") return null;

  const incoming = new URLSearchParams(location.search);
  if (!incoming.has("code") && !incoming.has("error")) return null;

  const mainSite = (configuredMainSite || "http://localhost:3000").trim().replace(/\/$/, "");
  const callback = new URL("/auth/handoff", mainSite);
  if (callback.origin === location.origin) return null;

  callback.searchParams.set("flow", "store");
  for (const key of STORE_AUTH_QUERY_KEYS) {
    const value = incoming.get(key);
    if (value) callback.searchParams.set(key, value);
  }
  return callback.toString();
}

export function shouldCompleteProfileInPersonalizer(
  profileComplete: boolean | undefined,
  pendingAuthAction: string | null,
) {
  return !profileComplete
    && pendingAuthAction !== null
    && PROFILE_REQUIRED_ACTIONS.has(pendingAuthAction);
}

export function shouldLeaveAccessAfterAuthentication({
  step,
  handoffPending,
  pendingAuthAction,
  authenticated,
}: {
  step: string;
  handoffPending: boolean;
  pendingAuthAction: string | null;
  authenticated: boolean;
}) {
  return step === "access" && !handoffPending && !pendingAuthAction && authenticated;
}
