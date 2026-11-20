// Tabla del área CRM: ancho fijo con anchos por columna en %, el texto se parte en vez de desbordar.
// Prohibido el scroll horizontal (AGENTS.md). Opcional: orden por columna y filtro por valores en un
// menú (sin buscador), como en el CRM. Sin <p> ni <span>.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface ColumnaCrm<T> {
  id: string;
  titulo: string;
  /** Ancho en % de la tabla. */
  ancho: number;
  celda: (fila: T) => ReactNode;
  /** Para ordenar (número o texto). */
  orden?: (fila: T) => number | string;
  /** Para filtrar: el valor que se muestra en el menú. */
  filtro?: (fila: T) => string;
  derecha?: boolean;
}

export function TablaCrm<T extends { id: string }>({ filas, columnas, vacio, ordenInicial }: {
  filas: T[];
  columnas: ColumnaCrm<T>[];
  vacio: string;
  ordenInicial?: { id: string; desc: boolean };
}) {
  const [orden, setOrden] = useState(ordenInicial ?? null);
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [abierto, setAbierto] = useState<string | null>(null);

  const visibles = useMemo(() => {
    let r = filas.filter((f) => columnas.every((c) => !c.filtro || !filtros[c.id]?.size || filtros[c.id].has(c.filtro(f))));
    const col = orden && columnas.find((c) => c.id === orden.id);
    if (col?.orden) {
      const v = col.orden;
      r = [...r].sort((a, b) => {
        const x = v(a);
        const y = v(b);
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
        return orden?.desc ? -d : d;
      });
    }
    return r;
  }, [filas, columnas, filtros, orden]);

  return (
    <div className="crm-tabla">
      <table>
        <colgroup>
          {columnas.map((c) => (
            <col key={c.id} style={{ width: `${c.ancho}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activo = orden?.id === c.id;
              return (
                <th key={c.id} scope="col" className={c.derecha ? "derecha" : ""} aria-sort={activo ? (orden?.desc ? "descending" : "ascending") : undefined}>
                  <div className="crm-th">
                    {c.orden ? (
                      <button type="button" className="crm-th-orden" onClick={() => setOrden({ id: c.id, desc: activo ? !orden?.desc : true })}>
                        {c.titulo}
                        {activo && (orden?.desc ? " ↓" : " ↑")}
                      </button>
                    ) : (
                      c.titulo
                    )}
                    {c.filtro && (
                      <Filtro
                        titulo={c.titulo}
                        valores={[...new Set(filas.map(c.filtro))].sort((a, b) => a.localeCompare(b, "es"))}
                        elegidos={filtros[c.id] ?? new Set()}
                        abierto={abierto === c.id}
                        abrir={(v) => setAbierto(v ? c.id : null)}
                        cambiar={(s) => setFiltros((f) => ({ ...f, [c.id]: s }))}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibles.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="crm-tabla-vacia">{vacio}</td>
            </tr>
          ) : (
            visibles.map((f) => (
              <tr key={f.id}>
                {columnas.map((c) => (
                  <td key={c.id} data-columna={c.titulo} className={c.derecha ? "derecha" : ""}>{c.celda(f)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Filtro({ titulo, valores, elegidos, abierto, abrir, cambiar }: {
  titulo: string;
  valores: string[];
  elegidos: Set<string>;
  abierto: boolean;
  abrir: (v: boolean) => void;
  cambiar: (s: Set<string>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && abrir(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && abrir(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto, abrir]);
  return (
    <div className="crm-filtro" ref={ref}>
      <button type="button" className={`crm-filtro-boton ${elegidos.size ? "activo" : ""}`} aria-label={`Filtrar ${titulo}`} aria-expanded={abierto} onClick={() => abrir(!abierto)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      {abierto && (
        <div className="crm-filtro-menu" role="group" aria-label={`Filtrar ${titulo}`}>
          {valores.map((v) => (
            <label key={v}>
              <input
                type="checkbox"
                checked={elegidos.has(v)}
                onChange={() => {
                  const s = new Set(elegidos);
                  if (s.has(v)) s.delete(v);
                  else s.add(v);
                  cambiar(s);
                }}
              />
              {v}
            </label>
          ))}
          {elegidos.size > 0 && (
            <button type="button" onClick={() => cambiar(new Set())}>Ver todos</button>
          )}
        </div>
      )}
    </div>
  );
}
