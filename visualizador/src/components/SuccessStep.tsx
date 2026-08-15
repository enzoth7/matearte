import type { UserData } from "../types/user";

interface SuccessStepProps {
  userData: UserData;
  onReset: () => void;
  mockPayment?: boolean;
}
export function SuccessStep({ userData, onReset, mockPayment = false }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 md:py-12">
      <div className="relative w-full max-w-lg space-y-6 overflow-hidden rounded-3xl border border-[#e7d7c1] bg-white/95 p-8 text-center shadow-2xl shadow-[#7a4a31]/10 md:p-10">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#7a4a31]/10 blur-3xl" />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#7a4a31]/20 bg-[#7a4a31]/10 text-[#7a4a31] shadow-lg shadow-[#7a4a31]/10">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full border border-[#7a4a31]/20 bg-[#7a4a31]/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#7a4a31]">
            {mockPayment ? "Simulación completada" : "Diseño recibido con éxito"}
          </span>
          <h1 className="pt-1 font-serif text-3xl font-black tracking-tight text-[#2d1d14]">¡Muchas gracias, {userData.name}!</h1>
          <p className="mx-auto max-w-md pt-2 text-sm font-medium leading-relaxed text-[#5f3826]/80">
            {mockPayment
              ? "Recorriste el checkout visual. No se procesó ningún cobro ni se envió el diseño a producción."
              : "Registramos las especificaciones de tu mate personalizado. Un orfebre y asesor de ventas revisará tu diseño."}
          </p>
        </div>

        {!mockPayment && (
          <div className="space-y-2.5 rounded-2xl border border-[#e7d7c1] bg-[#fdf7e9] p-4 text-left text-xs">
            <p className="text-[#5f3826]">Confirmación enviada a: <strong className="font-bold text-[#2d1d14]">{userData.email}</strong></p>
            {userData.phone && <p className="text-[#5f3826]">Te contactaremos al: <strong className="font-bold text-[#2d1d14]">{userData.phone}</strong></p>}
          </div>
        )}

        <div className="pt-3">
          <button type="button" onClick={onReset} className="min-h-12 w-full rounded-xl border border-[#7a4a31]/20 bg-[#7a4a31] px-6 text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-[#5f3826]">
            Volver a mi perfil
          </button>
        </div>
      </div>
    </div>
  );
}
