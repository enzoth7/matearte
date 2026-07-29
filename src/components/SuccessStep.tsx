import type { UserData } from '../types/user';

interface SuccessStepProps {
  userData: UserData;
  onReset: () => void;
}

export function SuccessStep({ userData, onReset }: SuccessStepProps) {
  return (
    <div className="py-8 md:py-12 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-lg bg-white/95 border border-[#e7d7c1] backdrop-blur-xl rounded-3xl p-8 md:p-10 shadow-2xl shadow-[#7a4a31]/10 text-center space-y-6 relative overflow-hidden">
        
        {/* Glow decorative background */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#7a4a31]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Check Animated Icon Badge */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#7a4a31]/10 border border-[#7a4a31]/20 text-[#7a4a31] shadow-lg shadow-[#7a4a31]/10">
          <svg className="h-10 w-10 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#7a4a31]/10 text-[#7a4a31] border border-[#7a4a31]/20">
            ¡Diseño Recibido con Éxito!
          </span>
          <h1 className="text-3xl font-black text-[#2d1d14] font-serif tracking-tight pt-1">
            ¡Muchas gracias, {userData.name}!
          </h1>
          <p className="text-[#5f3826]/80 text-sm leading-relaxed max-w-md mx-auto pt-2 font-medium">
            Hemos registrado las especificaciones de tu mate customizado. Un orfebre y asesor de ventas revisará tu diseño de virola y grabado.
          </p>
        </div>

        {/* Notification details Box */}
        <div className="bg-[#fdf7e9] border border-[#e7d7c1] rounded-2xl p-4 text-xs text-left space-y-2.5">
          <div className="flex items-center gap-2 text-[#5f3826]">
            <svg className="w-4 h-4 text-[#7a4a31] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Confirmación enviada a: <strong className="text-[#2d1d14] font-bold">{userData.email}</strong></span>
          </div>
          {userData.phone && (
            <div className="flex items-center gap-2 text-[#5f3826]">
              <svg className="w-4 h-4 text-[#7a4a31] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Te contactaremos por WhatsApp al: <strong className="text-[#2d1d14] font-bold">{userData.phone}</strong></span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-3.5 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-[#7a4a31]/20 shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span>👤 Volver a Mi Perfil</span>
          </button>
        </div>

      </div>
    </div>
  );
}
