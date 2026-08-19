import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "../types";
import { ProductsView } from "./ProductsView";

const mockData: DashboardData = {
  exchangeRate: 0.026,
  products: [
    {
      id: "1",
      model: "Imperial",
      variant: "Cincelado a Lacre",
      rimType: "Imperial",
      leatherType: "Vaqueta",
      priceArg: 100000,
      priceUyu: 2600,
    },
    {
      id: "2",
      model: "Torpedo",
      variant: "Liso",
      rimType: "Alpaca",
      leatherType: "Crudo",
      priceArg: 50000,
      priceUyu: 1300,
    },
    {
      id: "3",
      model: "Imperial",
      variant: "Premium",
      rimType: "Acero",
      leatherType: "Vaqueta",
      priceArg: 80000,
      priceUyu: 2080,
    },
  ],
  customers: [],
  production: [],
  history: [],
};

afterEach(cleanup);

describe("ProductsView", () => {
  it("renderiza el catálogo y resumen de productos", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Productos" })).toBeInTheDocument();
    expect(screen.getByText("3 productos editables")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo producto 1")).toHaveValue("Imperial");
    expect(screen.getByLabelText("Modelo producto 2")).toHaveValue("Torpedo");
    expect(screen.getByLabelText("Modelo producto 3")).toHaveValue("Imperial");
  });

  it("filtra productos por búsqueda", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    const searchInput = screen.getByPlaceholderText("Buscar modelo, variante o material");
    fireEvent.change(searchInput, { target: { value: "Torpedo" } });

    expect(screen.getByLabelText("Modelo producto 2")).toHaveValue("Torpedo");
    expect(screen.queryByLabelText("Modelo producto 1")).not.toBeInTheDocument();
    expect(screen.getByText("1 productos editables")).toBeInTheDocument();
  });

  it("filtra productos por selectores y sincroniza variantes dependientes", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    const modelSelect = screen.getByLabelText("Filtrar por modelo");
    const variantSelect = screen.getByLabelText("Filtrar por variante");
    const rimSelect = screen.getByLabelText("Filtrar por virola");
    const leatherSelect = screen.getByLabelText("Filtrar por cuero");

    // Filtrar por modelo Imperial
    fireEvent.change(modelSelect, { target: { value: "Imperial" } });
    expect(screen.getByLabelText("Modelo producto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo producto 3")).toBeInTheDocument();
    expect(screen.queryByLabelText("Modelo producto 2")).not.toBeInTheDocument();

    // Las opciones de variante ahora deben ser solo las de Imperial ("Cincelado a Lacre", "Premium")
    const variantOptions = within(variantSelect).getAllByRole("option").map((opt) => opt.textContent);
    expect(variantOptions).toContain("Todas las variantes");
    expect(variantOptions).toContain("Cincelado a Lacre");
    expect(variantOptions).toContain("Premium");
    expect(variantOptions).not.toContain("Liso");

    // Filtrar por variante Premium
    fireEvent.change(variantSelect, { target: { value: "Premium" } });
    expect(screen.queryByLabelText("Modelo producto 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Modelo producto 3")).toBeInTheDocument();

    // Cambiar a modelo Torpedo -> resetea variante porque Torpedo no tiene "Premium"
    fireEvent.change(modelSelect, { target: { value: "Torpedo" } });
    expect(variantSelect).toHaveValue("");
    expect(screen.getByLabelText("Modelo producto 2")).toBeInTheDocument();

    // Filtrar por virola y cuero
    fireEvent.change(modelSelect, { target: { value: "" } });
    fireEvent.change(rimSelect, { target: { value: "Alpaca" } });
    expect(screen.getByLabelText("Modelo producto 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Modelo producto 1")).not.toBeInTheDocument();

    fireEvent.change(rimSelect, { target: { value: "" } });
    fireEvent.change(leatherSelect, { target: { value: "Vaqueta" } });
    expect(screen.getByLabelText("Modelo producto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo producto 3")).toBeInTheDocument();
    expect(screen.queryByLabelText("Modelo producto 2")).not.toBeInTheDocument();

    // Limpiar filtros con el botón
    const clearButton = screen.getByRole("button", { name: "Limpiar filtros" });
    fireEvent.click(clearButton);
    expect(leatherSelect).toHaveValue("");
    expect(modelSelect).toHaveValue("");
    expect(screen.getByText("3 productos editables")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("edita un producto inline llamando a onUpdate", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    const modelInput = screen.getByLabelText("Modelo producto 1");
    fireEvent.blur(modelInput, { target: { value: "Imperial Deluxe" } });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          model: "Imperial Deluxe",
        })
      );
    });
  });

  it("actualiza la tasa de cambio al hacer blur", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    const rateInput = screen.getByLabelText("1 ARS equivale a");
    fireEvent.change(rateInput, { target: { value: "0.030" } });
    fireEvent.blur(rateInput);

    await waitFor(() => {
      expect(onUpdateExchangeRate).toHaveBeenCalledWith(0.03);
    });
  });

  it("abre el modal de agregar producto, valida y ejecuta onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    const addButton = screen.getByRole("button", { name: /Agregar producto/i });
    fireEvent.click(addButton);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Agregar producto" })).toBeInTheDocument();

    const modelInput = within(dialog).getByLabelText(/Modelo/i);
    const variantInput = within(dialog).getByLabelText(/Variante/i);
    const rimTypeInput = within(dialog).getByLabelText(/Tipo de Virola/i);
    const leatherTypeInput = within(dialog).getByLabelText(/Tipo de Cuero/i);
    const priceArgInput = within(dialog).getByLabelText(/Precio ARG/i);
    const submitButton = within(dialog).getByRole("button", { name: "Guardar producto" });

    fireEvent.change(modelInput, { target: { value: "Camionero" } });
    fireEvent.change(variantInput, { target: { value: "Uruguayo" } });
    fireEvent.change(rimTypeInput, { target: { value: "Cincelada" } });
    fireEvent.change(leatherTypeInput, { target: { value: "Vaqueta Marrón" } });
    fireEvent.change(priceArgInput, { target: { value: "45000" } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        model: "Camionero",
        variant: "Uruguayo",
        rimType: "Cincelada",
        leatherType: "Vaqueta Marrón",
        priceArg: 45000,
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cierra el modal al pulsar Cancelar", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateExchangeRate = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductsView
        data={mockData}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onUpdateExchangeRate={onUpdateExchangeRate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
