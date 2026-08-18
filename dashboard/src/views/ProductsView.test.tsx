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
    expect(screen.getByText("2 productos editables")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo producto 1")).toHaveValue("Imperial");
    expect(screen.getByLabelText("Modelo producto 2")).toHaveValue("Torpedo");
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
