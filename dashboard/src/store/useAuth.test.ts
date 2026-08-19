import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "./useAuth";

describe("useAuth hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("inicia sin autenticar si no hay sesión previa en localStorage", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("recupera la sesión existente desde localStorage", () => {
    localStorage.setItem("matearte_auth", JSON.stringify({ username: "user", authenticatedAt: "2026-08-19" }));
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("user");
  });

  it("permite iniciar sesión con credenciales correctas (user / 12345678)", () => {
    const { result } = renderHook(() => useAuth());

    let loginRes: { success: boolean; error?: string } = { success: false };
    act(() => {
      loginRes = result.current.login("user", "12345678");
    });

    expect(loginRes.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("user");
    expect(localStorage.getItem("matearte_auth")).toBeTruthy();
  });

  it("rechaza credenciales incorrectas", () => {
    const { result } = renderHook(() => useAuth());

    let loginRes: { success: boolean; error?: string } = { success: false };
    act(() => {
      loginRes = result.current.login("user", "wrongpassword");
    });

    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toBe("Usuario o contraseña incorrectos.");
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("permite cerrar sesión y limpia el almacenamiento", () => {
    localStorage.setItem("matearte_auth", JSON.stringify({ username: "user" }));
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("matearte_auth")).toBeNull();
  });
});
