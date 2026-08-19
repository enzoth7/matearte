import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "../types";
import { CustomersView } from "./CustomersView";

const data: DashboardData = {
  customers: ["GASPAR", "MANU PEREZ"],
  customerProfiles: [
    { fullName: "GASPAR", firstName: "GASPAR", lastName: "", phone: "099111222", email: "gaspar@example.com", address: "", notes: "" },
    { fullName: "MANU PEREZ", firstName: "MANU", lastName: "PEREZ", phone: "", email: "", address: "", notes: "" },
  ],
  exchangeRate: 0.026,
  products: [],
  production: [{ lineId: "line-1", orderId: "PED-1", customer: "GASPAR", model: "Torpedo", variant: "Natural", quantity: 12, status: "Pendiente" }],
  history: [
    { lineId: "line-1", orderId: "PED-1", createdAt: "2026-08-12T12:00:00.000Z", customer: "GASPAR", model: "Torpedo", variant: "Natural", quantity: 12, completedAt: null },
    { lineId: "line-2", orderId: "PED-2", createdAt: "2026-07-01T12:00:00.000Z", customer: "MANU PEREZ", model: "Criollo", variant: "Natural", quantity: 4, completedAt: "2026-07-03T12:00:00.000Z" },
    { lineId: "line-3", orderId: "PED-3", createdAt: "2026-06-01T12:00:00.000Z", customer: "MANU PEREZ", model: "Criollo", variant: "Alpaca", quantity: 2, completedAt: "2026-06-03T12:00:00.000Z" },
  ],
};

afterEach(cleanup);

describe("CustomersView", () => {
  it("muestra métricas y abre diálogos para agregar y editar", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const rename = vi.fn().mockResolvedValue(undefined);
    render(<CustomersView data={data} onAdd={add} onRename={rename} />);

    expect(screen.getByText("Última compra")).toBeInTheDocument();
    expect(screen.getByText("Pedidos actuales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar cliente GASPAR" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agregar cliente" }));
    const addDialog = screen.getByRole("dialog");
    fireEvent.change(within(addDialog).getByLabelText("Nombre"), { target: { value: "ANA" } });
    fireEvent.change(within(addDialog).getByLabelText("Apellido"), { target: { value: "LOPEZ" } });
    fireEvent.change(within(addDialog).getByLabelText("Teléfono"), { target: { value: "099000111" } });
    fireEvent.click(within(addDialog).getByRole("button", { name: "Guardar cliente" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith(expect.objectContaining({ fullName: "ANA LOPEZ", phone: "099000111" })));

    fireEvent.click(screen.getByRole("button", { name: "Editar cliente GASPAR" }));
    const editDialog = screen.getByRole("dialog");
    expect(within(editDialog).getByLabelText("Email")).toHaveValue("gaspar@example.com");
    fireEvent.change(within(editDialog).getByLabelText("Email"), { target: { value: "nuevo@example.com" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Guardar cliente" }));
    await waitFor(() => expect(rename).toHaveBeenCalledWith("GASPAR", expect.objectContaining({ email: "nuevo@example.com" })));
  });

  it("ordena la última compra de más nueva a más antigua y viceversa", () => {
    render(<CustomersView data={data} onAdd={vi.fn()} onRename={vi.fn()} />);

    let customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente GASPAR");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar última compra de más antigua a más nueva" }));
    customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente MANU PEREZ");
    expect(screen.getByRole("button", { name: "Ordenar última compra de más nueva a más antigua" })).toBeInTheDocument();
  });

  it("ordena pedidos actuales y total de pedidos en ambos sentidos", () => {
    render(<CustomersView data={data} onAdd={vi.fn()} onRename={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Ordenar pedidos actuales de mayor a menor" }));
    let customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente GASPAR");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar pedidos actuales de menor a mayor" }));
    customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente MANU PEREZ");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar total pedidos de mayor a menor" }));
    customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente MANU PEREZ");

    fireEvent.click(screen.getByRole("button", { name: "Ordenar total pedidos de menor a mayor" }));
    customerButtons = screen.getAllByRole("button", { name: /Editar cliente/ });
    expect(customerButtons[0]).toHaveAccessibleName("Editar cliente GASPAR");
  });

  it("muestra el histórico agrupado por tipo de mate y mantiene las columnas como cantidad de pedidos", () => {
    render(<CustomersView data={data} onAdd={vi.fn()} onRename={vi.fn()} />);

    const gasparRow = screen.getByRole("button", { name: "Editar cliente GASPAR" });
    expect(within(gasparRow).getAllByText("1")).toHaveLength(2);
    expect(within(gasparRow).queryByText("12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar cliente MANU PEREZ" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Histórico por tipo de mate" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 pedidos · 6 unidades")).toBeInTheDocument();
    expect(within(dialog).getByRole("row", { name: "Criollo 2 6" })).toBeInTheDocument();
    expect(within(dialog).getByRole("row", { name: "Total 2 6" })).toBeInTheDocument();
  });

  it("filtra clientes por el selector desplegable", () => {
    render(<CustomersView data={data} onAdd={vi.fn()} onRename={vi.fn()} />);

    const select = screen.getByLabelText("Filtrar por cliente");
    expect(select).toBeInTheDocument();

    const options = within(select).getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toEqual(["Todos los clientes", "GASPAR", "MANU PEREZ"]);

    fireEvent.change(select, { target: { value: "GASPAR" } });
    expect(screen.getByRole("button", { name: "Editar cliente GASPAR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cliente MANU PEREZ" })).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Editar cliente GASPAR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar cliente MANU PEREZ" })).toBeInTheDocument();
  });

  it("filtra clientes por búsqueda evaluando nombre, teléfono y email", () => {
    render(<CustomersView data={data} onAdd={vi.fn()} onRename={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText("Buscar cliente");

    // Búsqueda por teléfono
    fireEvent.change(searchInput, { target: { value: "099111222" } });
    expect(screen.getByRole("button", { name: "Editar cliente GASPAR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cliente MANU PEREZ" })).not.toBeInTheDocument();

    // Búsqueda por email
    fireEvent.change(searchInput, { target: { value: "gaspar@example.com" } });
    expect(screen.getByRole("button", { name: "Editar cliente GASPAR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cliente MANU PEREZ" })).not.toBeInTheDocument();

    // Búsqueda por apellido
    fireEvent.change(searchInput, { target: { value: "PEREZ" } });
    expect(screen.getByRole("button", { name: "Editar cliente MANU PEREZ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cliente GASPAR" })).not.toBeInTheDocument();
  });
});
