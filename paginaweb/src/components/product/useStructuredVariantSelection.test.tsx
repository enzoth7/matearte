import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Product } from "@/types/catalog";
import { useStructuredVariantSelection } from "./useStructuredVariantSelection";

const productWithAllSizes: Product = {
  id: "mate-todos",
  slug: "mate-todos",
  name: "Mate en todos los tamaños",
  category: "mates",
  attributes: { tamano: "todos", interior: "calabaza" },
  eyebrow: "Tradicional",
  summary: "Disponible en tres tamaños",
  description: "Mate de cuero",
  materials: ["Cuero"],
  filterData: { priceUYU: 3500, materials: ["cuero"] },
  images: [],
  variants: [
    {
      id: "v-todos",
      label: "Todos los tamaños",
      value: "MATE-TODOS",
      options: {},
      price: { amountMinor: 350000, currency: "UYU" },
    },
  ],
};

describe("useStructuredVariantSelection", () => {
  it("ofrece todos los tamaños del producto sin crear variantes por tamaño", () => {
    const { result } = renderHook(() => useStructuredVariantSelection(productWithAllSizes));

    expect(result.current.axes).toEqual([
      { code: "tamano", label: "Tamaño", values: [{ value: "chico", label: "Chico" }, { value: "mediano", label: "Mediano" }, { value: "grande", label: "Grande" }] },
      { code: "interior", label: "Interior", values: [{ value: "calabaza", label: "Calabaza" }] },
    ]);
    expect(result.current.complete).toBe(false);

    act(() => result.current.select("tamano", "mediano"));

    expect(result.current.selected.tamano).toBe("mediano");
    expect(result.current.activeVariant?.id).toBe("v-todos");
    expect(result.current.complete).toBe(true);
  });
});
