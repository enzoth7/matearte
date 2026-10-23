import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale, Product } from "@/types/catalog";
import esMessages from "../../../messages/es.json";
import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt.json";
import { StructuredVariantPicker } from "./StructuredVariantPicker";

afterEach(() => {
  cleanup();
});

const mockProduct: Product = {
  id: "mate-imperial",
  slug: "mate-imperial",
  name: "Mate Imperial",
  category: "mates",
  eyebrow: "Tradicional",
  summary: "Mate tradicional",
  description: "Mate de cuero",
  materials: ["Cuero"],
  filterData: { priceUYU: 3500, materials: ["cuero"] },
  images: [],
  variants: [
    { id: "v-chico", label: "Chico", value: "chico", options: { tamano: "chico" } },
    { id: "v-mediano", label: "Mediano", value: "mediano", options: { tamano: "mediano" } },
    { id: "v-grande", label: "Grande", value: "grande", options: { tamano: "grande" } },
  ],
};

function renderWithLocale(ui: React.ReactElement, locale: Locale = "es", messages = esMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("StructuredVariantPicker", () => {
  it("explica cuando la medida todavía no está configurada", () => {
    renderWithLocale(<StructuredVariantPicker product={mockProduct} axes={[{ code: "largo-mm", label: "Largo", values: [] }]} selected={{}} onSelect={vi.fn()} />);
    expect(screen.getByText("Medida pendiente de configurar. Todavía no se puede agregar al carrito.")).toBeInTheDocument();
  });
  it("muestra la elección de interior junto al tamaño", () => {
    const onSelect = vi.fn();
    renderWithLocale(
      <StructuredVariantPicker
        product={mockProduct}
        axes={[
          { code: "tamano", label: "Tamaño", values: [{ value: "mediano", label: "Mediano" }] },
          { code: "interior", label: "Interior", values: [{ value: "calabaza", label: "Calabaza" }, { value: "ceramica", label: "Cerámica" }] },
        ]}
        selected={{ tamano: "mediano" }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Interior")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Interior Cerámica" }));
    expect(onSelect).toHaveBeenCalledWith("interior", "ceramica");
  });
  it("renderiza labels y opciones de tamaño en español", () => {
    const onSelect = vi.fn();
    renderWithLocale(
      <StructuredVariantPicker
        product={mockProduct}
        axes={[{ code: "tamano", label: "Tamaño", values: ["chico", "mediano", "grande"].map(value => ({ value, label: value })) }]}
        selected={{ tamano: "chico" }}
        onSelect={onSelect}
      />,
      "es",
      esMessages,
    );

    expect(screen.getByText("Tamaño")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chico" })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Mediano" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grande" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mediano" }));
    expect(onSelect).toHaveBeenCalledWith("tamano", "mediano");
  });

  it("renderiza labels y opciones de tamaño en inglés", () => {
    renderWithLocale(
      <StructuredVariantPicker
        product={mockProduct}
        axes={[{ code: "tamano", label: "Tamaño", values: ["chico", "mediano", "grande"].map(value => ({ value, label: value })) }]}
        selected={{}}
        onSelect={vi.fn()}
      />,
      "en",
      enMessages,
    );

    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Small" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Large" })).toBeInTheDocument();
  });

  it("renderiza labels y opciones de tamaño en portugués", () => {
    renderWithLocale(
      <StructuredVariantPicker
        product={mockProduct}
        axes={[{ code: "tamano", label: "Tamaño", values: ["chico", "mediano", "grande"].map(value => ({ value, label: value })) }]}
        selected={{}}
        onSelect={vi.fn()}
      />,
      "pt",
      ptMessages,
    );

    expect(screen.getByText("Tamanho")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pequeno" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Médio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grande" })).toBeInTheDocument();
  });
});
