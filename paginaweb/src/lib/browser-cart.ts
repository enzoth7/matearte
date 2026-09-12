import { normalizeCatalogValueMap, optionSignature, type CatalogValueMap } from "../../../shared/catalog-taxonomy";

export type LocalCartEntry = { variantId: string; quantity: number; optionValues?: CatalogValueMap };
const KEY = "matearte_visitor_cart_v1";
const MERGE_KEY = "matearte_visitor_cart_merge_key";

export function readLocalCart(): LocalCartEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): LocalCartEntry[] => {
      if (!entry || typeof entry !== "object" || typeof entry.variantId !== "string") return [];
      const quantity = Math.max(1, Math.min(99, Number(entry.quantity) || 1));
      const optionValues = normalizeCatalogValueMap(entry.optionValues);
      return [{ variantId: entry.variantId, quantity, ...(Object.keys(optionValues).length ? { optionValues } : {}) }];
    });
  } catch { return []; }
}

export function localCartEntryKey(entry: Pick<LocalCartEntry, "variantId" | "optionValues">) {
  return `${entry.variantId}:${optionSignature(normalizeCatalogValueMap(entry.optionValues))}`;
}

export function addLocalCartItem(variantId: string, quantity = 1, optionValues?: CatalogValueMap) {
  const cart = readLocalCart();
  const normalizedOptions = normalizeCatalogValueMap(optionValues);
  const key = localCartEntryKey({ variantId, optionValues: normalizedOptions });
  const item = cart.find((entry) => localCartEntryKey(entry) === key);
  if (item) item.quantity = Math.min(99, item.quantity + quantity);
  else cart.push({ variantId, quantity, ...(Object.keys(normalizedOptions).length ? { optionValues: normalizedOptions } : {}) });
  localStorage.setItem(KEY, JSON.stringify(cart)); window.dispatchEvent(new Event("matearte-cart-change"));
}

export function removeLocalCartItem(lineKey: string) {
  localStorage.setItem(KEY, JSON.stringify(readLocalCart().filter((entry) => localCartEntryKey(entry) !== lineKey)));
  window.dispatchEvent(new Event("matearte-cart-change"));
}

export function updateLocalCartItemQuantity(lineKey: string, quantity: number) {
  if (quantity <= 0) return removeLocalCartItem(lineKey);
  const cart = readLocalCart();
  const item = cart.find((entry) => localCartEntryKey(entry) === lineKey);
  if (!item) return;
  item.quantity = Math.min(99, quantity);
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("matearte-cart-change"));
}
export function localMergeKey() {
  let key = localStorage.getItem(MERGE_KEY); if (!key) { key = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(MERGE_KEY, key); } return key;
}
export function clearLocalCart() { localStorage.removeItem(KEY); localStorage.removeItem(MERGE_KEY); window.dispatchEvent(new Event("matearte-cart-change")); }
