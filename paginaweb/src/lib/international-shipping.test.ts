import { describe, expect, it } from "vitest";
import { countries as countryMetadata } from "countries-list";
import {
  DEFAULT_INTERNATIONAL_SHIPPING_RATES,
  getInternationalShippingRate,
  resolveCountryZone,
  type InternationalShippingZone,
} from "./international-shipping";

describe("international-shipping logic", () => {
  const allZones: InternationalShippingZone[] = [
    "argentina",
    "suramerica",
    "estados_unidos",
    "resto_america",
    "espana",
    "resto_europa",
    "resto_mundo",
  ];

  it("assigns 100% of all worldwide ISO country codes to a valid zone", () => {
    const codes = Object.keys(countryMetadata);
    expect(codes.length).toBeGreaterThan(200);

    for (const code of codes) {
      const zone = resolveCountryZone(code);
      expect(allZones).toContain(zone);
    }
  });

  it("accurately maps key specific destinations by ISO code and text name", () => {
    expect(resolveCountryZone("AR")).toBe("argentina");
    expect(resolveCountryZone("Argentina")).toBe("argentina");

    expect(resolveCountryZone("BR")).toBe("suramerica");
    expect(resolveCountryZone("Brasil")).toBe("suramerica");
    expect(resolveCountryZone("Chile")).toBe("suramerica");
    expect(resolveCountryZone("PY")).toBe("suramerica");

    expect(resolveCountryZone("US")).toBe("estados_unidos");
    expect(resolveCountryZone("Estados Unidos")).toBe("estados_unidos");
    expect(resolveCountryZone("United States")).toBe("estados_unidos");

    expect(resolveCountryZone("ES")).toBe("espana");
    expect(resolveCountryZone("España")).toBe("espana");
    expect(resolveCountryZone("Spain")).toBe("espana");

    expect(resolveCountryZone("MX")).toBe("resto_america");
    expect(resolveCountryZone("México")).toBe("resto_america");
    expect(resolveCountryZone("Canada")).toBe("resto_america");
    expect(resolveCountryZone("Colombia")).toBe("resto_america");

    expect(resolveCountryZone("FR")).toBe("resto_europa");
    expect(resolveCountryZone("Francia")).toBe("resto_europa");
    expect(resolveCountryZone("Alemania")).toBe("resto_europa");
    expect(resolveCountryZone("Italy")).toBe("resto_europa");
    expect(resolveCountryZone("Reino Unido")).toBe("resto_europa");

    expect(resolveCountryZone("JP")).toBe("resto_mundo");
    expect(resolveCountryZone("Japón")).toBe("resto_mundo");
    expect(resolveCountryZone("Australia")).toBe("resto_mundo");
    expect(resolveCountryZone("Sudáfrica")).toBe("resto_mundo");
  });

  it("calculates rates correctly according to weight brackets", () => {
    // 350g -> bracket 1: 250 - 500g
    const rate350Spain = getInternationalShippingRate(350, "ES");
    expect(rate350Spain).not.toBeNull();
    expect(rate350Spain?.rangeLabel).toBe("250 - 500");
    expect(rate350Spain?.zone).toBe("espana");
    expect(rate350Spain?.rate).toBe(3120.5);

    // 850g -> bracket 2: 500 - 1 (1000g)
    const rate850US = getInternationalShippingRate(850, "US");
    expect(rate850US).not.toBeNull();
    expect(rate850US?.rangeLabel).toBe("500 - 1");
    expect(rate850US?.zone).toBe("estados_unidos");
    expect(rate850US?.rate).toBe(3120.5);

    // 2200g (2.2kg) -> bracket 5: 2 - 2,5
    const rate2200Arg = getInternationalShippingRate(2200, "AR");
    expect(rate2200Arg).not.toBeNull();
    expect(rate2200Arg?.rangeLabel).toBe("2 - 2,5");
    expect(rate2200Arg?.zone).toBe("argentina");
    expect(rate2200Arg?.rate).toBe(3299.0);

    // > 20000g (> 20kg) -> bracket 25: 19 - 20 (capped at highest bracket)
    const rateOverMax = getInternationalShippingRate(25000, "resto_mundo");
    expect(rateOverMax).not.toBeNull();
    expect(rateOverMax?.rangeLabel).toBe("19 - 20");
    expect(rateOverMax?.rate).toBe(13718.5);
  });

  it("has 25 complete weight tiers in DEFAULT_INTERNATIONAL_SHIPPING_RATES", () => {
    expect(DEFAULT_INTERNATIONAL_SHIPPING_RATES).toHaveLength(25);
    for (const row of DEFAULT_INTERNATIONAL_SHIPPING_RATES) {
      for (const zone of allZones) {
        expect(row[zone]).toBeGreaterThan(0);
      }
    }
  });
});
