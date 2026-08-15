import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardData } from "../types";
import { OverviewView } from "./OverviewView";

const data: DashboardData = {
  exchangeRate: 0.025,
  products: [{ id: "p-1", model: "Torpedo", variant: "Natural", rimType: "", leatherType: "", priceArg: 1000, priceUyu: 25 }],
  production: [{ lineId: "line-1", orderId: "PED-1", customer: "GASPAR", model: "Torpedo", variant: "Natural", quantity: 2, status: "Pendiente" }],
  history: [],
};

afterEach(cleanup);

describe("OverviewView", () => {
  it("separa los valores uruguayo y argentino sin mostrar la carga activa", () => {
    render(<OverviewView data={data} />);

    const uyuKpi = screen.getByRole("heading", { name: "Valor uruguayo" }).closest("article") as HTMLElement;
    const argKpi = screen.getByRole("heading", { name: "Valor argentino" }).closest("article") as HTMLElement;

    expect(within(uyuKpi).getByText(/50/)).toBeInTheDocument();
    expect(within(argKpi).getByText(/2\.000/)).toBeInTheDocument();
    expect(screen.queryByText("Carga activa")).not.toBeInTheDocument();
  });
});
