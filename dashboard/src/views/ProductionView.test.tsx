import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "../types";
import { buildProductionSummary, ProductionView } from "./ProductionView";

const data: DashboardData = {
  exchangeRate: 0.026,
  products: [{ id: "p-1", model: "Torpedo", variant: "Natural", rimType: "", leatherType: "", priceArg: 1200, priceUyu: 31 }],
  production: [{ lineId: "line-1", orderId: "PED-1", customer: "GASPAR", model: "Torpedo", variant: "Natural", quantity: 12, status: "Pendiente" }],
  history: [],
};

afterEach(cleanup);

describe("ProductionView", () => {
  it("calcula los resúmenes por unidades y no por cantidad de filas", () => {
    const summary = buildProductionSummary({
      ...data,
      production: [
        ...data.production,
        { lineId: "line-2", orderId: "PED-2", customer: "ANA", model: "Torpedo", variant: "Natural", quantity: 8, status: "En producción" },
      ],
    });

    expect(summary.totals).toEqual({ pending: 12, inProduction: 8, total: 20 });
    expect(summary.modelRows[0]).toEqual(expect.objectContaining({ label: "Torpedo", pending: 12, inProduction: 8, total: 20 }));
    expect(summary.rimRows).toEqual([]);
    expect(summary.leatherRows[0]).toEqual(expect.objectContaining({ label: "-", total: 20 }));
  });

  it("muestra filas de solo lectura y edita desde el lápiz", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const complete = vi.fn().mockResolvedValue(undefined);
    render(<ProductionView data={data} onUpdate={update} onComplete={complete} />);

    expect(screen.queryByText(/líneas/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Cliente line-1" })).not.toBeInTheDocument();
    const productionRow = screen.getByRole("button", { name: "Editar Torpedo de GASPAR" }).closest("tr") as HTMLElement;
    expect(within(productionRow).getByText("GASPAR")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Modelos" }));
    expect(screen.getByRole("heading", { name: "Torpedo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Pedidos" }));

    fireEvent.click(screen.getByRole("button", { name: "Editar Torpedo de GASPAR" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Cliente")).toHaveValue("GASPAR");
    fireEvent.change(within(dialog).getByLabelText("Cantidad"), { target: { value: "18" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ lineId: "line-1", quantity: 18 })));
  });

  it("ordena desde la cabecera y recalcula el KPI con el filtro", () => {
    const filteredData: DashboardData = {
      ...data,
      production: [
        ...data.production,
        { lineId: "line-2", orderId: "PED-2", customer: "ANA", model: "Torpedo", variant: "Natural", quantity: 5, status: "En producción" },
        { lineId: "line-3", orderId: "PED-3", customer: "BOB", model: "Camionero", variant: "Acero", quantity: 7, status: "Pendiente" },
      ],
    };
    render(<ProductionView data={filteredData} onUpdate={vi.fn()} onComplete={vi.fn()} />);

    const valueKpi = screen.getByText("Valor").closest("article") as HTMLElement;
    expect(within(valueKpi).getByText(/20\.400/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ordenar Cantidad de mayor a menor" }));
    let rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("GASPAR")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ordenar Cantidad de menor a mayor" }));
    rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("ANA")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Ordenar Pedido/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ordenar Variante/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ordenar Estado/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por cliente"), { target: { value: "ANA" } });
    expect(within(valueKpi).getByText(/6\.000/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por cliente"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filtrar por modelo"), { target: { value: "Torpedo" } });
    const customerSelect = screen.getByLabelText("Filtrar por cliente");
    expect(within(customerSelect).getByRole("option", { name: "GASPAR" })).toBeInTheDocument();
    expect(within(customerSelect).getByRole("option", { name: "ANA" })).toBeInTheDocument();
    expect(within(customerSelect).queryByRole("option", { name: "BOB" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por modelo"), { target: { value: "" } });
    fireEvent.change(customerSelect, { target: { value: "BOB" } });
    const modelSelect = screen.getByLabelText("Filtrar por modelo");
    expect(within(modelSelect).getByRole("option", { name: "Camionero" })).toBeInTheDocument();
    expect(within(modelSelect).queryByRole("option", { name: "Torpedo" })).not.toBeInTheDocument();
  });

  it("recalcula el valor ARG al seleccionar un KPI de modelo", () => {
    const modelData: DashboardData = {
      ...data,
      products: [
        ...data.products,
        { id: "p-2", model: "Camionero", variant: "Acero", rimType: "", leatherType: "", priceArg: 1000, priceUyu: 26 },
      ],
      production: [
        ...data.production,
        { lineId: "line-2", orderId: "PED-2", customer: "ANA", model: "Camionero", variant: "Acero", quantity: 7, status: "En producción" },
      ],
    };
    render(<ProductionView data={modelData} onUpdate={vi.fn()} onComplete={vi.fn()} />);

    const valueKpi = screen.getByText("Valor").closest("article") as HTMLElement;
    expect(within(valueKpi).getByText(/21\.400/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Modelos" }));
    const camioneroCard = screen.getByRole("button", { name: "Filtrar valor ARG por Camionero" });
    fireEvent.click(camioneroCard);

    expect(camioneroCard).toHaveAttribute("aria-pressed", "true");
    expect(within(valueKpi).getByText(/7\.000/)).toBeInTheDocument();

    fireEvent.click(camioneroCard);
    expect(camioneroCard).toHaveAttribute("aria-pressed", "false");
    expect(within(valueKpi).getByText(/21\.400/)).toBeInTheDocument();
  });

  it("exporta a Excel al presionar el botón de exportación", async () => {
    const formatModule = await import("../lib/format");
    const exportSpy = vi.spyOn(formatModule, "exportProductionToExcel").mockImplementation(() => undefined);
    render(<ProductionView data={data} onUpdate={vi.fn()} onComplete={vi.fn()} />);

    const exportBtn = screen.getByRole("button", { name: /exportar excel/i });
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith(data.production, data.products, data.exchangeRate);
    exportSpy.mockRestore();
  });
});
