import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRetailProduction,
  updateRetailProductionStatus,
} from "../lib/retailProduction";
import { RetailPanelView } from "./RetailPanelView";

vi.mock("../lib/retailProduction", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/retailProduction")>();
  return {
    ...original,
    fetchRetailProduction: vi.fn(),
    updateRetailProductionStatus: vi.fn(),
  };
});

const item = {
  id: "web-item-1",
  sourceItemId: "item-1",
  source: "Web" as const,
  reference: "#48",
  createdAt: "2026-10-04T22:48:09.101Z",
  customer: "Molinari",
  product: "Mate Imperial Fleje Abstracto",
  quantity: 1,
  status: "pending" as const,
};

describe("RetailPanelView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("permite cambiar y guardar el estado interno de producción", async () => {
    vi.mocked(fetchRetailProduction).mockResolvedValue([item]);
    vi.mocked(updateRetailProductionStatus).mockResolvedValue("in_production");

    render(<RetailPanelView />);

    const status = await screen.findByRole("combobox", { name: "Estado de Mate Imperial Fleje Abstracto" });
    expect(status).toHaveValue("pending");

    fireEvent.change(status, { target: { value: "in_production" } });

    await waitFor(() => {
      expect(updateRetailProductionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ source: "Web", sourceItemId: "item-1" }),
        "in_production",
      );
      expect(status).toHaveValue("in_production");
    });
  });
});
