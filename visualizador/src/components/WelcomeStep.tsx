import { useState } from 'react';
import { signInWithGoogle } from '../lib/supabase';

export function WelcomeStep() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const continueWithGoogle = async () => {
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) throw authError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo continuar con Google.');
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="access-page">
      <div className="access-layout">
        <section className="access-story" aria-labelledby="access-story-title">
          <img src="/assets/acceso/historia-visual.png" alt="Mate, matera y accesorios artesanales de MateArte" />
          <div className="access-story__overlay" />
          <div className="access-story__copy">
            <h1 id="access-story-title">Todo lo tuyo,<br />siempre a mano.</h1>
            <p>Tus pedidos, tus diseños y tus datos listos para la próxima historia.</p>
          </div>
        </section>

        <div className="access-account">
          <section className="access-card access-card--google" aria-labelledby="access-title">
            <div>
              <h2 id="access-title">Ingresá a tu cuenta</h2>
              <p>Entrá con Google sin sumar otra contraseña.</p>
            </div>

            {error && <p role="alert" className="access-error">{error}</p>}

            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={loading}
              className="google-signin-button"
            >
              <img src="/google-logo.png" alt="" aria-hidden="true" width="35" height="35" />
              <span>{loading ? 'Conectando…' : 'Continuar con Google'}</span>
            </button>
            <small>Tu cuenta se crea automáticamente si todavía no existe.</small>
          </section>

          <section className="access-benefits" aria-labelledby="access-benefits-title">
            <h2 id="access-benefits-title">Con tu cuenta podés</h2>
            <ul>
              <li>Seguir el estado de cada pedido</li>
              <li>Retomar tus diseños personalizados</li>
              <li>Guardar tus datos de entrega</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
