import { useState } from 'react';
import type { UserData } from '../types/user';
import { isSupabaseConfigured, signInWithGoogle, supabase } from '../lib/supabase';

interface WelcomeStepProps {
  initialData?: UserData;
  onSubmit: (data: UserData) => void;
}

export function WelcomeStep({ initialData, onSubmit }: WelcomeStepProps) {
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setError('');
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        onSubmit({
          name: 'Usuario Google',
          email: 'usuario.google@ejemplo.com',
          phone: '',
          company: '',
        });
      }
    } catch {
      onSubmit({
        name: 'Usuario Google',
        email: 'usuario.google@ejemplo.com',
        phone: '',
        company: '',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Por favor ingresá un correo electrónico válido.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setError('');
    setIsEmailLoading(true);

    try {
      // 1. Intentar Iniciar Sesión con Supabase Auth
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      let userId = signInData?.user?.id;
      let userName = signInData?.user?.user_metadata?.full_name || cleanEmail.split('@')[0];

      // 2. Si la cuenta no existe, Registrar automáticamente en Supabase Auth
      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanEmail.split('@')[0],
            },
          },
        });

        if (signUpError && !signUpError.message.includes('already registered')) {
          console.warn('Nota Auth:', signUpError.message);
        }

        userId = signUpData?.user?.id || userId;
      }

      const defaultName = initialData?.name || userName;
      onSubmit({
        id: userId,
        name: defaultName,
        email: cleanEmail,
        phone: initialData?.phone || '',
        company: initialData?.company || '',
      });
    } catch {
      // Fallback gracioso en desarrollo
      onSubmit({
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '',
        company: '',
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGuestAccess = () => {
    onSubmit({
      id: `demo-${Date.now()}`,
      isGuest: true,
      name: 'Demo MateArte',
      email: 'demo@matearte.uy',
      phone: '',
      company: '',
    });
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#e7d7c1] bg-white/95 p-8 shadow-2xl shadow-[#7a4a31]/10 backdrop-blur-xl md:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-60 w-60 rounded-full bg-[#7a4a31]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-60 w-60 rounded-full bg-[#f3e1b9]/40 blur-3xl" />

          <div className="relative text-center">
            <span className="inline-flex rounded-full border border-[#7a4a31]/20 bg-[#fbf3de] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7a4a31]">
              Demo para cliente
            </span>
            <h1 className="mt-5 font-serif text-3xl font-black tracking-tight text-[#2d1d14] md:text-4xl">
              Creá tu Mate
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-[#5f3826]/80 md:text-base">
              Explorá modelos, materiales y grabados en tiempo real sin crear una cuenta.
            </p>

            <button
              type="button"
              onClick={handleGuestAccess}
              className="mt-8 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#7a4a31] px-6 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-lg shadow-[#7a4a31]/25 transition-colors hover:bg-[#5f3826] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a4a31]"
            >
              Probar el visualizador
            </button>

            <p className="mt-5 text-xs font-medium leading-relaxed text-[#5f3826]/70">
              Modo demostración: la experiencia funciona sin conexión a una cuenta y no sincroniza datos entre dispositivos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12 px-4 flex flex-col justify-center items-center">
      {/* Container Card */}
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-[#e7d7c1] shadow-2xl shadow-[#7a4a31]/10 rounded-3xl p-8 md:p-10 relative overflow-hidden">
        
        {/* Glow effect decorative in warm leather tones */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#7a4a31]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#f3e1b9]/40 rounded-full blur-3xl pointer-events-none" />

        {/* Titles */}
        <div className="text-center mb-6 pt-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#2d1d14] mb-2 font-serif">
            Creá tu Mate
          </h1>
          <p className="text-[#5f3826]/80 text-sm md:text-base max-w-md mx-auto leading-relaxed font-medium">
            Ingresá tu correo y contraseña para guardar tus borradores y personalizar tu modelo en tiempo real.
          </p>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-6 space-y-4">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading || isEmailLoading}
            className="w-full py-3.5 px-4 rounded-xl border border-[#e7d7c1] bg-white hover:bg-[#fbf3de]/60 text-[#2d1d14] font-bold text-sm shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e7d7c1]" />
            </div>
            <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#a48e78]">
              O ingresá con tu correo
            </span>
          </div>
        </div>

        {/* Lead Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
              Correo Electrónico <span className="text-[#7a4a31]">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
              Contraseña <span className="text-[#7a4a31]">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={isEmailLoading || isGoogleLoading}
            className="w-full mt-4 py-3.5 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-sm shadow-lg shadow-[#7a4a31]/25 transition-all transform active:scale-[0.99] flex items-center justify-center cursor-pointer uppercase tracking-wider disabled:opacity-50"
          >
            <span>{isEmailLoading ? 'Ingresando...' : 'Comenzar a Diseñar'}</span>
          </button>
        </form>

        {/* Footer info */}
        <p className="text-center text-xs text-[#5f3826]/70 mt-5 font-medium leading-relaxed">
          Tus borradores se guardarán automáticamente asociados a tu cuenta.
        </p>
      </div>
    </div>
  );
}
