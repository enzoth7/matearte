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
    const storage = new Map([[storageKey, JSON.stringify({ access: { t3: ["/productos/precios", "/productos/catalogo", "/productos/publicacion"] } })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) });
    try {
      expect(loadState().access?.t3).toEqual(["/productos/ajustes", "/productos/catalogo"]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("mantiene las rutas vigentes sin las páginas duplicadas", () => {
    expect(new Set(paths).size).toBe(42);
    paths.forEach((path) => expect(resolvePath(path)).not.toBeNull());
    expect(resolvePath("/administracion/comercio")).toBeNull();
    expect(resolvePath("/productos/ajustes")).not.toBeNull();
    expect(resolvePath("/productos/precios")).toBeNull();
    expect(resolvePath("/productos/publicacion")).toBeNull();
  });
});
