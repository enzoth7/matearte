import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { ArgentinaOrderPayment } from "./ArgentinaOrderPayment";

vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const props = {
  orderId: "11111111-1111-4111-8111-111111111111",
  status: "pending_payment",
  totalMinor: 2_050_000,
  bank: { alias: "MATEARTE.COLON", cbu: "0170119340000000993887", bank_name: "BBVA Argentina", account_holder: "" },
  rejectionReason: "",
};

describe("ArgentinaOrderPayment", () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("muestra la cuenta en la pantalla de transferencia y pide comprobante después de transferir", () => {
    render(<ArgentinaOrderPayment {...props} />);

    expect(screen.getByRole("heading", { name: "Completá la transferencia" })).toBeInTheDocument();
    expect(screen.getAllByText(/20[.,]500 ARS/)).toHaveLength(2);
    expect(screen.getByText("MATEARTE.COLON")).toBeInTheDocument();
    expect(screen.getByText(props.bank.cbu)).toBeInTheDocument();
    expect(screen.queryByText("Titular")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Comprobante de pago")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Transferencia hecha" }));
    const input = screen.getByLabelText("Comprobante de pago") as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,application/pdf");
    expect(screen.getByRole("button", { name: "Completar pedido" })).toBeDisabled();
    fireEvent.change(input, { target: { files: [new File(["comprobante"], "pago.pdf", { type: "application/pdf" })] } });
    expect(screen.getByRole("button", { name: "Completar pedido" })).toBeEnabled();
  });

  it("permite volver a adjuntar cuando el comprobante fue rechazado", () => {
    render(<ArgentinaOrderPayment {...props} status="payment_failed" rejectionReason="No se distingue el importe" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se distingue el importe");
    expect(screen.getByLabelText("Comprobante de pago")).toBeInTheDocument();
  });

  it("muestra la revisión sin permitir duplicar la carga", () => {
    render(<ArgentinaOrderPayment {...props} status="payment_verification_pending" />);
    expect(screen.getByRole("status")).toHaveTextContent("Estamos revisando el pago");
    expect(screen.queryByLabelText("Comprobante de pago")).not.toBeInTheDocument();
  });
});
