import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { CheckoutForm } from "./CheckoutForm";

const pickupRate = { id: "11111111-1111-4111-8111-111111111111", name: "Retiro", rate_minor: 0, is_pickup: true, departments: [] };
const deliveryRate = { id: "22222222-2222-4222-8222-222222222222", name: "Envío", rate_minor: 50000, is_pickup: false, departments: [] };
const initialCustomer = { fullName: "Enzo", phone: "099000000", department: "", city: "", address: "" };

function mockCheckoutFetch(cartPayload: Record<string, unknown> = { items: [{ unit_price_minor: 100000, quantity: 1 }], total_weight_grams: 350 }) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : (input as Request).url || "";
    if (url.includes("/api/cart")) {
      return { ok: true, text: async () => JSON.stringify(cartPayload) };
    }
    return { ok: true, text: async () => JSON.stringify({ rates: [pickupRate, deliveryRate] }) };
  }));
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

  it("habilita PayPal internacional sólo después de elegir envío a domicilio y país", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));
    fireEvent.click(screen.getByRole("radio", { name: /exterior/i }));

    expect(screen.getByRole("combobox", { name: /^país$/i })).toBeRequired();
    expect(screen.getByLabelText(/^departamento \/ estado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^dirección$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar con paypal/i })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: /^país$/i }), { target: { value: "ES" } });
    expect(screen.getByRole("button", { name: /continuar con paypal/i })).toBeEnabled();
  });

  it("calcula y muestra el costo de envío internacional limpio y lo suma al total", async () => {
    mockCheckoutFetch({ items: [{ unit_price_minor: 100000, quantity: 1 }], total_weight_grams: 350 });
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));
    fireEvent.click(screen.getByRole("radio", { name: /exterior/i }));

    fireEvent.change(screen.getByRole("combobox", { name: /^país$/i }), { target: { value: "ES" } });

    // Para España con 350g, la tarifa es 3120.50 UYU (redondeado a 3.121 en moneda sin decimales)
    expect(await screen.findByText(/3[.,\s]?121/)).toBeInTheDocument();
    // Y el total suma 1000 + 3120.50 = 4120.50 UYU (redondeado a 4.121)
    expect(screen.getByText(/4[.,\s]?121/)).toBeInTheDocument();
  });

  it("oculta el país para un envío dentro de Uruguay", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));
    fireEvent.click(screen.getByRole("radio", { name: /uruguay/i }));

    expect(screen.queryByRole("combobox", { name: /^país$/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^departamento$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ciudad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^dirección$/i)).toBeInTheDocument();
  });

  it("permite seleccionar el país y prefijo del teléfono", async () => {
    mockCheckoutFetch();
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    expect(screen.getByLabelText("País y prefijo del teléfono")).toHaveValue("UY");
    fireEvent.change(screen.getByLabelText("País y prefijo del teléfono"), { target: { value: "IT" } });
    expect(screen.getByLabelText("País y prefijo del teléfono")).toHaveValue("IT");
    expect(screen.getByRole("textbox", { name: /teléfono.*(\+39)/i })).toBeInTheDocument();
  });

  it("reemplaza los pagos online por transferencia cuando el carrito es mayorista", async () => {
    mockCheckoutFetch({
      items: [{ unit_price_minor: 70000, quantity: 30 }],
      total_weight_grams: 10500,
      wholesale: { eligible: true, mate_quantity: 30, threshold: 30, discount_percent: 30, savings_minor: 1200000, checkout_mode: "bank_transfer" },
      bank_transfer: {
        account_holder: "Richard Ortiz",
        transfer_account: "BROU CA $ 110882545-00002",
        cash_deposit_account: "601-0384954",
        cash_deposit_label: "Depósitos en RedPagos/Abitab",
      },
    });
    render(<CheckoutForm initialCustomer={initialCustomer} />);

    fireEvent.click(await screen.findByRole("radio", { name: /envío a domicilio/i }));

    expect(screen.queryByRole("radio", { name: /exterior/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mercado pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paypal/i })).not.toBeInTheDocument();
    expect(screen.getByText("BROU CA $ 110882545-00002")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /transferencia hecha/i }));
    expect(screen.getByLabelText(/comprobante de pago/i)).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,application/pdf");
    expect(screen.getByRole("button", { name: /completar pedido/i })).toBeDisabled();
  });
});
