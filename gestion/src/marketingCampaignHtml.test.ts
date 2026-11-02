import { describe, expect, it } from "vitest";
import { marketingCampaignHtml } from "../../shared/marketingCampaignHtml";

describe("marketingCampaignHtml", () => {
  it("convierte el mensaje plano en párrafos seguros", () => {
    const html = marketingCampaignHtml({ mode: "message", subject: "Asunto", headline: "Oferta <h1>", body: "Hola <script>\nsegunda línea\n\nOtro párrafo", button_label: "Comprar ahora", image_url: null, target_url: "https://example.com/promocion" });
    expect(html).toContain("Oferta &lt;h1&gt;");
    expect(html).toContain("Hola &lt;script&gt;<br>segunda línea");
    expect(html).toContain("<p style=");
    expect(html).toContain("ARTE &amp; TRADICIÓN");
    expect(html).toContain("home-v2/logo.png");
    expect(html).toContain("COMPRAR AHORA");
    expect(html).toContain('href="https://example.com/promocion"');
    expect(html).not.toContain("<script>");
  });

  it("usa el asunto como título para los borradores anteriores y oculta el botón sin enlace", () => {
    const html = marketingCampaignHtml({ mode: "message", subject: "Borrador anterior", body: "Texto", image_url: null, target_url: null });
    expect(html).toContain(">Borrador anterior</h1>");
    expect(html).not.toContain("VER MÁS");
  });

  it("marca con UTM solo los enlaces a MateArte y muestra el código de descuento", () => {
    const html = marketingCampaignHtml({ mode: "message", subject: "Cyberlunes", body: "Texto", image_url: null, target_url: "https://www.matearteuruguay.com/catalogo?x=1", discount_code: "CYBER20", utm_campaign: "cyberlunes-20261130" });
    expect(html).toContain("utm_source=email&amp;utm_medium=campaign&amp;utm_campaign=cyberlunes-20261130");
    expect(html).toContain("x=1");
    expect(html).toContain("CYBER20");
    const external = marketingCampaignHtml({ mode: "message", subject: "Otro", body: "Texto", image_url: null, target_url: "https://example.com/promo", discount_code: "no valido!", utm_campaign: "otro" });
    expect(external).toContain('href="https://example.com/promo"');
    expect(external).not.toContain("utm_source");
    expect(external).not.toContain("Tu código de descuento");
  });

  it("envía solo la imagen y el pie de baja en modo imagen", () => {
    const html = marketingCampaignHtml({ mode: "image", subject: "Promoción", body: "", image_url: "https://example.com/foto.png", target_url: "https://example.com/tienda" });
    expect(html).toContain('<img src="https://example.com/foto.png"');
    expect(html).toContain("RESEND_UNSUBSCRIBE_URL");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h2");
    expect(html).not.toContain(">Promoción<");
    expect(html).not.toContain("ARTE &amp; TRADICIÓN");
  });

  it("centra la imagen sobre fondo blanco y usa el asunto como texto alternativo", () => {
    const html = marketingCampaignHtml({ mode: "image", subject: "Cyber <MateArte>", body: "", image_url: "https://example.com/foto.png", target_url: "https://www.matearteuruguay.com/", utm_campaign: "cyber-20261102" });
    expect(html).toContain("background:#ffffff");
    expect(html).not.toContain("#f6f0e8");
    expect(html).not.toContain("<main");
    expect(html).toContain('<td align="center">');
    expect(html).toContain('alt="Cyber &lt;MateArte&gt;"');
    expect(html).toContain("utm_campaign=cyber-20261102");
    expect(html).toContain("max-width:600px");
  });
});
