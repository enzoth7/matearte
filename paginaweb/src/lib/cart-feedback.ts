import type { CSSProperties } from "react";

export const CART_ADDED_EVENT = "matearte-cart-added";

export type CartAddedDetail = {
  name: string;
  imageSrc?: string;
  imageUnoptimized?: boolean;
  imageStyle?: CSSProperties;
  price: string;
  count: number;
  confirmation: string;
};

export function countCartItems(items: Array<{ quantity?: number }>) {
  return items.reduce((count, item) => count + (Number(item.quantity) || 1), 0);
}

export function notifyCartAdded(detail: CartAddedDetail) {
  window.dispatchEvent(new CustomEvent<CartAddedDetail>(CART_ADDED_EVENT, { detail }));
}
