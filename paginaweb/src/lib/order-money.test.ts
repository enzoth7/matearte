import { describe, expect, it } from "vitest";
import { formatOrderMoney } from "@/lib/order-money";

const order = {
  total_minor: 549900,
  currency: "UYU",
  paypal_amount_usd_minor: 13412,
};

describe("formatOrderMoney", () => {
  it("uses the exact historical PayPal amount in English", () => {
    expect(formatOrderMoney(order, order.total_minor, "en", { USD: 41 })).toBe("US$ 134.12");
  });

  it("scales breakdown rows from the historical PayPal amount", () => {
    expect(formatOrderMoney(order, 220000, "en", { USD: 41 })).toBe("US$ 53.66");
  });

  it("uses the storefront exchange rate for Portuguese", () => {
    expect(formatOrderMoney(order, order.total_minor, "pt", { BRL: 7.5 })).toBe("R$ 733");
  });

  it("keeps Spanish orders in their stored currency", () => {
    expect(formatOrderMoney(order, order.total_minor, "es", { USD: 41 })).toBe("$ 5.499 UYU");
  });
});
