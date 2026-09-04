import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { CheckoutForm } from "./CheckoutForm";

describe("CheckoutForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ofrece coordinación por WhatsApp cuando el destino es exterior", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: [{ id: "11111111-1111-4111-8111-111111111111", name: "Retiro", rate_minor: 0, is_pickup: true, departments: [] }] }),
    }));

    render(<CheckoutForm initialCustomer={{ fullName: "Enzo", phone: "099000000", department: "", city: "", address: "" }} />);
    fireEvent.click(screen.getByRole("radio", { name: /exterior/i }));

    expect(screen.getByRole("textbox", { name: /^país$/i })).toBeRequired();
    expect(screen.getByRole("button", { name: /coordinar por whatsapp/i })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /^país$/i }), { target: { value: "España" } });
    expect(screen.getByRole("button", { name: /coordinar por whatsapp/i })).toBeEnabled();
    expect(screen.queryByText("Mercado Pago")).not.toBeInTheDocument();
  });

  it("recupera el país guardado para clientes del exterior", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: [] }) }));

    render(
      <CheckoutForm
        initialCustomer={{ fullName: "Ana", phone: "341000000", department: "Madrid", city: "Madrid", address: "Calle 1" }}
        initialDestination={{ international: true, country: "España", city: "Madrid" }}
      />,
    );

    expect(screen.getByRole("radio", { name: /exterior/i })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /^país$/i })).toHaveValue("España");
    expect(screen.getByRole("textbox", { name: /ciudad/i })).toHaveValue("Madrid");
  });
});
