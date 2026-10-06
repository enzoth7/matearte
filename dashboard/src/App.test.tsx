import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./lib/retailProduction", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/retailProduction")>();
  return { ...original, fetchRetailProduction: vi.fn().mockResolvedValue([]) };
});

describe("App routing and auth integration", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra la pantalla de login cuando no hay sesión activa", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "MateArte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument();
  });

  it("permite iniciar sesión y acceder al dashboard con navegación por pathname", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    });

    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Panel de trabajo" })).toHaveValue("wholesale");

    // Cambiar al panel minorista y acceder a sus dos canales
    fireEvent.change(screen.getByRole("combobox", { name: "Panel de trabajo" }), {
      target: { value: "retail" },
    });
    expect(window.location.pathname).toBe("/minorista");
    expect(screen.getByRole("heading", { name: "Producción minorista" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Producción" })).toHaveAttribute("href", "/minorista");
    expect(screen.queryByText("Abrir ventas web")).not.toBeInTheDocument();
    expect(screen.queryByText("Abrir ventas del local")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Panel de trabajo" }), {
      target: { value: "wholesale" },
    });
    expect(window.location.pathname).toBe("/nuevo");

    // Navegar a Clientes
    fireEvent.click(screen.getByRole("button", { name: "Clientes" }));
    expect(window.location.pathname).toBe("/clientes");

    // Navegar a Producción
    fireEvent.click(screen.getByRole("button", { name: "Producción" }));
    expect(window.location.pathname).toBe("/produccion");

    // Cerrar sesión
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument();
  });
});
