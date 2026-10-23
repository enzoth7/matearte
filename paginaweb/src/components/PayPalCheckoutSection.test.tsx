import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ props: {} as { onApprove: (data: unknown, actions: unknown) => Promise<void>; disabled?: boolean } }));
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: (props: typeof mock.props) => { mock.props = props; return <button disabled={props.disabled}>PayPal</button>; },
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
import { PayPalCheckoutSection } from "./PayPalCheckoutSection";
beforeEach(() => vi.restoreAllMocks());
it("no invita a volver a pagar cuando se pierde la confirmación", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection lost")));
  const onSuccess = vi.fn();
  render(<PayPalCheckoutSection orderId="order" amountUsd="100" onSuccess={onSuccess} onError={vi.fn()} />);
  await act(() => mock.props.onApprove({ orderID: "PAYPAL" }, { restart: vi.fn() }));
  expect(screen.getByRole("status")).toHaveTextContent("paypalPending");
  expect(screen.getByRole("button", { name: "PayPal" })).toBeDisabled();
  expect(onSuccess).not.toHaveBeenCalled();
});
it("entrega el ID real de captura al confirmar", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "COMPLETED", captureId: "CAPTURE" }) }));
  const onSuccess = vi.fn();
  render(<PayPalCheckoutSection orderId="order" amountUsd="100" onSuccess={onSuccess} onError={vi.fn()} />);
  await act(() => mock.props.onApprove({ orderID: "PAYPAL" }, { restart: vi.fn() }));
  expect(onSuccess).toHaveBeenCalledWith("CAPTURE");
});
