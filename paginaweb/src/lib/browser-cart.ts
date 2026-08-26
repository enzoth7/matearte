export type LocalCartEntry = { variantId: string; quantity: number };
const KEY = "matearte_visitor_cart_v1";
const MERGE_KEY = "matearte_visitor_cart_merge_key";

export function readLocalCart(): LocalCartEntry[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
export function addLocalCartItem(variantId: string, quantity = 1) {
  const cart = readLocalCart(); const item = cart.find((entry) => entry.variantId === variantId);
  if (item) item.quantity = Math.min(99, item.quantity + quantity); else cart.push({ variantId, quantity });
  localStorage.setItem(KEY, JSON.stringify(cart)); window.dispatchEvent(new Event("matearte-cart-change"));
}
export function localMergeKey() {
  let key = localStorage.getItem(MERGE_KEY); if (!key) { key = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(MERGE_KEY, key); } return key;
}
export function clearLocalCart() { localStorage.removeItem(KEY); localStorage.removeItem(MERGE_KEY); window.dispatchEvent(new Event("matearte-cart-change")); }
