import { useCallback, useState } from "react";

const AUTH_STORAGE_KEY = "matearte_auth";

export interface AuthUser {
  username: string;
}

interface StoredAuth {
  username: string;
  authenticatedAt: string;
}

function getInitialAuth(): AuthUser | null {
  try {
    const raw = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed && typeof parsed.username === "string") {
      return { username: parsed.username };
    }
  } catch {
    // fallback
  }
  return null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getInitialAuth);

  const login = useCallback((usernameInput: string, passwordInput: string) => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (!username || !password) {
      return { success: false, error: "Ingresá usuario y contraseña." };
    }

    if (username.toLowerCase() === "user" && password === "12345678") {
      const authUser: AuthUser = { username: "user" };
      try {
        globalThis.localStorage?.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ username: "user", authenticatedAt: new Date().toISOString() }),
        );
      } catch {
        // ignore
      }
      setUser(authUser);
      return { success: true };
    }

    return { success: false, error: "Usuario o contraseña incorrectos." };
  }, []);

  const logout = useCallback(() => {
    try {
      globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return {
    isAuthenticated: Boolean(user),
    user,
    login,
    logout,
  };
}
