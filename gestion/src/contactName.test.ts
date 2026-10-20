import { describe, expect, it } from "vitest";
import { formatContactName } from "../../shared/contactName";

describe("presentación de nombres de contactos", () => {
  it("capitaliza nombres personales sin quitar tildes", () => {
    expect(formatContactName("ENZO THOME")).toBe("Enzo Thome");
    expect(formatContactName("enzo")).toBe("Enzo");
    expect(formatContactName("JOSÉ GARCÍA")).toBe("José García");
    expect(formatContactName("JOAO")).toBe("Joao");
    expect(formatContactName("THIAGO MACCARI")).toBe("Thiago Maccari");
    expect(formatContactName("Adrian de LEÓN")).toBe("Adrian de León");
  });

  it("conserva siglas, etiquetas de productos y escrituras especiales", () => {
    expect(formatContactName("Dany EEUU")).toBe("Dany EEUU");
    expect(formatContactName("Imperial RDM Partido Nacional")).toBe("Imperial RDM Partido Nacional");
    expect(formatContactName("ADT Security Services S.A.")).toBe("ADT Security Services S.A.");
    expect(formatContactName("Тimur Rusia")).toBe("Тimur Rusia");
  });
});
