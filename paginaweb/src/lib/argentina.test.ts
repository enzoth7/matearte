import { describe, expect, it } from "vitest";
import { argentinaDiscountMinor, argentinaReady, arsPerUyuFromFinanceRate, toArsMinor } from "./argentina";
import { formatMoney } from "./money";
import { formatOrderMoney } from "./order-money";
import { validateReceipt } from "./transfer-receipt";

describe("Argentina retail prices and receipts", () => {
  it("uses the ARS finance rate in UYU per peso, without a second editable rate", () => {
    expect(arsPerUyuFromFinanceRate(0.04)).toBe(25);
    expect(toArsMinor(10000, arsPerUyuFromFinanceRate("0.04"))).toBe(250000);
    expect(arsPerUyuFromFinanceRate(0.01)).toBe(100);
    for (const rate of [null, undefined, 0, -1, Infinity, "invalid"]) expect(arsPerUyuFromFinanceRate(rate)).toBe(0);
  });
  it("rounds each unit to the nearest ARS 50 and rejects invalid rates", () => {
    expect(toArsMinor(12345, 30.5)).toBe(375000);
    expect(toArsMinor(673300, 1)).toBe(675000);
    expect(toArsMinor(680200, 1)).toBe(680000);
    expect(toArsMinor(672500, 1)).toBe(675000);
    expect(() => toArsMinor(100, 0)).toThrow();
    expect(() => toArsMinor(-1, 30)).toThrow();
    expect(() => toArsMinor(100, Infinity)).toThrow();
  });
  it("rounds percentage coupons on ARS prices and converts fixed UYU coupons", () => {
    expect(argentinaDiscountMinor({ discountType: "percentage", discountValue: 10, applicability: "categories", categoryCodes: ["mates"] },
      1000000, 200000, { mates: 350000, otros: 450000 }, 30)).toBe(35000);
    expect(argentinaDiscountMinor({ discountType: "fixed", discountValue: 100, applicability: "all_items" },
      1000000, 0, { mates: 1000000 }, 30)).toBe(300000);
    expect(() => argentinaDiscountMinor({ discountType: "fixed", discountValue: 1000, applicability: "all_items" },
      1000000, 0, { mates: 1000000 }, 30)).toThrow("discount:not_applicable");
  });
  it("keeps an ARS order unchanged after a rate or language change", () => {
    const order = { currency: "ARS", total_minor: 376500 };
    expect(formatOrderMoney(order, order.total_minor, "en", { ARS: 0.01, USD: 40 })).toBe("$ 3.765 ARS");
    expect(formatOrderMoney(order, order.total_minor, "pt", { ARS: 0.1, BRL: 7 })).toBe("$ 3.765 ARS");
    expect(formatMoney(12345, "UYU", "es", { ARS: 1 / 30.5 }, "ARS")).toBe("$ 3.750 ARS");
  });
  it("does not enable Argentina without complete real configuration", () => {
    expect(argentinaReady(null)).toBe(false);
    expect(argentinaReady({ enabled: true, ars_per_uyu: 30, bank_name: "", account_holder: "", cbu: "", alias: "" })).toBe(false);
    expect(argentinaReady({ enabled: true, ars_per_uyu: 30, bank_name: "BBVA Argentina", account_holder: "", cbu: "0170119340000000993887", alias: "MATEARTE.COLON" })).toBe(true);
  });
  it("checks both file type and content before accepting a receipt", () => {
    expect(validateReceipt("application/pdf", new TextEncoder().encode("%PDF-1.7 test"))).toBe("pdf");
    expect(() => validateReceipt("image/png", new Uint8Array([137]))).toThrow();
    expect(() => validateReceipt("application/pdf", new TextEncoder().encode("<script>bad</script>"))).toThrow();
    expect(() => validateReceipt("application/pdf", new Uint8Array(5 * 1024 * 1024 + 1))).toThrow();
  });
});
