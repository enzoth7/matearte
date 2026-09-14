export type StaticStoreRedirect = "/" | "/carrito" | "/checkout" | "/perfil";
export type OrderRedirect = `/pedidos/${string}`;
export type StoreRedirect = StaticStoreRedirect | OrderRedirect;

const allowedStoreRedirects = new Set<StaticStoreRedirect>(["/", "/carrito", "/checkout", "/perfil"]);
const orderRedirect = /^\/pedidos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOrderRedirect(value: StoreRedirect): value is OrderRedirect {
  return orderRedirect.test(value);
}

export function safeStoreRedirect(value: string | null | undefined): StoreRedirect | null {
  if (!value) return null;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (allowedStoreRedirects.has(decoded as StaticStoreRedirect)) return decoded as StaticStoreRedirect;
  return orderRedirect.test(decoded) ? decoded as OrderRedirect : null;
}

export function storeOAuthCallbackUrl(origin: string, postLoginRedirect?: string) {
  const callback = new URL("/auth/handoff", origin);
  callback.searchParams.set("flow", "store");
  const safeRedirect = safeStoreRedirect(postLoginRedirect);
  if (safeRedirect) callback.searchParams.set("next", safeRedirect);
  return callback.toString();
}
