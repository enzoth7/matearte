import { describe, expect, it } from "vitest";
import { customerTestimonials, destinationCountries, getLocalizedInternationalData, testimonialRows } from "@/data/international-clients";

describe("clientes internacionales", () => {
  it("registra los veinte destinos solicitados sin duplicados", () => {
    expect(destinationCountries).toHaveLength(20);
    expect(new Set(destinationCountries.map((country) => country.code)).size).toBe(20);
  });

  it("mantiene los destinos en orden alfabético", () => {
    const names = destinationCountries.map((country) => country.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })));
  });

  it("publica las veinte reseñas reales con procedencia identificada", () => {
    expect(customerTestimonials).toHaveLength(20);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "AU")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "CL")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "RU")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "UY")).toHaveLength(11);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "ES")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "AR")).toHaveLength(2);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "GB")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "IT")).toHaveLength(1);
    expect(customerTestimonials.filter((testimonial) => testimonial.countryCode === "PH")).toHaveLength(1);
    expect(customerTestimonials.every((testimonial) => testimonial.sourceLabel.length > 0)).toBe(true);
  });

  it("distribuye las veinte reseñas en dos filas y traduce review-13 y los nuevos testimonios", () => {
    expect(testimonialRows[0].testimonials).toHaveLength(10);
    expect(testimonialRows[1].testimonials).toHaveLength(10);

    for (const locale of ["en", "pt"] as const) {
      const data = getLocalizedInternationalData(locale);
      expect(data.testimonialRows[0].testimonials).toHaveLength(10);
      expect(data.testimonialRows[1].testimonials).toHaveLength(10);
      const clReview = data.testimonialRows[1].testimonials.find((t) => t.id === "review-13");
      expect(clReview).toBeDefined();
      expect(clReview?.quote).toBe(locale === "en" ? "A dream!" : "Um sonho!");
      expect(clReview?.authorTitle).toBe("Chile");

      const allTestimonials = [...data.testimonialRows[0].testimonials, ...data.testimonialRows[1].testimonials];

      const r14 = allTestimonials.find((t) => t.id === "review-14");
      expect(r14).toBeDefined();
      expect(r14?.quote).toBe(locale === "en" ? "Loving it!" : "Amando!");
      expect(r14?.authorTitle).toBe(locale === "en" ? "Spain" : "Espanha");

      const r15 = allTestimonials.find((t) => t.id === "review-15");
      expect(r15).toBeDefined();
      expect(r15?.quote).toBe(locale === "en" ? "My perfect companion!" : "Meu companheiro perfeito!");
      expect(r15?.authorTitle).toBe("Argentina");

      const r16 = allTestimonials.find((t) => t.id === "review-16");
      expect(r16).toBeDefined();
      expect(r16?.quote).toBe(locale === "en" ? "Perfect for the mornings!" : "Perfeito para as manhãs!");
      expect(r16?.authorTitle).toBe("Argentina");

      const r17 = allTestimonials.find((t) => t.id === "review-17");
      expect(r17).toBeDefined();
      expect(r17?.quote).toBe(locale === "en" ? "Custom mates, made by Uruguayan hands, and divine products." : "Mates personalizados, feitos por mãos uruguaias e produtos divinos.");
      expect(r17?.authorTitle).toBe(locale === "en" ? "Uruguay" : "Uruguai");

      const r18 = allTestimonials.find((t) => t.id === "review-18");
      expect(r18).toBeDefined();
      expect(r18?.quote).toBe("Feel good");
      expect(r18?.authorTitle).toBe(locale === "en" ? "United Kingdom" : "Reino Unido");

      const r19 = allTestimonials.find((t) => t.id === "review-19");
      expect(r19).toBeDefined();
      expect(r19?.quote).toBe(locale === "en" ? "Perfect for studying." : "Perfeito para estudar.");
      expect(r19?.authorTitle).toBe(locale === "en" ? "Italy" : "Itália");

      const r20 = allTestimonials.find((t) => t.id === "review-20");
      expect(r20).toBeDefined();
      expect(r20?.quote).toBe(locale === "en" ? "Perfect!" : "Perfeitos!");
      expect(r20?.authorTitle).toBe(locale === "en" ? "Philippines" : "Filipinas");
    }
  });
});
