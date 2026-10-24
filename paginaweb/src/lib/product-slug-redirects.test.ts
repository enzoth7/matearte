import { describe, expect, it } from "vitest";
import { productSlugRedirectRules, productSlugRedirects, unpublishedSlugChanges } from "@/lib/product-slug-redirects";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("redirecciones de URLs de producto", () => {
  const sources = productSlugRedirects.map(([from]) => from);
  const targets = productSlugRedirects.map(([, to]) => to);

  it("usa slugs válidos, sin repetidos ni cambios que no cambian nada", () => {
    for (const [from, to] of [...productSlugRedirects, ...unpublishedSlugChanges]) {
      expect(from).toMatch(slugPattern);
      expect(to).toMatch(slugPattern);
      expect(to).not.toBe(from);
    }
    expect(new Set(sources).size).toBe(sources.length);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("ningún destino es el origen de otra redirección: no hay cadenas ni ciclos", () => {
    const sourceSet = new Set(sources);
    expect(targets.filter((target) => sourceSet.has(target))).toEqual([]);
  });

  it("no deja ningún slug que diga mayorista", () => {
    expect(targets.filter((target) => target.includes("mayorista"))).toEqual([]);
    expect(sources.filter((source) => source.startsWith("mayorista-")).length).toBeGreaterThan(0);
  });

  it("publica una regla permanente por idioma y producto", () => {
    const rules = productSlugRedirectRules();
    expect(rules).toHaveLength(productSlugRedirects.length * 3);
    expect(rules).toContainEqual({ source: "/producto/mayorista-40", destination: "/producto/bombilla-cincelada", permanent: true });
    expect(rules).toContainEqual({ source: "/en/product/mayorista-40", destination: "/en/product/bombilla-cincelada", permanent: true });
    expect(rules).toContainEqual({ source: "/pt/produto/mayorista-40", destination: "/pt/produto/bombilla-cincelada", permanent: true });
  });
});
