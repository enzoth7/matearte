import { createHmac, timingSafeEqual } from "node:crypto";

export function newsletterUnsubscribeToken(email: string, secret: string) {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("base64url");
}

export function verifyNewsletterUnsubscribeToken(email: string, token: string, secret: string) {
  const expected = Buffer.from(newsletterUnsubscribeToken(email, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
