import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginView } from "./LoginView";

afterEach(cleanup);

describe("LoginView", () => {
  it("renderiza el formulario con logotipo y campos de usuario y contraseña", () => {
    const handleLogin = vi.fn().mockReturnValue({ success: true });
    render(<LoginView onLogin={handleLogin} />);

    expect(screen.getByRole("img", { name: "MateArte Arte y Tradición" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MateArte" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("invoca onLogin con los datos ingresados", () => {
    const handleLogin = vi.fn().mockReturnValue({ success: true });
    render(<LoginView onLogin={handleLogin} />);

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(handleLogin).toHaveBeenCalledWith("user", "12345678");
  });

  it("muestra mensaje de error cuando las credenciales son inválidas", () => {
    const handleLogin = vi.fn().mockReturnValue({ success: false, error: "Usuario o contraseña incorrectos." });
    render(<LoginView onLogin={handleLogin} />);

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "badpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Usuario o contraseña incorrectos.");
  });
});
