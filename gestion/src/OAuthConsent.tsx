import { useEffect, useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";

type Details = {
  authorization_id: string;
  scope: string;
  redirect_uri: string;
  client: { name: string; logo_uri?: string };
};

export function OAuthConsent() {
  const authorizationId = new URLSearchParams(location.search).get("authorization_id") || "";
  const [status, setStatus] = useState<"loading" | "login" | "ready" | "denied">("loading");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!commerceSource || !authorizationId) { setError("Solicitud de conexión inválida."); setStatus("denied"); return; }
    const { data: auth } = await commerceSource.auth.getUser();
    if (!auth.user) { setStatus("login"); return; }
    const { data: membership, error: memberError } = await commerceSource.from("commerce_admin_users")
      .select("active,access_user_id").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
    if (memberError || membership?.access_user_id !== "t1") { setError("Esta cuenta no tiene permiso de propietario en Gestión."); setStatus("denied"); return; }
    const { data, error: detailsError } = await commerceSource.auth.oauth.getAuthorizationDetails(authorizationId);
    if (detailsError || !data) { setError("No se pudo validar la solicitud de conexión."); setStatus("denied"); return; }
    if ("redirect_url" in data) { location.assign(data.redirect_url); return; }
    setDetails(data as Details);
    setStatus("ready");
  };

  useEffect(() => { void load(); }, [authorizationId]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commerceSource) return;
    const fields = new FormData(event.currentTarget);
    const alias = String(fields.get("email") || "").trim();
    setBusy(true); setError("");
    const { error: loginError } = await commerceSource.auth.signInWithPassword({
      email: alias.includes("@") ? alias : `${alias}@matearte.uy`,
      password: String(fields.get("password") || ""),
    });
    if (loginError) setError("No se pudo ingresar. Revisá el usuario y la contraseña.");
    else await load();
    setBusy(false);
  };

  const decide = async (approve: boolean) => {
    if (!commerceSource || !details) return;
    setBusy(true); setError("");
    const { data, error: decisionError } = approve
      ? await commerceSource.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await commerceSource.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (decisionError || !data?.redirect_url) { setError("No se pudo completar la decisión. Volvé a intentar."); setBusy(false); return; }
    location.assign(data.redirect_url);
  };

  return <main className="gestion-login"><div className="commerce-auth">
    <img src="/matearte-icon.png" width="52" height="52" alt="MateArte" />
    <h1>Conectar con Gestión</h1>
    {status === "loading" && <p role="status">Comprobando la solicitud…</p>}
    {status === "login" && <>
      <p>Ingresá con tu cuenta de Gestión para revisar esta conexión.</p>
      <form onSubmit={(event) => void login(event)}>
        <label>Usuario o correo<input name="email" autoComplete="username" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit" className="primary" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </>}
    {status === "ready" && details && <>
      <p><strong>{details.client.name}</strong> solicita conectar tu cuenta de MateArte Gestión. El MCP de MateArte ofrece únicamente herramientas de consulta.</p>
      <p>Destino: {details.redirect_uri}</p>
      <p>Permisos solicitados: {details.scope || "identidad de la cuenta"}</p>
      <div className="commerce-auth-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void decide(true)}>Permitir consulta</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void decide(false)}>Rechazar</button>
      </div>
    </>}
    {status === "denied" && <p>No se puede autorizar esta conexión.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </div></main>;
}
