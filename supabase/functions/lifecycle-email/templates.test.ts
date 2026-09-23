import assert from "node:assert/strict";
import test from "node:test";
import { buildBirthdayEmail, buildWelcomeEmail } from "./templates.ts";

const siteUrl = "https://www.matearteuruguay.com";

test("welcome email matches the approved Figma design", () => {
  const message = buildWelcomeEmail({ recipient_email: "ana@example.com", payload: { name: "Ana" } }, siteUrl);

  assert.equal(message.subject, "Bienvenido a MateArte");
  assert.match(message.html, /Bienvenida a MateArte/);
  assert.match(message.html, /Hola Ana! Tu cuenta ya está pronta/);
  assert.match(message.html, /Seguimiento en un solo lugar/);
  assert.match(message.html, /Compra más rápida/);
  assert.match(message.html, /Guardá tus mates personalizados/);
  assert.match(message.html, />IR A MI CUENTA</);
  assert.match(message.html, /href="https:\/\/www\.matearteuruguay\.com\/perfil"/);
  assert.doesNotMatch(message.html, /<\/?(?:p|span)\b/i);
});

test("birthday email matches the approved Figma design", () => {
  const message = buildBirthdayEmail({
    recipient_email: "ana@example.com",
    payload: {
      name: "Ana",
      discountCode: "SFD545DG7R5SF",
      discountPercent: "20%",
      discountValidity: "30 días desde ahora",
    },
  }, siteUrl);

  assert.equal(message.subject, "Se acerca tu cumpleaños, Ana");
  assert.match(message.html, /Se acerca tu cumpleaños/);
  assert.match(message.html, /descuento de 20% en tu compra de mates personalizados/);
  assert.match(message.html, /SFD545DG7R5SF/);
  assert.match(message.html, />20%</);
  assert.match(message.html, /30 días desde ahora/);
  assert.match(message.html, />VER PERSONALIZADOS</);
  assert.match(message.html, /href="https:\/\/www\.matearteuruguay\.com\/personalizados"/);
  assert.match(message.html, /assets\/matearte\/home-v2\/logo\.png/);
  assert.doesNotMatch(message.html, /<\/?(?:p|span)\b/i);
  assert.ok(!("headers" in message));
});
