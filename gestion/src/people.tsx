import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CountryFlag, LocationLabel } from "./location";
import { commerceSource } from "./commerceSource";
import type { PageProps } from "./pages";
import { areas } from "./navigation";
import { accessUserIds, canAccess, defaultAccess, isCustomAccessUserId, accessFor, lockedForRichard, setAreaAccess, setPageAccess, type AccessUserId } from "./access";
import { id, today, orgEmployees, type Employee, type Row, money } from "./data";
import { Card, Stats, Table, Modal, Form, AddButton } from "./ui";
import { formatDate } from "./dateFormat";

const departments = [
  {
    id: "t2",
    name: "Comercial",
    functions: [
      "Atención al cliente en el local",
      "Ventas por WhatsApp, Instagram, Facebook y otros canales",
      "Recepción de pedidos personalizados",
      "Cobros",
      "Control de stock del local",
      "Entrega de productos",
    ],
  },
  {
    id: "t3",
    name: "Operaciones",
    functions: [
      "Administración general",
      "Facturación",
      "Pagos y cobranzas",
      "Compras y gestión de proveedores",
      "Gestión de ventas mayoristas",
      "Organización y planificación de pedidos personalizados",
      "Coordinación entre ventas y producción",
      "Seguimiento del estado de los pedidos",
      "Operación de máquinas láser",
      "Elaboración de apliques en bronce",
      "Control de stock de insumos para producción",
    ],
  },
  {
    id: "t4",
    name: "Producción",
    functions: [
      "Organización de la producción",
      "Planificación y distribución de tareas",
      "Terminación de mates",
      "Control de calidad",
      "Coordinación de Rovert y Julio",
      "Cumplimiento de plazos de entrega",
    ],
  },
  {
    id: "t5",
    name: "Marketing",
    functions: [
      "Planificación de contenido",
      "Gestión de redes sociales: Instagram, TikTok y Facebook",
      "Creación de fotos, videos, reels e historias",
      "Publicidad y campañas",
      "Diseño gráfico",
      "Coordinación con influencers",
      "Análisis de métricas y resultados",
      "Posicionamiento y desarrollo de marca",
    ],
  },
] as const;

const directorFunctions = [
  "Estrategia y crecimiento",
  "Desarrollo de nuevos productos",
  "Alianzas y clientes estratégicos",
  "Expansión nacional e internacional",
  "Supervisión de todas las áreas",
];

function OrgNode({
  employee,
  functions,
  director = false,
}: {
  employee: Employee;
  functions?: readonly string[];
  director?: boolean;
}) {
  const identity = (
    <>
      <strong>{employee.name}</strong>
      <div className="org-node-role">{employee.role}</div>
      {functions && <div className="org-disclosure" aria-hidden="true" />}
    </>
  );
  const className = `org-node${director ? " org-node-director" : ""}`;
  if (!functions) return <div className={className}>{identity}</div>;
  return (
    <details className={className}>
      <summary>{identity}</summary>
      <div className="org-node-more">
        <ul>{functions.map((work) => <li key={work}>{work}</li>)}</ul>
      </div>
    </details>
  );
}

function OrgBranch({ employee, employees }: { employee: Employee; employees: Employee[] }) {
  const reports = employees.filter((member) => member.manager === employee.id);
  const functions = departments.find((department) => department.id === employee.id)?.functions;
  return (
    <div className="org-branch">
      <OrgNode employee={employee} functions={functions} />
      {reports.length > 0 && (
        <div className="org-children" style={{
          "--org-child-count": reports.length,
          "--org-child-offset": `${50 / reports.length}%`,
        } as CSSProperties}>
          {reports.map((member) => <OrgBranch key={member.id} employee={member} employees={employees} />)}
        </div>
      )}
    </div>
  );
}

export function People({
  s,
  update,
  mode,
}: PageProps & {
  mode: string;
}) {
  const [add, setAdd] = useState(false);
  const orgViewport = useRef<HTMLDivElement>(null);
  const director = s.employees.find((employee) => employee.id === "t1") ?? orgEmployees[0];
  const topReports = s.employees.filter((employee) => employee.manager === "t1");
  useEffect(() => {
    if (mode === "organigrama" && orgViewport.current) {
      const viewport = orgViewport.current;
      const center = () => {
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      };
      let width = viewport.clientWidth;
      center();
      const observer = new ResizeObserver(() => {
        if (viewport.clientWidth !== width) {
          width = viewport.clientWidth;
          center();
        }
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }
  }, [mode]);
  if (mode === "horas")
    return (
      <>
        <Stats
          items={[
            {
              label: "Horas registradas",
              value: s.source === "commerce" ? "—" : s.hours.reduce((a, h) => a + Number(h.horas), 0),
            },
            {
              label: "Personas con registros",
              value: s.source === "commerce" ? "—" : new Set(s.hours.map((h) => h.persona)).size,
            },
          ]}
        />
        <Table
          rows={s.hours}
          searchText={(h) => Object.values(h).join(" ")}
          action={
            s.source !== "commerce" && <AddButton onClick={() => setAdd(true)}>Registrar horas</AddButton>
          }
          columns={[
            { label: "Persona", render: (h) => String(h.persona) },
            { label: "Fecha", render: (h) => formatDate(String(h.fecha)) },
            { label: "Horas", render: (h) => String(h.horas) },
            { label: "Trabajo", render: (h) => String(h.tarea) },
          ]}
        />
        {add && (
          <Modal title="Registrar horas" onClose={() => setAdd(false)}>
            <Form
              fields={[
                {
                  key: "persona",
                  label: "Persona",
                  options: s.employees.map((e) => e.name),
                },
                { key: "fecha", label: "Fecha", type: "date" },
                { key: "horas", label: "Horas trabajadas", type: "number" },
                { key: "tarea", label: "Tarea realizada" },
              ]}
              initial={{ fecha: today }}
              onSave={(v) => {
                const hours = Number(v.horas);
                const existing = s.hours
                  .filter((h) => h.persona === v.persona && h.fecha === v.fecha)
                  .reduce((a, h) => a + Number(h.horas), 0);
                if (hours <= 0 || hours + existing > 24)
                  throw Error(
                    "El total diario debe ser mayor a cero y no superar 24 horas.",
                  );
                update(
                  (s) => ({
                    ...s,
                    hours: [{ id: id(), ...v, horas: hours }, ...s.hours],
                  }),
                  "Horas registradas",
                );
                setAdd(false);
              }}
            />
          </Modal>
        )}
      </>
    );
  return (
    <>
      <div className="toolbar">
        
        {s.source !== "commerce" && <AddButton onClick={() => setAdd(true)}>Agregar integrante</AddButton>}
      </div>
      {mode === "organigrama" ? (
        <div className="org-viewport" ref={orgViewport} role="region" aria-label="Organigrama de MateArte" tabIndex={0}>
          <div className="org-tree" style={{ minWidth: Math.max(1080, topReports.length * 280) }}>
            <div className="org-root">
              <OrgNode
                employee={director}
                functions={directorFunctions}
                director
              />
            </div>
            {topReports.length > 0 && (
              <div className="org-level" style={{
                "--org-count": topReports.length,
                "--org-offset": `${50 / topReports.length}%`,
              } as CSSProperties}>
                {topReports.map((employee) => <OrgBranch key={employee.id} employee={employee} employees={s.employees} />)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Table
          rows={s.employees}
          searchText={(e) => `${e.name} ${e.role}`}
          columns={[
            { label: "Nombre", render: (e) => <strong>{e.name}</strong> },
            { label: "Responsabilidad", render: (e) => e.role },
            {
              label: "Reporta a",
              render: (e) =>
                s.employees.find((x) => x.id === e.manager)?.name ||
                "Direcci\u00F3n general",
            },
            {
              label: "Horas registradas",
              render: (e) =>
                s.source === "commerce" ? "—" : s.hours
                  .filter((h) => h.persona === e.name)
                  .reduce((a, h) => a + Number(h.horas), 0),
            },
          ]}
        />
      )}{" "}
      {add && (
        <Modal title="Agregar integrante" onClose={() => setAdd(false)}>
          <Form
            fields={[
              { key: "name", label: "Nombre" },
              { key: "role", label: "Responsabilidad" },
              {
                key: "manager",
                label: "Reporta a",
                options: s.employees.map((e) => e.name),
              },
            ]}
            onSave={(v) => {
              update(
                (s) => ({
                  ...s,
                  employees: [
                    ...s.employees,
                    {
                      id: id(),
                      name: v.name,
                      role: v.role,
                      manager: s.employees.find((e) => e.name === v.manager)!
                        .id,
                    },
                  ],
                }),
                "Integrante agregado",
              );
              setAdd(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function Permissions({ s, update }: PageProps) {
  const [tab, setTab] = useState<"users" | "permissions">("users");
  return (
    <div className="access-page">
      <div className="tabs inner-tabs access-tabs" role="tablist" aria-label="Administración de usuarios">
        <button role="tab" aria-selected={tab === "users"} className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Usuarios</button>
        <button role="tab" aria-selected={tab === "permissions"} className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>Permisos</button>
      </div>
      {tab === "users" ? <AccessUsers s={s} /> : <AccessPermissions s={s} update={update} />}
    </div>
  );
}

type ManagedAccessUser = {
  userId?: string;
  accessUserId: AccessUserId;
  displayName?: string | null;
  username: string;
  configured: boolean;
  active?: boolean;
  allowedPaths?: string[] | null;
};

type AccessPerson = { id: AccessUserId; name: string; role: string };

const ownerKey = (userId: string) => `owner:${userId}`;
// Richard es el primer acceso completo (t1); las demás cuentas con acceso completo tienen fila propia.
const extraOwners = (users: ManagedAccessUser[]) => users.filter((user) => user.accessUserId === "t1").slice(1);
const personKey = (user: ManagedAccessUser, users: ManagedAccessUser[]) =>
  extraOwners(users).some((owner) => owner.userId === user.userId) ? ownerKey(user.userId!) : user.accessUserId;

function accessPeople(s: PageProps["s"], users: ManagedAccessUser[], withOwners = true): AccessPerson[] {
  const fixed = accessUserIds
    .map((userId) => s.employees.find((employee) => employee.id === userId))
    .filter((employee): employee is Employee => Boolean(employee))
    .map((employee) => ({ id: employee.id, name: employee.name, role: employee.role }));
  const custom = users
    .filter((user) => isCustomAccessUserId(user.accessUserId))
    .map((user) => ({ id: user.accessUserId, name: user.displayName || user.username, role: "Usuario de Gestión" }));
  const owners = withOwners
    ? extraOwners(users).map((user) => ({ id: ownerKey(user.userId!), name: user.displayName || user.username, role: "Acceso completo" }))
    : [];
  return [...fixed, ...owners, ...custom];
}

function AccessUsers({ s }: Pick<PageProps, "s">) {
  const [selectedId, setSelectedId] = useState<AccessUserId | "new">("t1");
  const [users, setUsers] = useState<ManagedAccessUser[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");
  const people = accessPeople(s, users);
  const adding = selectedId === "new";
  const selected = people.find((person) => person.id === selectedId);
  const entry = users.find((user) => personKey(user, users) === selectedId);
  const isOwner = selectedId === "t1" || selectedId.startsWith("owner:");
  const configured = entry?.configured ?? false;
  const active = entry?.active !== false;

  async function toggleActive() {
    if (adding || isOwner) return;
    const next = !active;
    setStatus("saving"); setMessage("");
    const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
      body: { action: "setActive", accessUserId: selectedId, active: next },
    });
    if (error || typeof data?.active !== "boolean") {
      setMessage(data?.error || "No se pudo cambiar el estado del usuario.");
    } else {
      setUsers((current) => current.map((user) => personKey(user, current) === selectedId ? { ...user, active: data.active } : user));
      setMessage(data.active ? "Usuario reactivado." : "Usuario pausado: ya no puede ingresar.");
    }
    setStatus("ready");
  }

  useEffect(() => {
    let cancelled = false;
    void commerceSource?.functions.invoke("gestion-users", { body: { action: "list" } }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !Array.isArray(data?.users)) {
        setMessage("No se pudieron cargar los usuarios de ingreso.");
      } else {
        setUsers(data.users);
      }
      setStatus("ready");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setUsername(adding ? "" : entry?.username ?? "");
    setDisplayName("");
    setPassword("");
    setConfirmation("");
  }, [selectedId, users]);

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (adding && !displayName.trim()) {
      setMessage("Ingresá el nombre de la persona.");
      return;
    }
    if (!/^[a-z0-9._-]{3,64}$/.test(cleanUsername)) {
      setMessage("El usuario debe tener entre 3 y 64 caracteres y usar solo letras, números, punto, guión o guion bajo.");
      return;
    }
    if ((adding || !configured || password) && password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setStatus("saving"); setMessage("");
    const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
      body: adding
        ? { action: "create", displayName: displayName.trim(), username: cleanUsername, password }
        : { action: "save", accessUserId: isOwner ? "t1" : selectedId, userId: selectedId.startsWith("owner:") ? entry?.userId : undefined, displayName: selected!.name, username: cleanUsername, password: password || undefined },
    });
    if (error || !data?.user) {
      setMessage(data?.error || "No se pudo guardar el usuario de ingreso.");
    } else {
      const saved: ManagedAccessUser = data.user;
      setUsers((current) => [...current.filter((user) => saved.userId && saved.accessUserId === "t1" ? user.userId !== saved.userId : user.accessUserId !== saved.accessUserId), saved]);
      if (adding) setSelectedId(saved.accessUserId);
      setMessage(adding ? "Usuario agregado y guardado." : "Usuario de ingreso guardado.");
      setPassword(""); setConfirmation("");
    }
    setStatus("ready");
  }

  const title = adding ? "Agregar usuario" : selected?.name ?? "";
  return (
    <div className="access-layout access-users-layout">
      <nav className="access-people" aria-label="Usuarios de ingreso">
        {people.map((person) => {
          const item = users.find((user) => personKey(user, users) === person.id);
          return <button key={person.id} className={selectedId === person.id ? "selected" : ""} aria-current={selectedId === person.id ? "true" : undefined} onClick={() => { setSelectedId(person.id); setMessage(""); }}>
            <strong>{person.name}</strong>
            <small>{!item?.configured ? "Pendiente de configurar" : item.active === false ? "Pausado" : "Usuario configurado"}</small>
          </button>;
        })}
        <button type="button" className="primary" disabled={status === "loading"} onClick={() => { setSelectedId("new"); setMessage(""); }}>Agregar usuario</button>
      </nav>
      <section className="access-main access-user-card" aria-labelledby="access-user-title">
        <div className="access-heading">
          <div><h2 id="access-user-title">{title}</h2><p>{adding ? "Creá el ingreso de una persona nueva. Después elegí sus pantallas en Permisos." : "Datos que usará para ingresar a Gestión. Sus pantallas se configuran en Permisos."}</p></div>
          {!adding && <span className={`access-user-status ${configured && active ? "configured" : "pending"}`}>{!configured ? "Sin configurar" : active ? "Configurado" : "Pausado"}</span>}
        </div>
        {status === "loading" ? <div role="status">Cargando usuario…</div> : (
          <form className="access-user-form" onSubmit={(event) => void saveUser(event)}>
            {adding && <label>Nombre de la persona<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="off" required /></label>}
            <label>Usuario de ingreso<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
            <label>{configured ? "Nueva contraseña" : "Contraseña"}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required={!configured} minLength={8} /></label>
            <label>Confirmar contraseña<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" required={!configured || Boolean(password)} minLength={8} /></label>
            {configured && <small className="access-user-help">Dejá la contraseña vacía si querés conservar la actual.</small>}
            {message && <div className={/(guardado|reactivado)\.$|pausado:/.test(message) ? "success" : "error"} role="status">{message}</div>}
            <div className="access-user-actions">
              <button className="primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Guardando…" : adding ? "Agregar usuario" : "Guardar usuario"}</button>
              {configured && !adding && !isOwner && (
                <button className="access-user-pause" type="button" disabled={status === "saving"} onClick={() => void toggleActive()}>
                  {active ? "Pausar usuario" : "Reactivar usuario"}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function AccessPermissions({ s, update }: Pick<PageProps, "s" | "update">) {
  const [selectedId, setSelectedId] = useState<AccessUserId>("t2");
  const [status, setStatus] = useState<"loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<ManagedAccessUser[]>([]);
  const people = accessPeople(s, users, false);
  const selected = people.find((person) => person.id === selectedId) ?? people[0];
  const selectedAccess = selectedId === "t1" ? null : new Set(accessFor(s, selectedId));

  useEffect(() => {
    let cancelled = false;
    void commerceSource?.functions.invoke("gestion-users", { body: { action: "list" } }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !Array.isArray(data?.users)) {
        setMessage("No se pudieron cargar los permisos guardados.");
      } else {
        setUsers(data.users);
        const persisted = Object.fromEntries(data.users
          .filter((user: ManagedAccessUser) => user.accessUserId !== "t1" && Array.isArray(user.allowedPaths))
          .map((user: ManagedAccessUser) => [user.accessUserId, user.allowedPaths]));
        update((current) => ({ ...current, access: { ...current.access, ...persisted } }), "");
      }
      setStatus("ready");
    });
    return () => { cancelled = true; };
  }, []);

  async function savePermissions(next: ReturnType<typeof setPageAccess>, userId: Exclude<AccessUserId, "t1">) {
    const previousPaths = accessFor(s, userId);
    const allowedPaths = next.access?.[userId] ?? [];
    update(() => next, "Guardando acceso…");
    setStatus("saving"); setMessage("");
    const { data, error } = await commerceSource!.functions.invoke("gestion-users", {
      body: { action: "savePermissions", accessUserId: userId, allowedPaths },
    });
    if (error || !Array.isArray(data?.allowedPaths)) {
      update((current) => ({ ...current, access: { ...current.access, [userId]: previousPaths } }), "No se pudo guardar el acceso");
      setMessage(data?.error || "No se pudieron guardar los permisos.");
    } else {
      update((current) => ({ ...current, access: { ...current.access, [userId]: data.allowedPaths } }), "Permisos guardados");
      setMessage("Permisos guardados en la base de datos.");
    }
    setStatus("ready");
  }
  return (
    <div className="access-layout">
      <nav className="access-people" aria-label="Usuarios con acceso">
        {people.map((person) => (
          <button
            key={person.id}
            className={selectedId === person.id ? "selected" : ""}
            aria-current={selectedId === person.id ? "true" : undefined}
            onClick={() => setSelectedId(person.id as AccessUserId)}
          >
            <strong>{person.name}</strong>
            <small>{person.id === "t1" ? "Acceso completo" : person.role}</small>
          </button>
        ))}
      </nav>
      <div className="access-main">
        <div className="access-heading">
          <h2>{selected.name}</h2>
          <div>{selectedId === "t1" ? "Acceso completo a todas las secciones" : "Secciones visibles para este usuario"}</div>
        </div>
        {status === "loading" && <div role="status">Cargando permisos…</div>}
        {message && <div className={message.startsWith("Permisos guardados") ? "success" : "error"} role="status">{message}</div>}
        <div className="access-areas">
          {areas.map((area) => {
            const eligible = area.pages.filter(([slug]) => selectedId === "t1" || !lockedForRichard(`/${area.id}/${slug}`));
            const granted = eligible.filter(([slug]) => selectedId === "t1" || selectedAccess?.has(`/${area.id}/${slug}`));
            const allGranted = eligible.length > 0 && granted.length === eligible.length;
            return (
              <section className="access-area" key={area.id}>
                <label className="access-area-head">
                  <input
                    type="checkbox"
                    aria-label={`Mostrar toda el área ${area.name} a ${selected.name}`}
                    checked={allGranted}
                    disabled={selectedId === "t1" || eligible.length === 0 || status !== "ready"}
                    onChange={(event) => void savePermissions(
                      setAreaAccess(s, selectedId as Exclude<AccessUserId, "t1">, area.id, event.target.checked),
                      selectedId as Exclude<AccessUserId, "t1">,
                    )}
                  />
                  <strong>{area.name}</strong>
                  <small>{eligible.length ? `${granted.length}/${eligible.length}` : "Solo Richard"}</small>
                </label>
                <div className="access-pages">
                  {area.pages.map(([slug, title]) => {
                    const path = `/${area.id}/${slug}`;
                    const locked = selectedId !== "t1" && lockedForRichard(path);
                    return (
                      <label key={path} className={locked ? "access-locked" : ""}>
                        <input
                          type="checkbox"
                          aria-label={`Mostrar ${title} a ${selected.name}`}
                          checked={selectedId === "t1" || (!locked && canAccess({ ...s, user: selected.name, activeUserId: selectedId }, path))}
                          disabled={selectedId === "t1" || locked || status !== "ready"}
                          onChange={(event) => void savePermissions(
                            setPageAccess(s, selectedId as Exclude<AccessUserId, "t1">, path, event.target.checked),
                            selectedId as Exclude<AccessUserId, "t1">,
                          )}
                        />
                        <div>{title}</div>
                        {locked && <small>Solo Richard</small>}
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
