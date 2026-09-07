import { describe, expect, it, vi } from "vitest";
import { subscribeNewsletterContact } from "@/lib/newsletter";

const config = { apiKey: "re_test", topicId: "topic_test" };

describe("newsletter de Resend", () => {
  it("crea un contacto nuevo y lo suscribe al topic", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));

    await subscribeNewsletterContact("persona@example.com", "Ana", config, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      email: "persona@example.com",
      unsubscribed: false,
      first_name: "Ana",
      topics: [{ id: "topic_test", subscription: "opt_in" }],
    });
  });

  it("reactiva un contacto existente y actualiza su topic", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await subscribeNewsletterContact("persona+mate@example.com", "", config, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toContain("persona%2Bmate%40example.com");
    expect(fetcher.mock.calls[2][0]).toContain("/topics");
  });

  it("informa un rechazo del proveedor", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(subscribeNewsletterContact("persona@example.com", "", config, fetcher)).rejects.toThrow("503");
  });
});
