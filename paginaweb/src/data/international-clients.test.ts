import { describe, expect, it } from "vitest";
import { demoTestimonials, destinationCountries } from "@/data/international-clients";

describe("clientes internacionales", () => {
  it("registra los trece destinos solicitados sin duplicados", () => {
    expect(destinationCountries).toHaveLength(13);
    expect(new Set(destinationCountries.map((country) => country.code)).size).toBe(13);
  });

  it("mantiene los veinte testimonios como contenido demostrativo", () => {
    expect(demoTestimonials).toHaveLength(20);
    expect(demoTestimonials.every((testimonial) => testimonial.isDemo)).toBe(true);
    expect(demoTestimonials.every((testimonial) => destinationCountries.some((country) => country.code === testimonial.countryCode))).toBe(true);
  });
});
