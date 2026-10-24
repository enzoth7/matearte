import { describe, expect, it } from "vitest";
import { getMateSizePreviewImage } from "./mateSizePreviewImages";
import { formatSelectionPrice } from "./selectionPriceUtils";

describe("precio de las opciones del mate", () => {
  it("muestra un estado pendiente cuando todavía no llegó el precio", () => {
    expect(formatSelectionPrice(null)).toBe("Precio no disponible");
    expect(formatSelectionPrice(null, "Precio pendiente", true, true)).toBe("Precio pendiente");
  });

  it("formatea precios base y adicionales disponibles", () => {
    expect(formatSelectionPrice(1800, undefined, true)).toContain("Desde");
    expect(formatSelectionPrice(600, undefined, false, true)).toContain("+");
  });
});

describe("imágenes del selector de tamaños", () => {
  it("usa los mates Torpedo nuevos para el Torpedo común", () => {
    expect(getMateSizePreviewImage({ familyId: "torpedo" }, "chico").src)
      .toBe("/assets2/personalizacion/tamanostorpedo/torpedo-chico.png");
  });

  it("usa los mates Torpedo nuevos para el Torpedo criollo", () => {
    expect(getMateSizePreviewImage({ familyId: "criollo", textureId: "torpedo-criollo-posa-mate" }, "grande").src)
      .toBe("/assets2/personalizacion/tamanostorpedo/torpedo-grande.png");
  });

  it("conserva las imágenes actuales para los demás modelos", () => {
    expect(getMateSizePreviewImage({ familyId: "imperial" }, "medio").src)
      .toBe("/assets2/personalizacion/tamanos/boca-medio.png");
  });
});
