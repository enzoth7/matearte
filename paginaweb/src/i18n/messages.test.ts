import { describe, expect, it } from "vitest";
import es from "../../messages/es.json";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";
import { catalogTranslationCoverage } from "@/content/catalog-localization";
import { products } from "@/data/catalog";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => messageKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("traducciones públicas", () => {
  it("mantiene exactamente la misma estructura en los tres idiomas", () => {
    const canonical = messageKeys(es).sort();
    expect(messageKeys(en).sort()).toEqual(canonical);
    expect(messageKeys(pt).sort()).toEqual(canonical);
  });

  it("incluye todos los mensajes del descuento del checkout", () => {
    for (const messages of [es, en, pt]) {
      expect(messages.checkout.discountToggle).toBeTruthy();
      expect(messages.checkout.discountCodeLabel).toBeTruthy();
      expect(messages.checkout.discountValidate).toBeTruthy();
      expect(messages.checkout.discountValidating).toBeTruthy();
      expect(messages.checkout.discountApplied).toContain("{code}");
      expect(Object.keys(messages.checkout.discountErrors).sort()).toEqual([
        "already_used",
        "disabled",
        "expired",
        "in_use",
        "invalid",
        "not_applicable",
        "not_found",
        "not_started",
      ]);
    }
  });

  it("incluye una traducción editorial para cada producto", () => {
    const ids = products.map((product) => product.id).sort();
    expect([...catalogTranslationCoverage.en].sort()).toEqual(ids);
    expect([...catalogTranslationCoverage.pt].sort()).toEqual(ids);
  });
});
