import { describe, expect, it } from "vitest";
import { assertWebAvailableCart } from "./cart";

const item = (available_web: boolean, published = true, active = true) => ({
  item_type: "catalog",
  variant: { active, available_web, product: { published } },
});

describe("disponibilidad web al confirmar un carrito abierto", () => {
  it("permite una variante activa y publicada", () => {
    expect(() => assertWebAvailableCart({ items: [item(true)] })).not.toThrow();
  });

  it("rechaza una variante deshabilitada después de agregarla al carrito", () => {
    expect(() => assertWebAvailableCart({ items: [item(false)] })).toThrow(/no está disponible/);
    expect(() => assertWebAvailableCart({ items: [item(true, false)] })).toThrow(/no está disponible/);
    expect(() => assertWebAvailableCart({ items: [item(true, true, false)] })).toThrow(/no está disponible/);
  });

  it("conserva los diseños personalizados ajenos al catálogo", () => {
    expect(() => assertWebAvailableCart({ items: [{ item_type: "design" }] })).not.toThrow();
  });
});
