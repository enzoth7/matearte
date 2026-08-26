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
      <section className="access-card access-card--google" aria-labelledby="access-title">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em]">Tu cuenta MateArte</p>
          <h1 id="access-title" className="mt-3">Ingresar</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6">
            Guardá varios diseños, retomá cambios y pasá al carrito sin perder tu trabajo.
          </p>
        </div>

        {error && <p role="alert" className="access-error">{error}</p>}

        <button
          type="button"
          onClick={() => void continueWithGoogle()}
          disabled={loading}
          className="google-signin-button"
        >
          <img src="/google-logo.png" alt="" aria-hidden="true" width="24" height="24" />
          <span>{loading ? 'Conectando…' : 'Continuar con Google'}</span>
        </button>
      </section>
    </main>
  );
}
