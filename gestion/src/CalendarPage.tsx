import { useEffect, useMemo, useRef, useState } from "react";
import { calendarEvents, categoryLabels, eventRange, eventsByDay, longDate, todayInUruguay, type CalendarEvent } from "./marketingCalendar";

const weekdays = ["L", "M", "M", "J", "V", "S", "D"];
const monthName = (year: number, month: number) => new Intl.DateTimeFormat("es-UY", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
const isoDay = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function Month({ year, month, days, today, onSelect }: { year: number; month: number; days: Map<string, CalendarEvent[]>; today: string; onSelect: (date: string) => void }) {
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  return <section className="mkt-cal-month" aria-label={`${monthName(year, month)} de ${year}`}>
    <h3>{monthName(year, month)}</h3>
    <div className="mkt-cal-grid" role="grid">
      {weekdays.map((letter, index) => <span key={index} className="mkt-cal-weekday" role="columnheader">{letter}</span>)}
      {cells.map((day, index) => {
        if (day === null) return <span key={`blank-${index}`} className="mkt-cal-blank" />;
        const date = isoDay(year, month, day);
        const events = days.get(date);
        const isToday = date === today;
        const className = `mkt-cal-day${events ? " has-event" : ""}${isToday ? " is-today" : ""}`;
        if (!events) return <span key={date} className={className} role="gridcell" aria-current={isToday ? "date" : undefined}>{day}</span>;
        return <button key={date} type="button" className={className} role="gridcell" aria-current={isToday ? "date" : undefined} aria-label={`${longDate(date)}: ${events.map((event) => event.name).join(", ")}${isToday ? " (hoy)" : ""}`} onClick={() => onSelect(date)}>{day}</button>;
      })}
    </div>
  </section>;
}

export function CalendarPage() {
  const today = useMemo(() => todayInUruguay(), []);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [selected, setSelected] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const days = useMemo(() => eventsByDay(year), [year]);
  const events = useMemo(() => calendarEvents(year), [year]);
  const selectedEvents = selected ? days.get(selected) || [] : [];
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    closeButton.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  const changeYear = (value: number) => { setSelected(null); setYear(value); };
  return <div className="mkt-cal-page">
    <div className="mkt-cal-toolbar">
      <div className="mkt-cal-year">
        <button type="button" className="secondary" aria-label="Año anterior" onClick={() => changeYear(year - 1)}>←</button>
        <strong>{year}</strong>
        <button type="button" className="secondary" aria-label="Año siguiente" onClick={() => changeYear(year + 1)}>→</button>
        {year !== Number(today.slice(0, 4)) && <button type="button" className="secondary" onClick={() => changeYear(Number(today.slice(0, 4)))}>Volver a hoy</button>}
      </div>
    </div>
    <p className="mkt-cal-note">Fechas pensadas para vender mate en Uruguay. Tocá un día violeta para ver de qué se trata.</p>
    <div className="mkt-cal-months">{Array.from({ length: 12 }, (_, month) => <Month key={month} year={year} month={month} days={days} today={today} onSelect={setSelected} />)}</div>
    <section className="mkt-cal-list" aria-labelledby="mkt-cal-list-title">
      <h2 id="mkt-cal-list-title">Fechas de {year}</h2>
      <ul>{events.map((event) => <li key={event.id}><button type="button" onClick={() => setSelected(event.start)}><span className="mkt-cal-list-date">{eventRange(event)}</span><span className="mkt-cal-list-name">{event.name}</span><small>{categoryLabels[event.category]}</small></button></li>)}</ul>
    </section>
    {selected && <div className="mkt-cal-overlay" onClick={() => setSelected(null)}>
      <div className="mkt-cal-dialog" role="dialog" aria-modal="true" aria-labelledby="mkt-cal-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="mkt-cal-dialog-head"><div><small>{longDate(selected)}{selected === today ? " · hoy" : ""}</small><h2 id="mkt-cal-dialog-title">{selectedEvents.map((event) => event.name).join(" y ")}</h2></div><button ref={closeButton} type="button" className="secondary" aria-label="Cerrar" onClick={() => setSelected(null)}>×</button></div>
        {selectedEvents.map((event) => <article key={event.id} className="mkt-cal-event">
          {selectedEvents.length > 1 && <h3>{event.name}</h3>}
          <p>{event.description}</p>
          <p className="mkt-cal-idea"><strong>Idea para MateArte:</strong> {event.idea}</p>
        </article>)}
      </div>
    </div>}
  </div>;
}
