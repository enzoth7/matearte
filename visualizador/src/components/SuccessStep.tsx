import type { UserData } from "../types/user";

interface SuccessStepProps {
  userData: UserData;
  onReset: () => void;
  mockPayment?: boolean;
}
export function SuccessStep({ userData, onReset, mockPayment = false }: SuccessStepProps) {
  return (
    <main id="main-content" className="success-page">
      <section className="success-card" aria-labelledby="success-title" aria-describedby="success-description">
        <div className="success-card__icon" aria-hidden="true">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>

        <div className="success-card__copy">
          <p className="success-card__badge">
            {mockPayment ? "Simulación completada" : "Diseño recibido con éxito"}
          </p>
          <h1 id="success-title">¡Muchas gracias, {userData.name}!</h1>
          <p id="success-description">
            {mockPayment
              ? "Recorriste el checkout visual. No se procesó ningún cobro ni se envió el diseño a producción."
              : "Registramos las especificaciones de tu mate personalizado. Un orfebre y asesor de ventas revisará tu diseño."}
          </p>
        </div>

        {!mockPayment && (
          <div className="success-card__details">
            <p>Confirmación enviada a: <strong>{userData.email}</strong></p>
            {userData.phone && <p>Te contactaremos al: <strong>{userData.phone}</strong></p>}
          </div>
        )}

        <button type="button" onClick={onReset} className="brand-button success-card__action">Volver a mi perfil</button>
      </section>
    </main>
  );
}
