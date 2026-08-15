import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "../types";
import { NewOrderView } from "./NewOrderView";

const data: DashboardData = {
  customers: ["GASPAR", "GASTON MERCADO"],
  exchangeRate: 0.026,
  products: [
    {
      id: "torpedo-natural",
      model: "Torpedo",
      variant: "Cuero natural",
      rimType: "Alpaca",
      leatherType: "Natural",
      priceArg: 25000,
      priceUyu: 650,
    },
  ],
  production: [],
  history: [],
};

afterEach(cleanup);

describe("NewOrderView", () => {
  it("muestra una sola cabecera para todas las filas de productos", () => {
    const { container } = render(
      <NewOrderView data={data} onAddOrder={vi.fn()} onNavigate={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Encargar pedido" })).toBeInTheDocument();
    expect(container.querySelector(".order-page-heading img")).not.toBeInTheDocument();
    expect(container.querySelectorAll("legend")).toHaveLength(0);
    expect(screen.getAllByText("Modelo")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));

    expect(screen.getAllByText("Modelo")).toHaveLength(1);
    expect(screen.getAllByLabelText(/Modelo de la fila/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Agrega primero" })).toBeInTheDocument();
    expect(screen.getByText("Conversión a UYU")).toBeInTheDocument();
  });

  it("mantiene el selector de clientes sin acciones administrativas", () => {
    render(
      <NewOrderView data={data} onAddOrder={vi.fn()} onNavigate={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Encargar pedido a"), { target: { value: "GASPAR" } });
    expect(screen.getByLabelText("Encargar pedido a")).toHaveValue("GASPAR");

    expect(screen.queryByRole("button", { name: "Administrar clientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pedido nuevo" })).not.toBeInTheDocument();
  });
});
