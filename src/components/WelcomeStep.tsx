import { useState } from 'react';
import type { UserData } from '../types/user';
import { signInWithGoogle } from '../lib/supabase';

interface WelcomeStepProps {
  initialData?: UserData;
  onSubmit: (data: UserData) => void;
}

export function WelcomeStep({ initialData, onSubmit }: WelcomeStepProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [company, setCompany] = useState(initialData?.company || '');
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setError('');
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        // En desarrollo/placeholder si no hay OAuth activo en Supabase console todavía
        onSubmit({
          name: 'Usuario Google',
          email: 'usuario.google@ejemplo.com',
          phone: '',
          company: '',
        });
      }
    } catch (err: any) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresá tu nombre completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor ingresá un correo electrónico válido.');
      return;
    }

    setError('');
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
    });
  };

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
            Creá tu Mate Exclusivo
          </h1>
          <p className="text-[#5f3826]/80 text-sm md:text-base max-w-md mx-auto leading-relaxed font-medium">
            Ingresá tus datos para guardar tus borradores y personalizar el modelo, la virola y el grabado en tiempo real.
          </p>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-6 space-y-4">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading}
            className="w-full py-3.5 px-4 rounded-xl border border-[#e7d7c1] bg-white hover:bg-[#fbf3de]/60 text-[#2d1d14] font-bold text-sm shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer"
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
            <span>{isGoogleLoading ? 'Conectando con Google...' : 'Registrarse con Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e7d7c1]" />
            </div>
            <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#a48e78]">
              O completá tus datos
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
            <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
              Nombre Completo <span className="text-[#7a4a31]">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Ej: Sofía Rodríguez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
              Correo Electrónico <span className="text-[#7a4a31]">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="sofia@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                Teléfono / WhatsApp <span className="text-[#a48e78] font-normal">(opcional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+598 99 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label htmlFor="company" className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                Empresa / Marca <span className="text-[#a48e78] font-normal">(opcional)</span>
              </label>
              <input
                id="company"
                type="text"
                placeholder="Para regalería corporativa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] placeholder-[#a48e78] focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31] transition-all text-sm font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3.5 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-sm shadow-lg shadow-[#7a4a31]/25 transition-all transform active:scale-[0.99] flex items-center justify-center cursor-pointer uppercase tracking-wider"
          >
            <span>Comenzar a Diseñar</span>
          </button>
        </form>

        {/* Footer info */}
        <p className="text-center text-xs text-[#5f3826]/70 mt-5 font-medium">
          Tus borradores se guardarán automáticamente en tu perfil de Matearte.
        </p>
      </div>
    </div>
  );
}
