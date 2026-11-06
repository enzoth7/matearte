// An unverified payload is only suitable for rejecting OAuth tokens early.
// Authorization must still verify the token with Supabase or a trusted issuer.
export function hasOAuthClient(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
    return Boolean(JSON.parse(new TextDecoder().decode(bytes))?.client_id);
  } catch {
    return false;
  }
}
