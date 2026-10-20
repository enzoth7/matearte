import { describe, expect, it } from "vitest";
import { countryDisplayName, flagCode } from "./location";

describe("países guardados como código ISO", () => {
  it("muestra la bandera y el nombre de China", () => {
    expect(flagCode("CN")).toBe("cn");
    expect(countryDisplayName("CN")).toBe("China");
  });

  it("reconoce los otros códigos presentes en la agenda", () => {
    for (const code of ["AU", "CA", "GB", "PT", "RU", "AE", "HN", "PR", "NZ", "QA"]) {
      expect(flagCode(code)).toBe(code.toLowerCase());
      expect(countryDisplayName(code)).not.toBe(code);
    }
  });

  it("conserva países escritos por nombre o desconocidos", () => {
    expect(flagCode("Uruguay")).toBe("uy");
    expect(countryDisplayName("Uruguay")).toBe("Uruguay");
    expect(countryDisplayName("ZZ")).toBe("ZZ");
  });
});
