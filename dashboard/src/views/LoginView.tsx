import { useState, type FormEvent } from "react";

interface LoginViewProps {
  onLogin: (username: string, password: string) => { success: boolean; error?: string };
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const result = onLogin(username, password);
    if (!result.success) {
      setError(result.error || "Credenciales incorrectas.");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-brand">
          <img src="/logo-matearte.avif" alt="MateArte Arte y Tradición" />
          <h1>MateArte</h1>
          <p>Panel de Operaciones</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresá tu usuario"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login-btn">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
