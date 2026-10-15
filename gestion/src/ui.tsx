import { useEffect, useRef, useState, type ReactNode } from "react";
import { CountrySelect } from "./location";
import {
  MagnifyingGlass,
  Plus,
  X,
  DownloadSimple,
} from "@phosphor-icons/react";
import type { Field } from "./collections";
import { money } from "./data";
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly { name?: string | number; value?: unknown }[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{String(label ?? "")}</strong>
      {payload.map((item, i) => (
        <div key={i}>
          {item.name}: {money(Number(item.value))}
        </div>
      ))}
    </div>
  );
}
export type SignalTone = "green" | "yellow" | "red";
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: SignalTone;
}) {
  const s = String(children);
  const channelClass = s === "Web" ? "channel-web" : s === "Mayorista" ? "channel-mayorista" : s === "Local" ? "channel-local" : s === "Instagram" ? "channel-instagram" : s === "Facebook" ? "channel-facebook" : s === "WhatsApp" ? "channel-whatsapp" : s === "Sorteo" ? "channel-sorteo" : "";
  const inferredTone = /Pagado|Terminado|Entregado|Activo|Activa|Habilitado|Aprobado|Resuelto|Recibida|Publicado/.test(s)
    ? "green"
    : /Vencido|Atrasado|Bloqueado|Rechazado|Cancelado|Sin stock/.test(s)
      ? "red"
      : /Pendiente|Parcial|parcial|En producción|Revis|Borrador|Uso interno|Enviado/.test(s)
        ? "yellow"
        : undefined;
  return (
    <div className={`badge ${channelClass || tone || inferredTone || ""}`}>
      {children}
    </div>
  );
}
export function Card({
  title,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stats({
  items,
  layout = "strip",
}: {
  items: {
    label: string;
    value: string | number;
    note?: string;
    go?: () => void;
    tone?: SignalTone | "brown";
    solid?: boolean;
  }[];
  layout?: "strip" | "hero";
}) {
  return (
    <div className={`stats ${layout}`}>
      {items.map((i) => {
        const className = `stat ${i.tone ? `tone-${i.tone}` : ""} ${i.solid ? "solid" : ""}`;
        const content = <><div>{i.label}</div><strong>{i.value}</strong></>;
        return i.go ? (
          <button className={className} key={i.label} onClick={i.go} title={i.note}>
            {content}
          </button>
        ) : (
          <div className={className} key={i.label} title={i.note}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Form({
  fields,
  initial = {},
  onSave,
  submit = "Guardar",
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSave: (v: Record<string, string>) => void;
  submit?: string;
}) {
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >;
          onSave(v);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Revis\u00E1 los datos",
          );
        }
      }}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.options && f.key === "country" ? (
              <CountrySelect
                name={f.key}
                initial={String(initial[f.key] ?? "Sin especificar")}
              />
            ) : f.options ? (
              <select
                name={f.key}
                defaultValue={String(initial[f.key] ?? f.options[0])}
              >
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                required
                name={f.key}
                type={f.type || "text"}
                min={f.type === "number" ? 0 : undefined}
                step={f.type === "number" ? "any" : undefined}
                defaultValue={String(initial[f.key] ?? "")}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button className="primary">{submit}</button>
      </div>
    </form>
  );
}
export type Column<T> = {
  label: string;
  headerClassName?: string;
  render: (r: T) => ReactNode;
};
export function Table<
  T extends {
    id: string;
  },
>({
  rows,
  columns,
  searchText,
  title,
  action,
  showSearch = true,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (r: T) => string;
  title?: string;
  action?: ReactNode;
  showSearch?: boolean;
}) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((r) =>
    searchText(r).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="card table-card">
      <div className={`table-tools ${title ? "" : "no-title"}`}>
        {title && <h2>{title}</h2>}
        <div className="table-actions">
          {showSearch && <label className="search">
            <MagnifyingGlass size={18} />
            <input
              aria-label="Buscar en la tabla"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>}
          {action}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label} className={c.headerClassName}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.label} data-label={c.label}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty">
            {query ? "No hay coincidencias con esta búsqueda." : "No hay registros."}
          </div>
        )}
      </div>
      
    </section>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="primary" onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""')}"`;
  const blob = new Blob(
    [
      "\uFEFF" +
        [keys, ...rows.map((r) => keys.map((k) => r[k]))]
          .map((r) => r.map(escape).join(";"))
          .join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Export({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <button
      className="secondary"
      disabled={!rows.length}
      onClick={() => downloadCsv("matearte.csv", rows)}
    >
      Exportar
    </button>
  );
}
