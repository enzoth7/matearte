type Fetcher = typeof fetch;

export type NewsletterState = {
  status: "idle" | "success" | "invalid" | "error";
};

export const initialNewsletterState: NewsletterState = { status: "idle" };

type NewsletterConfig = {
  apiKey: string;
  topicId: string;
};

const resendUrl = "https://api.resend.com";

async function resendRequest(
  path: string,
  init: RequestInit,
  config: NewsletterConfig,
  fetcher: Fetcher,
) {
  return fetcher(`${resendUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "matearte/1.0",
      ...init.headers,
    },
    cache: "no-store",
  });
}

export async function subscribeNewsletterContact(
  email: string,
  name: string,
  config: NewsletterConfig,
  fetcher: Fetcher = fetch,
) {
  const encodedEmail = encodeURIComponent(email);
  const existing = await resendRequest(`/contacts/${encodedEmail}`, { method: "GET" }, config, fetcher);
  const firstName = name.trim() || undefined;
  const topicSubscription = [{ id: config.topicId, subscription: "opt_in" }];

  if (existing.status === 404) {
    const created = await resendRequest("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        unsubscribed: false,
        ...(firstName && { first_name: firstName }),
        topics: topicSubscription,
      }),
    }, config, fetcher);

    if (!created.ok) throw new Error(`Resend rechazó el alta (${created.status}).`);
    return;
  }

  if (!existing.ok) throw new Error(`Resend no pudo consultar el contacto (${existing.status}).`);

  const updated = await resendRequest(`/contacts/${encodedEmail}`, {
    method: "PATCH",
    body: JSON.stringify({
      unsubscribed: false,
      ...(firstName && { first_name: firstName }),
    }),
  }, config, fetcher);
  if (!updated.ok) throw new Error(`Resend no pudo actualizar el contacto (${updated.status}).`);

  const topicUpdated = await resendRequest(`/contacts/${encodedEmail}/topics`, {
    method: "PATCH",
    body: JSON.stringify({ topics: topicSubscription }),
  }, config, fetcher);
  if (!topicUpdated.ok) throw new Error(`Resend no pudo actualizar la suscripción (${topicUpdated.status}).`);
}
