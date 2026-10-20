import { describe, expect, it } from "vitest";
import { newsletterConfirmationEmail } from "./newsletter-confirmation-email";

describe("newsletter confirmation email", () => {
  it("uses the branded template and a usable confirmation link in both formats", () => {
    const url = "https://www.matearteuruguay.com/api/newsletter/confirm?token_hash=abc123";
    const email = newsletterConfirmationEmail(url, "https://www.matearteuruguay.com");

    expect(email.html).toContain(`href="${url}"`);
    expect(email.html).toContain("email-monogram.png");
    expect(email.html).toContain("ARTE &amp; TRADICIÓN");
    expect(email.html).toContain("10% en tu primera compra");
    expect(email.text).toContain(url);
  });

  it("escapes an unexpected confirmation URL before placing it in HTML", () => {
    const email = newsletterConfirmationEmail('https://example.com/?x="&y=<script>', "https://example.com");
    expect(email.html).toContain('href="https://example.com/?x=&quot;&amp;y=&lt;script&gt;"');
    expect(email.html).not.toContain('<script>');
  });
});
