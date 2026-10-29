import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencySelector, StorefrontCurrency, useStorefrontCurrency, useStorefrontProduct } from "./StorefrontCurrency";
import { products } from "@/data/catalog";
import { formatMoney } from "@/lib/money";

const language = vi.hoisted(() => ({ value: "es" }));
afterEach(cleanup);
vi.mock("next-intl", () => ({ useLocale: () => language.value }));
function Price() {
  const { currency, rates } = useStorefrontCurrency({ USD: 40, BRL: 8 });
  return <p data-testid="price">{formatMoney(10000, "UYU", language.value, rates, currency)}</p>;
}
describe("storefront currency selector", () => {
  it("updates prices and persists the Spanish currency choice", () => {
    language.value = "es";
    render(<StorefrontCurrency initialCurrency="UYU" arsPerUyu={30}><CurrencySelector /><Price /></StorefrontCurrency>);
    expect(screen.getByTestId("price")).toHaveTextContent("100 UYU");
    fireEvent.change(screen.getByRole("combobox", { name: "Moneda" }), { target: { value: "ARS" } });
    expect(screen.getByTestId("price")).toHaveTextContent("3.000 ARS");
    expect(document.cookie).toContain("MATEARTE_CURRENCY=ARS");
  });
  it("does not expose ARS when the finance rate is unavailable", () => {
    language.value = "es";
    render(<StorefrontCurrency initialCurrency="ARS" arsPerUyu={0}><CurrencySelector /><Price /></StorefrontCurrency>);
    expect(screen.queryByRole("option", { name: "ARS" })).not.toBeInTheDocument();
    expect(screen.getByTestId("price")).toHaveTextContent("UYU");
  });
  it.each([["en", "USD", "Currency"], ["pt", "BRL", "Moeda"]])("locks %s to %s regardless of the Spanish preference", (locale, currency, label) => {
    language.value = locale;
    render(<StorefrontCurrency initialCurrency="ARS" arsPerUyu={30}><CurrencySelector /><Price /></StorefrontCurrency>);
    expect(screen.getByRole("combobox", { name: label })).toBeDisabled();
    expect(screen.getByTestId("price")).toHaveTextContent(currency);
  });
});

const baseProduct = { ...products[0], variants: [{ ...products[0].variants[0], price: { amountMinor: 11364, currency: "UYU" as const }, basePrice: { amountMinor: 10000, currency: "UYU" as const } }] };
function ProductPrice() {
  const product = useStorefrontProduct(baseProduct);
  const { currency, rates } = useStorefrontCurrency();
  return <p data-testid="product-price">{formatMoney(product.variants[0].price!.amountMinor, "UYU", "es", rates, currency)}</p>;
}
it("uses the base price only for ARS and preserves the UYU adjustment on switching back", () => {
  language.value = "es";
  render(<StorefrontCurrency initialCurrency="ARS" arsPerUyu={30} arsUseBasePrice><CurrencySelector /><ProductPrice /></StorefrontCurrency>);
  expect(screen.getByTestId("product-price")).toHaveTextContent("3.000 ARS");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "UYU" } });
  expect(screen.getByTestId("product-price")).toHaveTextContent("114 UYU");
});
it("retains the adjusted reference when the ARS base-price switch is off", () => {
  language.value = "es";
  render(<StorefrontCurrency initialCurrency="ARS" arsPerUyu={30}><ProductPrice /></StorefrontCurrency>);
  expect(screen.getByTestId("product-price")).toHaveTextContent("3.400 ARS");
});
