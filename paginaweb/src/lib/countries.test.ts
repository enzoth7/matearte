import { describe, expect, it } from "vitest";
import {
  countryCallingCode,
  countryPhoneOptionsForLocale,
  countryRegions,
  internationalPhoneNumber,
  localPhoneNumber,
  parsePhoneNumber,
} from "./countries";

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

  it("returns sorted country phone options with calling code", () => {
    const options = countryPhoneOptionsForLocale("es");
    expect(options.length).toBeGreaterThan(200);
    const uruguay = options.find((o) => o.code === "UY");
    expect(uruguay).toEqual({ code: "UY", callingCode: "+598", name: "Uruguay" });
    const italy = options.find((o) => o.code === "IT");
    expect(italy).toEqual({ code: "IT", callingCode: "+39", name: "Italia" });
  });

  it("parses phone numbers detecting international prefix or using fallback", () => {
    expect(parsePhoneNumber("+598 098 633 186", "UY")).toEqual({
      phoneCountryCode: "UY",
      callingCode: "+598",
      localNumber: "098 633 186",
    });
    expect(parsePhoneNumber("+39 340 1234567", "UY")).toEqual({
      phoneCountryCode: "IT",
      callingCode: "+39",
      localNumber: "340 1234567",
    });
    expect(parsePhoneNumber("098 633 186", "UY")).toEqual({
      phoneCountryCode: "UY",
      callingCode: "+598",
      localNumber: "098 633 186",
    });
    expect(parsePhoneNumber("+1 555 123 4567", "CA")).toEqual({
      phoneCountryCode: "CA",
      callingCode: "+1",
      localNumber: "555 123 4567",
    });
  });
});

