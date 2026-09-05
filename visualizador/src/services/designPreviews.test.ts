import { describe, expect, it } from "vitest";
import { requiredDesignPreviewRoles } from "./designPreviews";

describe("requiredDesignPreviewRoles", () => {
  it("incluye ambos lados del fleje cuando el modelo lo usa", () => {
    expect(requiredDesignPreviewRoles(true)).toEqual(["mate", "virola", "fleje_front", "fleje_back"]);
  });

  it("omite vistas vacías para modelos sin fleje", () => {
    expect(requiredDesignPreviewRoles(false)).toEqual(["mate", "virola"]);
  });
});
