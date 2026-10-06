import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const AUTH_STORAGE_KEY = "matearte_auth";
const ADMIN_USERNAME = (import.meta.env.VITE_COMMERCE_ADMIN_USERNAME || "user").trim().toLowerCase();
const ADMIN_EMAIL = (import.meta.env.VITE_COMMERCE_ADMIN_EMAIL || "user@matearte.uy").trim().toLowerCase();
const useSupabaseAuth = isSupabaseConfigured && !import.meta.env.VITEST;

export interface AuthUser {
  username: string;
}

interface StoredAuth {
  username: string;
  authenticatedAt: string;
}

type LoginResult = { success: boolean; error?: string };

function getStoredAuth(): AuthUser | null {
  try {
    const raw = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed && typeof parsed.username === "string") return { username: parsed.username };
  } catch {
    // La sesión real de Supabase se comprueba después.
  }
  return null;
}

const storeUser = (username: string) => {
  try {
    globalThis.localStorage?.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ username, authenticatedAt: new Date().toISOString() }),
    );
  } catch {
    // El estado en memoria sigue funcionando aunque localStorage no esté disponible.
  }
};

const clearStoredUser = () => {
  try {
    globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Sin acción adicional.
  }
};

async function isStaffSession(session: Session) {
  if (!supabase) return false;
  const [{ data: commerceAdmin }, { data: pricingAdmin }] = await Promise.all([
    supabase.from("commerce_admin_users").select("user_id").eq("user_id", session.user.id).eq("active", true).maybeSingle(),
    supabase.from("admin_users").select("user_id").eq("user_id", session.user.id).eq("active", true).maybeSingle(),
  ]);
  return Boolean(commerceAdmin || pricingAdmin);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => useSupabaseAuth ? null : getStoredAuth());
  const [loading, setLoading] = useState(useSupabaseAuth);

  useEffect(() => {
    if (!supabase || !useSupabaseAuth) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (session && await isStaffSession(session)) {
        const stored = getStoredAuth();
        const username = stored?.username || session.user.email?.split("@")[0] || "user";
        setUser({ username });
        storeUser(username);
      } else {
        setUser(null);
        clearStoredUser();
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        clearStoredUser();
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback((usernameInput: string, passwordInput: string): LoginResult | Promise<LoginResult> => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (!username || !password) return { success: false, error: "Ingresá usuario y contraseña." };

    if (!supabase || !useSupabaseAuth) {
      if (username.toLowerCase() === "user" && password === "12345678") {
        storeUser("user");
        setUser({ username: "user" });
        return { success: true };
      }
      return { success: false, error: "Usuario o contraseña incorrectos." };
    }

    return (async () => {
      const normalized = username.toLowerCase();
      const email = normalized === ADMIN_USERNAME ? ADMIN_EMAIL : normalized;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) return { success: false, error: "Usuario o contraseña incorrectos." };

      if (!await isStaffSession(data.session)) {
        await supabase.auth.signOut();
        return { success: false, error: "Este usuario no tiene acceso al panel." };
      }

      storeUser(username);
      setUser({ username });
      return { success: true };
    })();
  }, []);

  const logout = useCallback(async () => {
    if (supabase && useSupabaseAuth) await supabase.auth.signOut();
    clearStoredUser();
    setUser(null);
  }, []);

  return {
    isAuthenticated: Boolean(user),
    loading,
    user,
    login,
    logout,
  };
}
