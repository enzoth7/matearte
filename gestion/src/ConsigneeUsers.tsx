import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowClockwise, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import type { PageProps } from "./pages";
import { Modal } from "./ui";

type PortalUser = { userId: string; contactId: string; displayName: string; username: string; active: boolean };
type Notice = { text: string; kind: "error" | "success" };

export function ConsigneeUsers({ s, commerce, go }: Pick<PageProps, "s" | "commerce" | "go">) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [creatingContactId, setCreatingContactId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const existingContacts = new Set((s.consignments || []).map((item) => item.contactId));
  const contacts = (commerce?.wholesale?.contacts || []).filter((item) => existingContacts.has(item.id));
  const resetUser = users.find((item) => item.userId === resetUserId);
  const accessRows = [
    ...users.map((user) => ({ id: user.userId, contactId: user.contactId,
      client: contacts.find((item) => item.id === user.contactId)?.wholesale_name || user.displayName, user })),
    ...contacts.filter((contact) => !users.some((user) => user.contactId === contact.id))
      .map((contact) => ({ id: contact.id, contactId: contact.id, client: contact.wholesale_name, user: null })),
  ].sort((a, b) => a.client.localeCompare(b.client, "es") || a.id.localeCompare(b.id));
  const closeDialog = () => { setCreatingContactId(null); setResetUserId(null); setUsername(""); setPassword(""); setConfirmation(""); };
  const openCreate = (id = "") => { setResetUserId(null); setCreatingContactId(id); setUsername(""); setPassword(""); setConfirmation(""); setNotice(null); };
  const openReset = (id: string) => { setCreatingContactId(null); setResetUserId(id); setPassword(""); setConfirmation(""); setNotice(null); };

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
    const contact = contacts.find((item) => item.id === creatingContactId);
    if (!contact) { setNotice({ text: "Elegí un cliente con consignación.", kind: "error" }); return; }
    if (password !== confirmation) { setNotice({ text: "Las contraseñas no coinciden.", kind: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "createConsignee", contactId: contact.id, displayName: contact.wholesale_name, username: username.trim().toLowerCase(), password },
      });
      if (error || !data?.user) throw new Error(data?.error || "No se pudo crear el acceso.");
      setUsers((current) => [...current, data.user]); closeDialog();
      setNotice({ text: "Usuario creado inactivo. Activá el acceso después de conciliar el saldo.", kind: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo crear el acceso.", kind: "error" });
    } finally { setBusy(false); }
  }

  async function toggleActive(user: PortalUser) {
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "setConsigneeActive", userId: user.userId, active: !user.active },
      });
      if (error || typeof data?.active !== "boolean") throw new Error(data?.error || "No se pudo cambiar el acceso.");
      setUsers((current) => current.map((item) => item.userId === user.userId ? { ...item, active: data.active } : item));
      setNotice({ text: data.active ? "Acceso activado." : "Acceso desactivado.", kind: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo cambiar el acceso.", kind: "error" });
    } finally { setBusy(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetUser) return;
    if (password !== confirmation) { setNotice({ text: "Las contraseñas no coinciden.", kind: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
        body: { action: "resetConsigneePassword", userId: resetUser.userId, password },
      });
      if (error || !data?.userId) throw new Error(data?.error || "No se pudo cambiar la contraseña.");
      setNotice({ text: "Contraseña actualizada.", kind: "success" }); closeDialog();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "No se pudo cambiar la contraseña.", kind: "error" });
    } finally { setBusy(false); }
  }

  return <section className="consignee-users">
    {notice && creatingContactId === null && !resetUser && <div role={notice.kind === "error" ? "alert" : "status"} className={`consignee-users-notice ${notice.kind}`}>{notice.text}</div>}
    {loading ? <section className="consignee-users-state" role="status">
      <ArrowClockwise size={28} aria-hidden="true" /><h2>Cargando accesos</h2>
    </section> : loadError ? <section className="consignee-users-state consignee-users-state-error" role="alert">
      <WarningCircle size={32} aria-hidden="true" /><h2>No se pudieron cargar los accesos</h2>
      <div>{loadError}</div>
      <button type="button" className="secondary" onClick={() => void loadUsers()}><ArrowClockwise size={17} aria-hidden="true" />Reintentar</button>
    </section> : accessRows.length ? <>
      <div className="consignee-users-toolbar"><button type="button" className="primary" onClick={() => openCreate()}>Nuevo acceso</button></div>
      <div className="consignee-users-table-wrap"><table className="consignee-users-table">
        <thead><tr><th scope="col">Cliente</th><th scope="col">Usuario</th><th scope="col">Contraseña</th><th scope="col">Activo/Inactivo</th></tr></thead>
        <tbody>{accessRows.map((row) => <tr key={row.id}>
          <th scope="row">{row.client}</th>
          <td>{row.user ? <strong>{row.user.username}</strong> : <button type="button" className="text-button" onClick={() => openCreate(row.contactId)}>Crear usuario</button>}</td>
          <td>{row.user ? <button type="button" className="consignee-users-edit-button" aria-label={`Cambiar contraseña de ${row.user.username}`} title="Cambiar contraseña" onClick={() => openReset(row.user!.userId)}><PencilSimple size={19} aria-hidden="true" /></button> : "—"}</td>
          <td>{row.user ? <div className="consignee-users-status">
            <strong className={row.user.active ? "consignee-users-badge active" : "consignee-users-badge"}>{row.user.active ? "Activo" : "Inactivo"}</strong>
            <button type="button" className="text-button" disabled={busy} onClick={() => void toggleActive(row.user!)}>{row.user.active ? "Desactivar" : "Activar"}</button>
          </div> : <strong className="consignee-users-badge">Sin acceso</strong>}</td>
        </tr>)}</tbody>
      </table></div>
    </> : <section className="consignee-users-state">
      <h2>{existingContacts.size ? "No hay clientes disponibles" : "Primero registrá una consignación"}</h2>
      <div>{existingContacts.size ? "Actualizá Gestión para cargar los clientes vinculados." : "Cuando vincules un pedido a una consignación, el cliente aparecerá acá."}</div>
      <button type="button" className="primary" onClick={() => go("/consignaciones/resumen")}>Ir a Consignaciones</button>
    </section>}

    {creatingContactId !== null && <Modal title="Nuevo usuario consignatario" className="consignee-users-dialog" onClose={closeDialog}>
      <form className="consignee-users-form" onSubmit={(event) => void create(event)}>
        {notice?.kind === "error" && <div role="alert" className="consignee-users-notice error">{notice.text}</div>}
        <label>Cliente<select value={creatingContactId} onChange={(event) => setCreatingContactId(event.target.value)} required>
          <option value="">Elegir cliente</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.wholesale_name}</option>)}
        </select></label>
        <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" pattern="[a-zA-Z0-9._-]{3,64}" required /></label>
        <label>Contraseña<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>
        <label>Confirmar contraseña<input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></label>
        <footer><small>El acceso se crea inactivo.</small><button type="submit" className="primary" disabled={busy}>Crear usuario</button></footer>
      </form>
    </Modal>}
    {resetUser && <Modal title={`Cambiar contraseña de ${resetUser.username}`} className="consignee-users-dialog" onClose={closeDialog}>
      <form className="consignee-users-form" onSubmit={(event) => void resetPassword(event)}>
        {notice?.kind === "error" && <div role="alert" className="consignee-users-notice error">{notice.text}</div>}
        <label>Nueva contraseña<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Confirmar contraseña<input type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
        <footer><button type="submit" className="primary" disabled={busy}>Guardar contraseña</button></footer>
      </form>
    </Modal>}
  </section>;
}
