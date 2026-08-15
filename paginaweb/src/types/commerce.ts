import type { Money } from "./catalog";

export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: Money;
};

export type CheckoutResult = {
  checkoutUrl: string;
};

export interface CommerceAdapter {
  readonly provider: string;
  readonly enabled: boolean;
  addItem(item: CartItem): Promise<void>;
  removeItem(productId: string, variantId: string): Promise<void>;
  createCheckout(items: CartItem[]): Promise<CheckoutResult>;
}

export const commerceConfig = {
  enabled: process.env.NEXT_PUBLIC_COMMERCE_ENABLED === "true",
  provider: process.env.NEXT_PUBLIC_COMMERCE_PROVIDER ?? "unavailable",
} as const;

export function isCommerceAvailable() {
  return commerceConfig.enabled && commerceConfig.provider !== "unavailable";
}
