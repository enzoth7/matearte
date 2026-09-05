import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils";
import { ProfileEditor, type ProfileFormData } from "./ProfileEditor";

vi.mock("@/i18n/navigation", () => ({
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
    render(<ProfileEditor initial={initial} welcome={false} />);

    expect(screen.getByRole("textbox", { name: /prefijo internacional \+598/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Paysandú" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("País"), { target: { value: "AU" } });

    expect(screen.getByRole("textbox", { name: /prefijo internacional \+61/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Queensland" })).toBeInTheDocument();
    expect(screen.getByLabelText("Estado / provincia")).toHaveValue("");
  });
});
