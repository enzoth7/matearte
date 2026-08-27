import { describe, expect, it } from "vitest";
import { countryCallingCode, countryRegions, internationalPhoneNumber, localPhoneNumber } from "./countries";

describe("country profile helpers", () => {
  it("returns the administrative regions for the selected country", () => {
    expect(countryRegions("UY").map((region) => region.name)).toContain("Paysandú");
    expect(countryRegions("AU").map((region) => region.name)).toContain("Queensland");
  });

  it("returns international calling codes", () => {
    expect(countryCallingCode("UY")).toBe("+598");
    expect(countryCallingCode("AU")).toBe("+61");
    expect(countryCallingCode("US")).toBe("+1");
  });

  it("stores a single country prefix and exposes the local number", () => {
    expect(internationalPhoneNumber("UY", "098 633 186")).toBe("+598 098 633 186");
    expect(internationalPhoneNumber("UY", "+598 098 633 186")).toBe("+598 098 633 186");
    expect(localPhoneNumber("+598 098 633 186", "UY")).toBe("098 633 186");
  });
});
