import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, whatsappConsultationMessage, whatsappConsultationUrl } from "./whatsapp";

describe("enlaces de WhatsApp", () => {
  it("normaliza el teléfono y codifica el mensaje", () => {
    expect(buildWhatsAppUrl("+598 91 674 231", "Hola, quería hacer una consulta.")).toBe(
      "https://wa.me/59891674231?text=Hola%2C%20quer%C3%ADa%20hacer%20una%20consulta.",
    );
  });

  it("expone el enlace de consulta compartido", () => {
    expect(whatsappConsultationMessage).toBe("Hola, quería hacer una consulta.");
    expect(whatsappConsultationUrl).toContain("59891674231?text=");
  });
});
