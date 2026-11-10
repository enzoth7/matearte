import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { montevideoToday } from "./data";
import { Modal, Stats } from "./ui";
import { duration, monthDays, personnel, shiftMonth, validTime, workedMinutes, type TimeEntry } from "./personnelHoursModel";

const monthFormatter = new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("es-UY", { weekday: "short", timeZone: "UTC" });
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const initialUppercase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type Editor = { name: string; date: string; entry: TimeEntry | null };

export function PersonnelHours({ canManage }: { canManage: boolean }) {
  const loadSequence = useRef(0);
  const [month, setMonth] = useState(() => montevideoToday().slice(0, 7));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!commerceSource) { setLoading(false); setLoadError(true); return; }
    const days = monthDays(month);
    const { data, error } = await commerceSource.from("personnel_time_entries")
      .select("id,employee_name,work_date,clock_in,clock_out,source")
      .gte("work_date", days[0]).lte("work_date", days[days.length - 1])
      .order("work_date").order("employee_name");
    if (sequence !== loadSequence.current) return;
    if (error) {
      setLoadError(true);
      setEntries([]);
      setMessage("No se pudieron cargar los horarios. Intentá actualizar la página.");
    } else {
      setLoadError(false);
      setEntries((data || []) as TimeEntry[]);
      setMessage("");
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const today = montevideoToday();
  const days = monthDays(month);
  const names = [...new Set([...personnel, ...entries.map((entry) => entry.employee_name)])];
  const byCell = new Map(entries.map((entry) => [`${entry.work_date}:${entry.employee_name}`, entry]));
  const totalMinutes = entries.reduce((sum, entry) => sum + (workedMinutes(entry) ?? 0), 0);
  const needsReview = entries.filter((entry) => workedMinutes(entry) === null).length;
  const monthLabel = initialUppercase(monthFormatter.format(new Date(`${month}-01T12:00:00Z`)));

  function changeMonth(amount: number) {
    setLoading(true);
    setMessage("");
    setMonth((current) => shiftMonth(current, amount));
  }

  function openEditor(name: string, date: string, entry: TimeEntry | null) {
    setEditor({ name, date, entry });
    setEntryTime(validTime(entry?.clock_in ?? null) ? entry!.clock_in! : "");
    setExitTime(validTime(entry?.clock_out ?? null) ? entry!.clock_out! : "");
    setFormError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !commerceSource || saving || !canManage || loadError) return;
    if (!entryTime && !exitTime) { setFormError("Ingresá al menos una hora."); return; }
    if (entryTime && exitTime && exitTime <= entryTime) {
      setFormError("La salida debe ser posterior a la entrada. Si la planilla tiene un horario distinto, se conserva sin calcularlo.");
      return;
    }
    setSaving(true);
    setFormError("");
    const values = { clock_in: entryTime || null, clock_out: exitTime || null };
    const result = editor.entry
      ? await commerceSource.from("personnel_time_entries").update(values).eq("id", editor.entry.id).select("id").single()
      : await commerceSource.from("personnel_time_entries")
          .insert({ employee_name: editor.name, work_date: editor.date, ...values }).select("id").single();
    if (result.error) {
      setFormError(result.error.code === "23505"
        ? "Ya existe un registro para esta persona y fecha. Actualizá la página para verlo."
        : "No se pudo guardar el horario. Actualizá la página e intentá de nuevo.");
    } else {
      setEditor(null);
      await load();
      setMessage("Horario guardado.");
    }
    setSaving(false);
  }

  return <div className="personnel-hours">
    <Stats layout="hero" items={[
      { label: "Horas del mes", value: duration(totalMinutes), tone: "green" },
      { label: "Horarios registrados", value: entries.length },
      { label: "Horarios a revisar", value: needsReview, tone: needsReview ? "yellow" : "green" },
    ]} />
    <section className="card personnel-hours-register" aria-labelledby="personnel-hours-title">
      <header className="personnel-hours-head">
        <div>
          <h2 id="personnel-hours-title">Control de horarios</h2>
          <div>Elegí una persona y un día con el botón + para registrar o corregir entrada y salida.</div>
        </div>
        <nav className="personnel-month-navigation" aria-label="Cambiar mes">
          <button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><CaretLeft size={20} /></button>
          <strong aria-live="polite">{monthLabel}</strong>
          <button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><CaretRight size={20} /></button>
        </nav>
      </header>
      {message && <div className={loadError ? "error" : "success"} role="status">{message}</div>}
      {!canManage && <div className="personnel-hours-note">Solo las personas con acceso completo pueden registrar o corregir horarios.</div>}
      {loading ? <div role="status">Cargando horarios…</div> : <div className="personnel-hours-table-scroll">
        <table className="personnel-hours-table">
          <thead><tr><th scope="col">Día</th>{names.map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
          <tbody>{days.map((date) => {
            const weekday = dayFormatter.format(new Date(`${date}T12:00:00Z`));
            const weekend = ["sáb", "dom"].includes(weekday.toLowerCase().replace(".", ""));
            return <tr key={date} className={weekend ? "personnel-hours-weekend" : undefined}>
              <th scope="row"><strong>{Number(date.slice(-2))}</strong><small>{weekday}</small></th>
              {names.map((name) => {
                const entry = byCell.get(`${date}:${name}`) ?? null;
                const minutes = entry ? workedMinutes(entry) : null;
                return <td key={name} className={entry ? "personnel-hours-filled" : undefined}>
                  <div className="personnel-hours-cell">
                    {entry && <div className="personnel-hours-times">
                      <div><abbr title="Entrada">E</abbr> {entry.clock_in ?? "—"}</div>
                      <div><abbr title="Salida">S</abbr> {entry.clock_out ?? "—"}</div>
                      {minutes === null && <small className="personnel-hours-review">Revisar</small>}
                    </div>}
                    {canManage && <button type="button" className="personnel-hours-plus"
                      aria-label={`${entry ? "Editar" : "Agregar"} horario de ${name} el ${date}`}
                      title={entry ? "Editar horario" : "Agregar horario"}
                      disabled={loadError || saving} onClick={() => openEditor(name, date, entry)}><Plus size={16} weight="bold" /></button>}
                  </div>
                </td>;
              })}
            </tr>;
          })}</tbody>
          <tfoot><tr><th scope="row">Total</th>{names.map((name) => <td key={name}>{duration(entries.filter((entry) => entry.employee_name === name).reduce((sum, entry) => sum + (workedMinutes(entry) ?? 0), 0))}</td>)}</tr></tfoot>
        </table>
      </div>}
    </section>
    {editor && <Modal title={`Horario de ${editor.name}`} onClose={() => setEditor(null)}>
      <form onSubmit={(event) => void save(event)}>
        <div className="personnel-hours-modal-date">{initialUppercase(new Intl.DateTimeFormat("es-UY", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${editor.date}T12:00:00Z`)))}</div>
        {editor.entry?.source === "planilla" && <div className="personnel-hours-note">Este horario proviene de la planilla original.</div>}
        <div className="form-grid">
          <label>Entrada<input type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} /></label>
          <label>Salida<input type="time" value={exitTime} onChange={(event) => setExitTime(event.target.value)} /></label>
        </div>
        {editor.date === today && <div className="personnel-hours-now-actions">
          <button type="button" onClick={() => setEntryTime(clockFormatter.format(new Date()))}>Usar ahora en entrada</button>
          <button type="button" onClick={() => setExitTime(clockFormatter.format(new Date()))}>Usar ahora en salida</button>
        </div>}
        {formError && <div className="error" role="alert">{formError}</div>}
        <div className="form-actions"><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar horario"}</button></div>
      </form>
    </Modal>}
  </div>;
}
