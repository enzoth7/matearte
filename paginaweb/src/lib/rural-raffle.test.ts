import { describe, expect, it } from "vitest";
import { normalizeUruguayPhone, parseRuralRaffleEntry } from "./rural-raffle";

describe("normalizeUruguayPhone", () => {
  it("normalizes an eight digit Uruguayan mobile number", () => {
    expect(normalizeUruguayPhone("091 674 231")).toBe("+59891674231");
  });

  it("preserves an explicit country code", () => {
    expect(normalizeUruguayPhone("+598 91 674 231")).toBe("+59891674231");
  });

  it("rejects incomplete numbers", () => {
    expect(normalizeUruguayPhone("1234")).toBeNull();
  });
});

describe("parseRuralRaffleEntry", () => {
  it("returns a clean valid entry", () => {
    const data = new FormData();
    data.set("email", " Persona@Example.com ");
    data.set("phone", "099 123 456");
    data.set("productInterest", "mates");
    data.set("privacyConsent", "on");

    expect(parseRuralRaffleEntry(data)).toEqual({
      ok: true,
      value: {
        email: "persona@example.com",
        phone: "+59899123456",
        productInterest: "mates",
        marketingOptIn: false,
      },
    });
  });

  it("requires participation consent", () => {
    const data = new FormData();
    data.set("email", "persona@example.com");
    data.set("phone", "099 123 456");
    data.set("productInterest", "mates");

    expect(parseRuralRaffleEntry(data)).toEqual({ ok: false, reason: "consent-required" });
  });

  it("accepts the new leather-product choices and rejects removed ones", () => {
    const data = new FormData();
    data.set("email", "persona@example.com");
    data.set("phone", "099 123 456");
    data.set("productInterest", "botas");
    data.set("privacyConsent", "on");
    expect(parseRuralRaffleEntry(data)).toMatchObject({ ok: true, value: { productInterest: "botas" } });

    data.set("productInterest", "regalos-empresariales");
    expect(parseRuralRaffleEntry(data)).toEqual({ ok: false, reason: "invalid" });
  });
});
