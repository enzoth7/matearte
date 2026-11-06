import { loadMcpBridgeKey, mcpProofHeader, signedMcpRestFetch, verifyMcpRequest } from "./gestionMcpBridge.ts";

Deno.test("signs only project REST requests and binds the proof to the method, route and OAuth session", async () => {
  const key = await loadMcpBridgeKey({ rpc: async () => ({ data: "ab".repeat(32), error: null }) });
  if (!key) throw new Error("The test key could not be loaded");
  const identity = { sub: "actor", client_id: "client", session_id: "session" };
  const originalFetch = globalThis.fetch;
  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init));
    return new Response();
  };
  try {
    const signedFetch = signedMcpRestFetch(key, identity, "https://example.supabase.co");
    await signedFetch("https://example.supabase.co/rest/v1/commerce_products?select=id");
    await signedFetch("https://example.supabase.co/functions/v1/marketing-workspace");
    await signedFetch("https://elsewhere.example/rest/v1/commerce_products");
    const proof = requests[0].headers.get(mcpProofHeader) ?? "";
    if (!await verifyMcpRequest(key, identity, "rest:GET:/commerce_products", proof)) throw new Error("Invalid REST proof");
    if (await verifyMcpRequest(key, identity, "rest:POST:/commerce_products", proof) ||
      await verifyMcpRequest(key, identity, "rest:GET:/purchases", proof) ||
      await verifyMcpRequest(key, { ...identity, session_id: "different" }, "rest:GET:/commerce_products", proof)) {
      throw new Error("The proof was reusable with a different scope");
    }
    if (requests[0].redirect !== "error" || requests.slice(1).some((request) => request.headers.has(mcpProofHeader))) {
      throw new Error("The proof can leave the expected endpoint");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
