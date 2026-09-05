import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { CheckoutForm } from "./CheckoutForm";

const pickupRate = { id: "11111111-1111-4111-8111-111111111111", name: "Retiro", rate_minor: 0, is_pickup: true, departments: [] };
const deliveryRate = { id: "22222222-2222-4222-8222-222222222222", name: "Envío", rate_minor: 50000, is_pickup: false, departments: [] };
const initialCustomer = { fullName: "Enzo", phone: "099000000", department: "", city: "", address: "" };

function mockCheckoutFetch() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ rates: [pickupRate, deliveryRate] }) }));
}

describe("CheckoutForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("no abre destinos ni dirección cuando se elige retiro en tienda", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /retiro en tienda/i }));

    expect(screen.queryByRole("radio", { name: /uruguay/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^departamento$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mercado pago/i })).toBeEnabled();
  });

  it("abre la coordinación internacional sólo después de elegir envío a domicilio", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));
    fireEvent.click(screen.getByRole("radio", { name: /exterior/i }));

    expect(screen.getByRole("textbox", { name: /^país$/i })).toBeRequired();
    expect(screen.getByLabelText(/^departamento \/ estado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^dirección$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contactarte con nosotros/i })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /^país$/i }), { target: { value: "España" } });
    expect(screen.getByRole("button", { name: /contactarte con nosotros/i })).toBeEnabled();
  });

  it("oculta el país para un envío dentro de Uruguay", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));
    fireEvent.click(screen.getByRole("radio", { name: /uruguay/i }));

    expect(screen.queryByRole("textbox", { name: /^país$/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^departamento$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ciudad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^dirección$/i)).toBeInTheDocument();
  });
});
