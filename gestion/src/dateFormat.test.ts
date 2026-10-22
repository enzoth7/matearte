import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./dateFormat";

describe("formato de fechas", () => {
  it("muestra DD/MM/AAAA para fechas y marcas de tiempo", () => {
    expect(formatDate("2026-10-21")).toBe("21/10/2026");
    expect(formatDate("2026-10-21T01:30:00Z")).toBe("20/10/2026");
    expect(formatDate("2026-10-21T12:00:00-03:00")).toBe("21/10/2026");
    expect(formatDateTime("2026-10-21T15:45:00-03:00")).toBe("21/10/2026 15:45");
  });
  it("devuelve el texto de reemplazo cuando no hay fecha", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("", "")).toBe("");
    expect(formatDate("sin fecha")).toBe("sin fecha");
  });
});
