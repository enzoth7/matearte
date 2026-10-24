import { describe, it, expect, vi } from "vitest";
import { seed, loadState, storageKey } from "./data";
import { paths, resolvePath } from "./navigation";
import { collections } from "./collections";
describe("estado sin registros ficticios", () => {
  it("inicia todos los datos comerciales vacíos", () => {
    const state = seed();
    for (const key of ["products", "customers", "orders", "payments", "expenses", "hours", "activity"] as const) expect(state[key]).toEqual([]);
    expect(state.records).toEqual({}); expect(state.draft).toEqual({}); expect(state.published).toEqual({});
    Object.values(collections).forEach((collection) => expect(collection.rows).toEqual([]));
  });
  it("conserva el organigrama provisto por el usuario", () => {
    expect(seed().employees.filter((person) => person.manager === "t1").map((person) => person.name)).toEqual(["Florencia Costa", "Florencia Pizzorno", "Nicolás", "Betiana"]);
  });
  it("descarta el prototipo guardado sin borrar la sesión ni importar registros de preferencias", () => {
    const storage = new Map([["matearte-gestion-demo-v1", '{"orders":[{"id":"fake"}]}'], ["matearte-finance-opening-v1", "45000"], ["matearte-gestion-commerce-auth", "session"], [storageKey, '{"products":[{"id":"fake"}]}']]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) });
    try {
      expect(loadState().products).toEqual([]);
      expect(storage.has("matearte-gestion-demo-v1")).toBe(false);
      expect(storage.has("matearte-finance-opening-v1")).toBe(false);
      expect(storage.get("matearte-gestion-commerce-auth")).toBe("session");
    } finally { vi.unstubAllGlobals(); }
  });
  it("conserva permisos guardados al mover Precios a Ajustes y mayoristas", () => {
    const storage = new Map([[storageKey, JSON.stringify({ access: {
      t2: ["/comercial/registrar"],
      t3: ["/productos/precios", "/productos/catalogo", "/productos/publicacion", "/comercial/registrar"],
    } })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) });
    try {
      const access = loadState().access;
      expect(access?.t2).toEqual(["/comercial/registrar-min"]);
      expect(access?.t3).toEqual(["/productos/ajustes", "/productos/catalogo", "/comercial/registrar-may"]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("traslada el permiso local del configurador a Productos", () => {
    const storage = new Map([[storageKey, JSON.stringify({ access: {
      t3: ["/produccion/personalizados", "/produccion/configurador-personalizador"],
    } })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) });
    try {
      expect(loadState().access?.t3).toEqual(["/produccion/personalizados", "/productos/personalizador"]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("mantiene las rutas vigentes sin las páginas duplicadas", () => {
    expect(new Set(paths).size).toBe(51);
    paths.forEach((path) => expect(resolvePath(path)).not.toBeNull());
    expect(resolvePath("/administracion/comercio")).toBeNull();
    expect(resolvePath("/administracion/links")?.page[1]).toBe("Links");
    expect(resolvePath("/productos/ajustes")).not.toBeNull();
    expect(resolvePath("/productos/precios")).toBeNull();
    expect(resolvePath("/productos/publicacion")).toBeNull();
    expect(resolvePath("/comercial/registrar-min")).not.toBeNull();
    expect(resolvePath("/comercial/registrar-may")).not.toBeNull();
    expect(resolvePath("/comercial/registrar")).toBeNull();
    expect(resolvePath("/clientes/segmentos")).toBeNull();
    expect(resolvePath("/produccion/personalizados")?.page[1]).toBe("Pedidos personalizados");
    expect(resolvePath("/productos/personalizador")?.page[1]).toBe("Configurador Personalizador");
    expect(resolvePath("/produccion/configurador-personalizador")).toBeNull();
  });
});
