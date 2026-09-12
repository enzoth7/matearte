import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale, Product } from "@/types/catalog";
import { ProductSpecsBox } from "./ProductSpecsBox";

const emptyProduct: Product = {
  id: "test-product",
  slug: "test-product",
  name: "Test Product",
  category: "otros",
  eyebrow: "Eyebrow",
  summary: "Summary",
  description: "Description",
  materials: [],
  filterData: { materials: [] },
  images: [],
  variants: [],
};

function renderBox(product: Product, selectedOptions?: Record<string, any>, activeVariant?: any, locale: Locale = "es") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <ProductSpecsBox product={product} selectedOptions={selectedOptions} activeVariant={activeVariant} />
    </NextIntlClientProvider>
  );
}

describe("ProductSpecsBox", () => {
  afterEach(() => {
    cleanup();
  });

  it("retorna null si no hay características para mostrar", () => {
    const { container } = renderBox(emptyProduct);
    expect(container.firstChild).toBeNull();
  });

  it("muestra título y atributos básicos en español", () => {
    const product: Product = {
      ...emptyProduct,
      materials: ["Cuero"],
      attributes: {
        forma: "cuadrada",
        genero: "hombre",
        "largo-cinto-cm": 110,
      },
    };
    renderBox(product, undefined, undefined, "es");

    expect(screen.getByText("Características")).toBeInTheDocument();
    expect(screen.getByText("Material:")).toBeInTheDocument();
    expect(screen.getByText("Cuero")).toBeInTheDocument();
    expect(screen.getByText("Forma:")).toBeInTheDocument();
    expect(screen.getByText("Cuadrada")).toBeInTheDocument();
    expect(screen.getByText("Género:")).toBeInTheDocument();
    expect(screen.getByText("Hombre")).toBeInTheDocument();
    expect(screen.getByText("Largo del cinto:")).toBeInTheDocument();
    expect(screen.getByText("110 cm")).toBeInTheDocument();
  });

  it("muestra título y atributos en inglés", () => {
    const product: Product = {
      ...emptyProduct,
      attributes: {
        forma: "ovalada",
        genero: "mujer",
        "largo-cinto-cm": 105,
      },
    };
    renderBox(product, undefined, undefined, "en");

    expect(screen.getByText("Specifications")).toBeInTheDocument();
    expect(screen.getByText("Shape:")).toBeInTheDocument();
    expect(screen.getByText("Oval")).toBeInTheDocument();
    expect(screen.getByText("Gender:")).toBeInTheDocument();
    expect(screen.getByText("Women")).toBeInTheDocument();
    expect(screen.getByText("Belt length:")).toBeInTheDocument();
    expect(screen.getByText("105 cm")).toBeInTheDocument();
  });

  it("muestra título y atributos en portugués", () => {
    const product: Product = {
      ...emptyProduct,
      attributes: {
        genero: "unisex",
        "largo-cinto-cm": 120,
      },
    };
    renderBox(product, undefined, undefined, "pt");

    expect(screen.getByText("Características")).toBeInTheDocument();
    expect(screen.getByText("Gênero:")).toBeInTheDocument();
    expect(screen.getByText("Unissex")).toBeInTheDocument();
    expect(screen.getByText("Comprimento do cinto:")).toBeInTheDocument();
    expect(screen.getByText("120 cm")).toBeInTheDocument();
  });

  it("muestra color y tamaño seleccionados dinámicamente", () => {
    const product: Product = {
      ...emptyProduct,
      category: "mates",
      attributes: { "tipo-mate": "imperial" },
      variants: [
        { id: "v1", label: "Marrón Grande", value: "v1", options: { color: "marron", tamano: "grande" } },
      ],
    };
    renderBox(product, { color: "marron", tamano: "grande" }, undefined, "es");

    expect(screen.getByText("Modelo de mate:")).toBeInTheDocument();
    expect(screen.getByText("Imperial")).toBeInTheDocument();
    expect(screen.getByText("Color:")).toBeInTheDocument();
    expect(screen.getByText("Marrón")).toBeInTheDocument();
    expect(screen.getByText("Tamaño:")).toBeInTheDocument();
    expect(screen.getByText("Grande")).toBeInTheDocument();
  });

  it("describe los tres tamaños antes de elegir una variante marcada como todos", () => {
    const product: Product = {
      ...emptyProduct,
      category: "mates",
      variants: [
        { id: "v-todos", label: "Todos los tamaños", value: "v-todos", options: { tamano: "todos" } },
      ],
    };
    renderBox(product, {}, undefined, "es");

    expect(screen.getByText("Tamaño:")).toBeInTheDocument();
    expect(screen.getByText("Chico, Mediano, Grande")).toBeInTheDocument();
  });

  it("muestra atributos de cuchillos", () => {
    const product: Product = {
      ...emptyProduct,
      category: "cuchillos",
      attributes: {
        "tipo-cuchillo": "facon",
        "largo-hoja-mm": 180,
        "material-cabo": "asta-guampa",
        "material-vaina": "cuero-crudo",
      },
    };
    renderBox(product, undefined, undefined, "es");

    expect(screen.getByText("Tipo de cuchillo:")).toBeInTheDocument();
    expect(screen.getByText("Facón")).toBeInTheDocument();
    expect(screen.getByText("Largo de hoja:")).toBeInTheDocument();
    expect(screen.getByText("180 mm")).toBeInTheDocument();
    expect(screen.getByText("Material del cabo:")).toBeInTheDocument();
    expect(screen.getByText("Asta o guampa")).toBeInTheDocument();
    expect(screen.getByText("Material de la vaina:")).toBeInTheDocument();
    expect(screen.getByText("Cuero crudo")).toBeInTheDocument();
  });

  it("muestra atributos de bombillas", () => {
    const product: Product = {
      ...emptyProduct,
      category: "bombillas",
      attributes: {
        "tipo-bombilla": "bombillon",
        "forma-pico": "pico-loro",
        "material-cuerpo": "alpaca",
        decoracion: "cincelada",
      },
    };
    renderBox(product, undefined, undefined, "es");

    expect(screen.getByText("Tipo de bombilla:")).toBeInTheDocument();
    expect(screen.getByText("Bombillón")).toBeInTheDocument();
    expect(screen.getByText("Forma del pico:")).toBeInTheDocument();
    expect(screen.getByText("Pico loro")).toBeInTheDocument();
    expect(screen.getByText("Material del cuerpo:")).toBeInTheDocument();
    expect(screen.getByText("Alpaca")).toBeInTheDocument();
    expect(screen.getByText("Decoración:")).toBeInTheDocument();
    expect(screen.getByText("Cincelada")).toBeInTheDocument();
  });

  it("muestra talle y capacidad", () => {
    const product: Product = {
      ...emptyProduct,
      attributes: {
        talle: 42,
        "capacidad-ml": 1000,
      },
    };
    renderBox(product, undefined, undefined, "es");

    expect(screen.getByText("Talle:")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Capacidad:")).toBeInTheDocument();
    expect(screen.getByText("1000 ml")).toBeInTheDocument();
  });
});
