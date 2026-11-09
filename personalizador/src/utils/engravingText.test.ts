import { describe, expect, it } from "vitest";
import { limitEngravingCharacters, normalizeEngravingText } from "./engravingText";

describe("texto de grabado Unicode", () => {
  it("conserva símbolos y escrituras no latinas al normalizar", () => {
    expect(normalizeEngravingText("Ø Ж 日本語 中文")).toBe("Ø Ж 日本語 中文");
  });

  it("limita caracteres completos sin cortar pares Unicode", () => {
    expect(limitEngravingCharacters("Ø日本語🧉", 4)).toBe("Ø日本語");
  });
});
