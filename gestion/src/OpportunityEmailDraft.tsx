import { useState } from "react";
import { buildOpportunityEmail } from "./commercialOpportunityEmail";
import { Modal } from "./ui";

type DraftRow = Parameters<typeof buildOpportunityEmail>[0] & {
  correo: string | null;
  canal: string;
  fuente_contacto: string;
};

export function OpportunityEmailDraft({
  row,
  onClose,
}: {
  row: DraftRow;
  onClose: () => void;
}) {
  const { subject, body } = buildOpportunityEmail(row);
  const recipient = row.correo;
  const [feedback, setFeedback] = useState("");

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(message);
    } catch {
      setFeedback("Seleccioná el texto para copiarlo manualmente.");
    }
  }

  return (
    <Modal
      title={`Correo para ${row.empresa}`}
      onClose={onClose}
      className="opportunity-email-draft"
    >
      {recipient ? (
        <div className="draft-copy-field">
          <label>
            Para
            <input readOnly value={recipient} />
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => void copy(recipient, "Destinatario copiado.")}
          >
            Copiar correo
          </button>
        </div>
      ) : (
        <div className="draft-contact-note">
          <strong>Sin correo publicado</strong>
          <a href={row.fuente_contacto} target="_blank" rel="noreferrer">
            {row.canal}
          </a>
        </div>
      )}
      <div className="draft-copy-field">
        <label>
          Asunto
          <input readOnly value={subject} />
        </label>
        <button
          className="secondary"
          type="button"
          onClick={() => void copy(subject, "Asunto copiado.")}
        >
          Copiar asunto
        </button>
      </div>
      <label className="draft-body">
        Mensaje
        <textarea readOnly rows={13} value={body} />
      </label>
      <div className="draft-actions">
        <button
          className="primary"
          type="button"
          onClick={() =>
            void copy(body, "Mensaje copiado para pegar en Gmail.")
          }
        >
          Copiar mensaje
        </button>
        <output aria-live="polite">{feedback}</output>
      </div>
    </Modal>
  );
}
