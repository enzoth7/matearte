import { describe, expect, it } from "vitest";
import { argentinaReady, arsPerUyuFromFinanceRate, toArsMinor } from "./argentina";
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
