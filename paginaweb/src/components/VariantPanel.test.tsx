import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { VariantPanel } from "./VariantPanel";

describe("VariantPanel", () => {
  it("permite recorrer y seleccionar opciones sin presentar una compra", () => {
    render(<VariantPanel variants={[{ id: "a", label: "Color", value: "Natural" }, { id: "b", label: "Color", value: "Negro" }]} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked();
    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(screen.getByText(/precio final se confirma/i)).toBeInTheDocument();
  });
});
