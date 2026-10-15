import { describe, expect, it } from "vitest";
import { commerceCustomerName, commerceMoney, visibleInCommerceAdmin, type CommerceOrder } from "./commerceSource";

const order = (status: string, purchaseFlow?: string) => ({
  status,
  customer_snapshot: purchaseFlow ? { purchaseFlow } : {},
}) as CommerceOrder;

describe("lectura compatible con commerce-admin", () => {
  it("mantiene los centésimos de UYU como importe al mostrarlos", () => {
    expect(commerceMoney(123456)).toContain("1.234,56");
    expect(commerceMoney(1250)).toContain("12,5");
  });

  it("oculta pagos PayPal que commerce-admin tampoco muestra", () => {
    expect(visibleInCommerceAdmin(order("pending_payment", "international_paypal"))).toBe(false);
    expect(visibleInCommerceAdmin(order("payment_failed", "international_paypal"))).toBe(false);
    expect(visibleInCommerceAdmin(order("shipped", "international_paypal"))).toBe(true);
    expect(visibleInCommerceAdmin(order("pending_payment"))).toBe(true);
  });

  it("toma el nombre guardado en la instantánea del pedido", () => {
    expect(commerceCustomerName({ fullName: "Ana Díaz", email: "ana@example.com" })).toBe("Ana Díaz");
    expect(commerceCustomerName({ email: "ana@example.com" })).toBe("ana@example.com");
  });
});
