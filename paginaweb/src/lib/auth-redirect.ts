export type StoreRedirect = "/" | "/carrito" | "/checkout" | "/perfil";

const allowedStoreRedirects = new Set<StoreRedirect>(["/", "/carrito", "/checkout", "/perfil"]);

export function safeStoreRedirect(value: string | null | undefined): StoreRedirect | null {
  if (!value) return null;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  return allowedStoreRedirects.has(decoded as StoreRedirect) ? decoded as StoreRedirect : null;
}

export function storeOAuthCallbackUrl(origin: string, postLoginRedirect?: string) {
  const callback = new URL("/auth/handoff", origin);
  callback.searchParams.set("flow", "store");
  const safeRedirect = safeStoreRedirect(postLoginRedirect);
  if (safeRedirect) callback.searchParams.set("next", safeRedirect);
  return callback.toString();
}
