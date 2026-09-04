import { describe, expect, it } from "vitest";
import { customerTestimonials, destinationCountries } from "@/data/international-clients";

describe("clientes internacionales", () => {
  it("registra los diecisiete destinos solicitados sin duplicados", () => {
    expect(destinationCountries).toHaveLength(17);
    expect(new Set(destinationCountries.map((country) => country.code)).size).toBe(17);
  });

  it("mantiene los destinos en orden alfabético", () => {
    const names = destinationCountries.map((country) => country.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })));
  });

  it("publica las once reseñas reales con procedencia identificada", () => {
    expect(customerTestimonials).toHaveLength(11);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "AU")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "UY")).toHaveLength(10);
    expect(customerTestimonials.every((testimonial) => testimonial.sourceLabel.length > 0)).toBe(true);
  });
});
