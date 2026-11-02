import { useEffect, useRef, useState } from "react";
import { callMarketing } from "./marketingApi";
import { formatDate } from "./dateFormat";

type Person = { email: string; name: string | null; detected_at: string };
type Result = { added?: number; total?: number; freshEmails?: string[]; unsubscribed?: Person[] };

// Quien tocó "Cancelar suscripción" en un correo no recibe más campañas. Al abrir la pestaña se copian las bajas
// de Resend a Gestión y se muestra quién es, para saber a quién no escribirle.
export function UnsubscribedPeople({ onNew }: { onNew?: () => void }) {
  const [result, setResult] = useState<{ total: number; people: Person[]; fresh: Person[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  useEffect(() => {
    let active = true;
    void callMarketing<Result>("syncUnsubscribes")
      .then((data) => {
        if (!active) return;
        const people = Array.isArray(data.unsubscribed) ? data.unsubscribed : [];
        const freshEmails = Array.isArray(data.freshEmails) ? data.freshEmails : [];
        setResult({ total: data.total ?? people.length, people, fresh: people.filter((person) => freshEmails.includes(person.email)) });
        if (data.added) onNewRef.current?.();
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) return <p className="marketing-unsubscribed-note">No se pudo revisar quién se dio de baja. Se vuelve a controlar al preparar cada envío.</p>;
  if (!result) return <p className="marketing-unsubscribed-note" role="status">Revisando bajas…</p>;
  const { total, people, fresh } = result;
  const label = (person: Person) => person.name || person.email;
  return <div className="marketing-unsubscribed">
    {fresh.length > 0 && <p className="marketing-unsubscribed-alert" role="status">
      {fresh.length === 1 ? "Nueva baja:" : `${fresh.length} bajas nuevas:`} {fresh.map(label).join(", ")}. {fresh.length === 1 ? "No va" : "No van"} a recibir más campañas.
    </p>}
    {total === 0
      ? <p className="marketing-unsubscribed-note">Nadie se dio de baja todavía. Quien lo haga queda registrado acá y no recibe más campañas.</p>
      : <details>
        <summary>{total} {total === 1 ? "persona se dio de baja" : "personas se dieron de baja"}</summary>
        <ul>
          {people.map((person) => <li key={person.email}><strong>{person.name || person.email}</strong>{person.name && <small>{person.email}</small>}<small>Detectada el {formatDate(person.detected_at)}</small></li>)}
        </ul>
        {total > people.length && <small>Se muestran las últimas {people.length}.</small>}
      </details>}
  </div>;
}
