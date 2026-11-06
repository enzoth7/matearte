export const mcpProofHeader = "x-matearte-mcp-proof";
export const mcpMarketingReads = ["contacts", "campaigns", "metrics", "settings", "analytics"] as const;

type OAuthIdentity = { sub: string; session_id: string; client_id: string };

export function oauthIdentity(claims: Record<string, unknown> | null | undefined): OAuthIdentity | null {
  if (!claims || claims.role !== "authenticated" || typeof claims.sub !== "string" || !claims.sub ||
    typeof claims.session_id !== "string" || !claims.session_id || typeof claims.client_id !== "string" || !claims.client_id) {
    return null;
  }
  return { sub: claims.sub, session_id: claims.session_id, client_id: claims.client_id };
}

export async function loadMcpBridgeKey(admin: {
  rpc(name: "gestion_mcp_bridge_key"): PromiseLike<{ data: unknown; error: unknown }>;
}): Promise<CryptoKey | null> {
  const { data, error } = await admin.rpc("gestion_mcp_bridge_key");
  if (error || typeof data !== "string" || !/^[a-f0-9]{64}$/.test(data)) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(data), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const proofPayload = (identity: OAuthIdentity, scope: string, timestamp: string) =>
  new TextEncoder().encode(["matearte-mcp-v1", scope, identity.sub, identity.session_id, identity.client_id, timestamp].join("\n"));

export async function signMcpRequest(key: CryptoKey, identity: OAuthIdentity, scope: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, proofPayload(identity, scope, timestamp)));
  const signature = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${timestamp}.${signature}`;
}

export async function verifyMcpRequest(key: CryptoKey, identity: OAuthIdentity, scope: string, proof: string) {
  const match = /^([0-9]{10})\.([0-9a-f]{64})$/.exec(proof);
  if (!match || Math.abs(Date.now() / 1000 - Number(match[1])) > 30) return false;
  const signature = Uint8Array.from(match[2].match(/../g)!, (value) => parseInt(value, 16));
  return crypto.subtle.verify("HMAC", key, signature, proofPayload(identity, scope, match[1]));
}

export function signedMcpRestFetch(key: CryptoKey, identity: OAuthIdentity, supabaseUrl: string): typeof fetch {
  const origin = new URL(supabaseUrl).origin;
  return async (input, init) => {
    const request = new Request(input, init);
    const target = new URL(request.url);
    if (target.origin !== origin || !target.pathname.startsWith("/rest/v1/")) return fetch(request);
    request.headers.set(mcpProofHeader, await signMcpRequest(key, identity, `rest:${request.method}:${target.pathname.slice("/rest/v1".length)}`));
    return fetch(request, { redirect: "error" });
  };
}
