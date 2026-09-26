import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    {
      id: "imperial-negro",
      model: "Imperial",
      variant: "Cuero negro",
      rimType: "Alpaca",
      leatherType: "Negro",
      priceArg: 40000,
      priceUyu: 1040,
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
    expect(screen.queryByRole("radio", { name: /Pedido normal/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Modelo")).toHaveLength(1);
    expect(screen.getAllByText("Tipo de pedido")).toHaveLength(1);
    expect(screen.getByLabelText("Tipo de pedido de la fila 1")).toHaveValue("normal");

    fireEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));

    expect(screen.getAllByText("Modelo")).toHaveLength(1);
    expect(screen.getAllByLabelText(/Modelo de la fila/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Tipo de pedido de la fila/)).toHaveLength(2);
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

  it("registra líneas con costo y sin costo dentro del mismo pedido", async () => {
    const onAddOrder = vi.fn().mockResolvedValue("PED-200");
    render(<NewOrderView data={data} onAddOrder={onAddOrder} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Encargar pedido a"), { target: { value: "GASPAR" } });
    fireEvent.change(screen.getByLabelText("Modelo de la fila 1"), { target: { value: "Torpedo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));
    fireEvent.change(screen.getByLabelText("Modelo de la fila 2"), { target: { value: "Imperial" } });
    fireEvent.change(screen.getByLabelText("Tipo de pedido de la fila 2"), { target: { value: "no_cost" } });

    expect(screen.getByLabelText("Subtotal del artículo 1")).toHaveTextContent("ARS 25.000");
    expect(screen.getByLabelText("Subtotal del artículo 2")).toHaveTextContent("ARS 0");
    fireEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(onAddOrder).toHaveBeenCalledWith(
      "GASPAR",
      [
        expect.objectContaining({ productId: "torpedo-natural", quantity: 1, orderType: "normal" }),
        expect.objectContaining({ productId: "imperial-negro", quantity: 1, orderType: "no_cost" }),
      ],
    ));
  });
});
