import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { siteUrl, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

async function applyPendingAction(client: SupabaseClient, userId: string, action: string, payload: Record<string, unknown>) {
  if (action !== "add_design" || typeof payload.designId !== "string") return;
  const { data: design } = await client.from("designs").select("id").eq("id", payload.designId).eq("user_id", userId).maybeSingle();
  if (!design) return;
  let { data: cart } = await client.from("carts").select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!cart) {
    const created = await client.from("carts").insert({ user_id: userId }).select("id").single();
    cart = created.data;
  }
  if (cart) {
    const existing = await client.from("cart_items").select("id").eq("cart_id", cart.id).eq("design_id", design.id).maybeSingle();
    if (!existing.data) await client.from("cart_items").insert({ cart_id: cart.id, item_type: "design", design_id: design.id, quantity: 1 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const isOpaqueHandoffCode = /^[A-Za-z0-9_-]{43}$/.test(code);
  const isStoreOAuthCallback = url.searchParams.get("flow") === "store"
    || url.searchParams.has("error")
    || Boolean(code && !isOpaqueHandoffCode);

  if (isStoreOAuthCallback) {
    if (!code || url.searchParams.has("error")) {
      return NextResponse.redirect(`${siteUrl()}/perfil?auth=cancelled`, 303);
    }
    const server = await createServerSupabase();
    const { error } = await server.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${siteUrl()}/perfil?auth=failed`, 303);
    return NextResponse.redirect(`${siteUrl()}/perfil`, 303);
  }
  const failure = (reason: string) => NextResponse.redirect(`${siteUrl()}/carrito?handoff=${reason}`, 303);
  if (!isOpaqueHandoffCode) return failure("invalid");

  const edgeResponse = await fetch(`${supabaseUrl()}/functions/v1/auth-handoff`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabasePublishableKey()}`, apikey: supabasePublishableKey() }, body: JSON.stringify({ mode: "consume", code }), cache: "no-store",
  });
  const handoff = await edgeResponse.json();
  if (!edgeResponse.ok || !handoff.tokenHash) return failure("expired");

  const server = await createServerSupabase();
  const { data: verified, error: verifyError } = await server.auth.verifyOtp({ type: "magiclink", token_hash: handoff.tokenHash });
  if (verifyError) return failure("invalid");
  if (!verified.user) return failure("invalid");
  await applyPendingAction(server, verified.user.id, handoff.action, handoff.payload as Record<string, unknown>);
  const targetPath = ["/", "/carrito", "/checkout", "/pedidos", "/perfil"].includes(handoff.targetPath) ? handoff.targetPath : "/";
  return NextResponse.redirect(`${siteUrl()}${targetPath}`, 303);
}

export const dynamic = "force-dynamic";
