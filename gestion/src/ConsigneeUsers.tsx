import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowClockwise, CheckCircle, Plus, UserCirclePlus, WarningCircle } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import type { PageProps } from "./pages";

type PortalUser = { userId: string; contactId: string; displayName: string; username: string; active: boolean };
type Notice = { text: string; kind: "error" | "success" };

export function ConsigneeUsers({ s, commerce, go }: Pick<PageProps, "s" | "commerce" | "go">) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [selectedId, setSelectedId] = useState("new");
  const [contactId, setContactId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const existingContacts = new Set((s.consignments || []).map((item) => item.contactId));
  const contacts = (commerce?.wholesale?.contacts || []).filter((item) => existingContacts.has(item.id));
  const selected = users.find((item) => item.userId === selectedId);
  const activeCount = users.filter((item) => item.active).length;

  const loadUsers = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      if (!commerceSource) throw new Error("No hay conexión con Gestión.");
      const { data, error } = await commerceSource.functions.invoke("gestion-users", { body: { action: "listConsignees" } });
      if (error || !Array.isArray(data?.users)) throw new Error(data?.error || "Revisá la conexión y volvé a intentar.");
      setUsers(data.users);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Revisá la conexión y volvé a intentar.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setNotice({ text: "Las contraseñas no coinciden.", kind: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "createConsignee", contactId, displayName: displayName.trim(), username: username.trim().toLowerCase(), password },
      });
      if (error || !data?.user) throw new Error(data?.error || "No se pudo crear el acceso.");
      setUsers((current) => [...current, data.user]); setSelectedId(data.user.userId);
      setContactId(""); setDisplayName(""); setUsername(""); setPassword(""); setConfirmation("");
      setNotice({ text: "Cuenta creada y pausada. Activala después de conciliar el piloto.", kind: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo crear el acceso.", kind: "error" });
    } finally { setBusy(false); }
  }

  async function toggleActive() {
    if (!selected) return;
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "setConsigneeActive", userId: selected.userId, active: !selected.active },
      });
      if (error || typeof data?.active !== "boolean") throw new Error(data?.error || "No se pudo cambiar el acceso.");
      setUsers((current) => current.map((item) => item.userId === selected.userId ? { ...item, active: data.active } : item));
      setNotice({ text: data.active ? "Acceso habilitado." : "Acceso pausado.", kind: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo cambiar el acceso.", kind: "error" });
    } finally { setBusy(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (password !== confirmation) { setNotice({ text: "Las contraseñas no coinciden.", kind: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "resetConsigneePassword", userId: selected.userId, password },
      });
      if (error || !data?.userId) throw new Error(data?.error || "No se pudo cambiar la contraseña.");
      setNotice({ text: "Contraseña actualizada.", kind: "success" }); setPassword(""); setConfirmation("");
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo cambiar la contraseña.", kind: "error" });
    } finally { setBusy(false); }
  }

  return <section className="consignee-users">
    <header className="consignee-users-intro">
      <div>Creá y administrá el acceso de consulta de cada cliente con consignación.</div>
      {!loading && !loadError && <div className="consignee-users-count" aria-label={`${users.length} accesos, ${activeCount} habilitados`}>
        <strong>{users.length}</strong> {users.length === 1 ? "acceso" : "accesos"}
        <small>{activeCount} {activeCount === 1 ? "habilitado" : "habilitados"}</small>
      </div>}
    </header>

    {loading ? <section className="consignee-users-state" role="status">
      <ArrowClockwise size={28} aria-hidden="true" /><h2>Cargando accesos</h2>
      <div>Estamos consultando los usuarios consignatarios.</div>
    </section> : loadError ? <section className="consignee-users-state consignee-users-state-error" role="alert">
      <WarningCircle size={32} aria-hidden="true" /><h2>No se pudieron cargar los accesos</h2>
      <div>{loadError}</div>
      <button type="button" className="secondary" onClick={() => void loadUsers()}><ArrowClockwise size={17} aria-hidden="true" />Reintentar</button>
    </section> : <div className={users.length ? "consignee-users-layout" : "consignee-users-layout consignee-users-layout-empty"}>
      {users.length > 0 && <nav className="consignee-users-list" aria-label="Usuarios consignatarios">
        <header><h2>Accesos</h2><button type="button" aria-label="Nuevo consignatario" title="Nuevo consignatario" onClick={() => { setSelectedId("new"); setNotice(null); setPassword(""); setConfirmation(""); }}><Plus size={19} aria-hidden="true" /></button></header>
        {users.map((item) => <button type="button" key={item.userId} className={selectedId === item.userId ? "consignee-users-item selected" : "consignee-users-item"}
          aria-current={selectedId === item.userId ? "true" : undefined}
          onClick={() => { setSelectedId(item.userId); setPassword(""); setConfirmation(""); setNotice(null); }}>
          <strong>{item.displayName}</strong><small>{item.username}</small>
          <em className={item.active ? "consignee-users-badge active" : "consignee-users-badge"}>{item.active ? "Habilitado" : "Pausado"}</em>
        </button>)}
      </nav>}

      <section className="consignee-users-panel" aria-labelledby="consignee-users-panel-title">
        {selected ? <>
          <header className="consignee-users-panel-header">
            <div><h2 id="consignee-users-panel-title">{selected.displayName}</h2><div>Acceso al panel de sus consignaciones</div></div>
            <strong className={selected.active ? "consignee-users-badge active" : "consignee-users-badge"}>{selected.active ? "Habilitado" : "Pausado"}</strong>
          </header>
          {notice && <div role={notice.kind === "error" ? "alert" : "status"} className={`consignee-users-notice ${notice.kind}`}>{notice.kind === "success" && <CheckCircle size={19} aria-hidden="true" />}{notice.text}</div>}
          <dl className="consignee-users-details">
            <div><dt>Cliente</dt><dd>{contacts.find((item) => item.id === selected.contactId)?.wholesale_name || selected.contactId}</dd></div>
            <div><dt>Usuario de ingreso</dt><dd>{selected.username}</dd></div>
          </dl>
          <div className="consignee-users-access-action">
            <div><strong>{selected.active ? "Acceso habilitado" : "Acceso pausado"}</strong><small>{selected.active ? "Puede consultar sus consignaciones." : "El usuario todavía no puede ingresar."}</small></div>
            <button type="button" className={selected.active ? "secondary" : "primary"} disabled={busy} onClick={() => void toggleActive()}>{selected.active ? "Pausar acceso" : "Habilitar acceso"}</button>
          </div>
          <form className="consignee-users-password" onSubmit={(event) => void resetPassword(event)}>
            <h3>Cambiar contraseña</h3>
            <div className="consignee-users-fields">
              <label>Nueva contraseña<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label>Confirmar contraseña<input type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
            </div>
            <button type="submit" className="secondary" disabled={busy}>Guardar contraseña</button>
          </form>
        </> : !contacts.length ? <div className="consignee-users-empty">
          <UserCirclePlus size={38} aria-hidden="true" />
          <h2 id="consignee-users-panel-title">{existingContacts.size ? "No hay clientes disponibles" : "Primero registrá una consignación"}</h2>
          <div>{existingContacts.size ? "Actualizá los datos de Gestión para cargar los clientes vinculados a consignaciones." : "Cuando vincules un pedido mayorista a un cliente, vas a poder crear su acceso desde acá."}</div>
          {notice && <div role="alert" className="consignee-users-notice error">{notice.text}</div>}
          <button type="button" className="primary" onClick={() => go("/consignaciones/resumen")}>Ir a Consignaciones</button>
        </div> : <>
          <header className="consignee-users-panel-header"><div><h2 id="consignee-users-panel-title">Nuevo consignatario</h2><div>Vinculá el acceso a un cliente que ya tenga una consignación.</div></div></header>
          {notice && <div role={notice.kind === "error" ? "alert" : "status"} className={`consignee-users-notice ${notice.kind}`}>{notice.text}</div>}
          <form className="consignee-users-create" onSubmit={(event) => void create(event)}>
            <label>Cliente con consignación<select value={contactId} onChange={(event) => setContactId(event.target.value)} required>
              <option value="">Elegir cliente</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.wholesale_name}</option>)}
            </select></label>
            <div className="consignee-users-fields">
              <label>Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required /></label>
              <label>Usuario de ingreso<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
              <label>Contraseña<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>
              <label>Confirmar contraseña<input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></label>
            </div>
            <footer className="consignee-users-form-footer"><small>El acceso se crea pausado. Habilitalo después de conciliar el saldo.</small><button type="submit" className="primary" disabled={busy}>Crear cuenta pausada</button></footer>
          </form>
        </>}
      </section>
    </div>}
  </section>;
}
