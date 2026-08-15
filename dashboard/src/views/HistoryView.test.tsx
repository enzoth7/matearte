import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardData } from "../types";
import { HistoryView } from "./HistoryView";

const data: DashboardData = {
  exchangeRate: 0.026,
  products: [],
  production: [
    {
      lineId: "line-pending",
      orderId: null,
      customer: "Cliente pendiente",
      model: "Torpedo",
      variant: "",
      quantity: 4,
      status: "En producción",
    },
  ],
  history: [
    {
      lineId: "line-pending",
      orderId: null,
      createdAt: null,
      customer: "Cliente pendiente",
      model: "Torpedo",
      variant: "",
      quantity: 4,
      completedAt: null,
    },
    {
      lineId: "line-complete",
      orderId: "PED-100001",
      createdAt: "2026-08-12T12:00:00.000Z",
      customer: "Cliente completo",
      model: "Criollo",
      variant: "Natural",
      quantity: 2,
      completedAt: "2026-08-13T14:30:00.000Z",
    },
  ],
};

afterEach(cleanup);

describe("HistoryView", () => {
  it("muestra el histórico automatizado, sin controles editables", () => {
    const { container } = render(<HistoryView data={data} />);

    expect(container.querySelector("tbody input, tbody select")).not.toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Completado")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
  });

  it("filtra automáticamente las líneas que siguen en producción", () => {
    render(<HistoryView data={data} />);

    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }));

    expect(screen.getByText("Cliente pendiente")).toBeInTheDocument();
    expect(screen.queryByText("Cliente completo")).not.toBeInTheDocument();
  });
});
