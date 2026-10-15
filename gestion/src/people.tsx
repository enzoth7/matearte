import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CountryFlag, LocationLabel } from "./location";
import type { PageProps } from "./pages";
import { areas } from "./navigation";
import { accessUserIds, canAccess, defaultAccess, lockedForRichard, setAreaAccess, setPageAccess, type AccessUserId } from "./access";
import { id, today, orgEmployees, type Employee, type Row, money } from "./data";
import { Card, Stats, Table, Modal, Form, AddButton } from "./ui";

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
            { label: "Fecha", render: (h) => String(h.fecha) },
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
  const [selectedId, setSelectedId] = useState<AccessUserId>("t2");
  const people = accessUserIds.map((userId) => s.employees.find((employee) => employee.id === userId)!);
  const selected = s.employees.find((employee) => employee.id === selectedId)!;
  const selectedAccess = selectedId === "t1" ? null : new Set(s.access?.[selectedId] ?? defaultAccess()[selectedId]);
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
                    disabled={selectedId === "t1" || eligible.length === 0}
                    onChange={(event) => update(
                      (current) => setAreaAccess(current, selectedId as "t2" | "t3", area.id, event.target.checked),
                      "Acceso actualizado",
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
                          disabled={selectedId === "t1" || locked}
                          onChange={(event) => update(
                            (current) => setPageAccess(current, selectedId as "t2" | "t3", path, event.target.checked),
                            "Acceso actualizado",
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
