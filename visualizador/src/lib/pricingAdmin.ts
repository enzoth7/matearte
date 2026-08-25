import type { Session } from "@supabase/supabase-js";
import { adminSupabase, isSupabaseConfigured } from "./supabase";

export type PricingRuleType = "family" | "texture" | "metal" | "size" | "customization" | "commission";
export type PricingValueKind = "uyu" | "percent";

export interface PricingRuleDefinition {
  rule_key: string;
  rule_type: PricingRuleType;
  label: string;
  value_kind: PricingValueKind;
  family_id: string | null;
  texture_id: string | null;
  color_id: string | null;
  metal_id: string | null;
  size_id: string | null;
  customization_id: string | null;
  required: boolean;
  active: boolean;
  sort_order: number;
}

export interface PricingVersionState {
  id: string;
  version: number;
  status: "draft" | "published";
  updatedAt: string;
  publishedAt: string | null;
  values: Record<string, number>;
}

export interface PricingAdminState {
  definitions: PricingRuleDefinition[];
  published: PricingVersionState;
  draft: PricingVersionState;
}

const ADMIN_USERNAME = (import.meta.env.VITE_PRICING_ADMIN_USERNAME || "user").trim().toLowerCase();
const ADMIN_EMAIL = (import.meta.env.VITE_PRICING_ADMIN_EMAIL || "pricing-admin@matearte.uy").trim().toLowerCase();

function parseVersion(value: unknown): PricingVersionState {
  if (!value || typeof value !== "object") throw new Error("La versión de precios no está disponible.");
  const input = value as Record<string, unknown>;
  const values = Object.fromEntries(
    Object.entries((input.values ?? {}) as Record<string, unknown>)
      .map(([key, amount]) => [key, Number(amount)] as const)
      .filter((entry) => Number.isFinite(entry[1]) && entry[1] >= 0),
  );
  return {
    id: String(input.id),
    version: Number(input.version),
    status: input.status === "published" ? "published" : "draft",
    updatedAt: String(input.updatedAt),
    publishedAt: input.publishedAt ? String(input.publishedAt) : null,
    values,
  };
}

function parseAdminState(data: unknown): PricingAdminState {
  if (!data || typeof data !== "object") throw new Error("Supabase devolvió un estado de precios inválido.");
  const input = data as Record<string, unknown>;
  if (!Array.isArray(input.definitions)) throw new Error("No se encontraron las reglas del catálogo.");
  return {
    definitions: input.definitions as PricingRuleDefinition[],
    published: parseVersion(input.published),
    draft: parseVersion(input.draft),
  };
}

function friendlyAdminError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Usuario o contraseña incorrectos.";
  if (/permission denied for function (save_pricing_draft|publish_pricing_draft)/i.test(message)) {
    return "La base de datos todavía no habilitó esta acción de precios. Aplicá la última migración y recargá.";
  }
  if (/not authorized|42501/i.test(message)) return "Esta cuenta no tiene permiso para administrar precios.";
  if (/another session|40001/i.test(message)) return "El borrador cambió en otra sesión. Recargá antes de continuar.";
  if (/pricing catalog has \d+ missing required values/i.test(message)) return "Faltan valores obligatorios antes de publicar.";
  if (/pricing catalog has \d+ invalid values/i.test(message)) return "Hay valores fuera del rango permitido.";
  if (/combinations with a zero total/i.test(message)) return "Todas las ramas deben tener un total mayor que cero.";
  if (/unknown pricing rule/i.test(message)) return "El borrador contiene una regla que no pertenece al catálogo activo.";
  return message || "No se pudo completar la operación.";
}

export async function getPricingAdminSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await adminSupabase.auth.getSession();
  return data.session;
}

export async function signInPricingAdmin(username: string, password: string) {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado.");
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) throw new Error("Usuario o contraseña incorrectos.");
  const { data, error } = await adminSupabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
  if (error || !data.session) throw new Error(friendlyAdminError(error));
  try {
    const state = await loadPricingAdminState();
    return { session: data.session, state };
  } catch (reason) {
    await adminSupabase.auth.signOut();
    throw new Error(friendlyAdminError(reason));
  }
}

export async function signOutPricingAdmin() {
  await adminSupabase.auth.signOut();
}

export async function loadPricingAdminState() {
  const { data, error } = await adminSupabase.rpc("get_pricing_admin_state");
  if (error) throw new Error(friendlyAdminError(error));
  return parseAdminState(data);
}

export async function savePricingDraft(state: PricingAdminState, values: Record<string, number | null>) {
  const { data, error } = await adminSupabase.rpc("save_pricing_draft", {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
    p_values: values,
  });
  if (error) throw new Error(friendlyAdminError(error));
  return parseAdminState(data);
}

export async function publishPricingDraft(state: PricingAdminState) {
  const { data, error } = await adminSupabase.rpc("publish_pricing_draft", {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
  });
  if (error) throw new Error(friendlyAdminError(error));
  return parseAdminState(data);
}

export async function saveAndPublishPricing(state: PricingAdminState, values: Record<string, number | null>) {
  const { data, error } = await adminSupabase.rpc("save_and_publish_pricing", {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
    p_values: values,
  });
  if (error) throw new Error(friendlyAdminError(error));
  return parseAdminState(data);
}
