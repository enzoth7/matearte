import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileEditor, type ProfileFormData } from "./ProfileEditor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const initial: ProfileFormData = {
  fullName: "Cliente MateArte",
  phone: "+598 098 633 186",
  company: "",
  birthDate: "2000-01-01",
  countryCode: "UY",
  department: "Paysandú",
  city: "Paysandú",
  addressLine1: "Calle 123",
  postalCode: "60000",
};

describe("ProfileEditor", () => {
  it("updates the phone prefix and provinces when the country changes", () => {
    render(<ProfileEditor initial={initial} email="cliente@example.com" welcome={false} />);

    expect(screen.getByLabelText("Prefijo internacional +598")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Paysandú" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("País *"), { target: { value: "AU" } });

    expect(screen.getByLabelText("Prefijo internacional +61")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Queensland" })).toBeInTheDocument();
    expect(screen.getByLabelText("Estado / provincia *")).toHaveValue("");
  });
});
