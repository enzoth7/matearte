import { useState } from 'react';

interface ProductSelectionStepProps {
  onSelectMate: () => void;
}

export function ProductSelectionStep({ onSelectMate }: ProductSelectionStepProps) {
  const [isMateraModalOpen, setIsMateraModalOpen] = useState(false);

  return (
    <div className="py-10 md:py-16 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-5xl font-black text-[#2d1d14] font-serif">
            Elegí tu producto
          </h1>
          <p className="text-[#5f3826]/80 text-sm md:text-base max-w-lg mx-auto font-medium">
            Seleccioná la línea de taller que deseás personalizar en tiempo real.
          </p>
        </div>

        {/* Selection Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          
          {/* Card 1: Diseñar mi Mate */}
          <div className="bg-white/95 border-2 border-[#e7d7c1] hover:border-[#7a4a31] rounded-3xl p-8 shadow-xl shadow-[#7a4a31]/10 flex flex-col justify-between items-center text-center space-y-6 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#7a4a31]" />
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#7a4a31]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="h-48 w-full flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
              <img
                src="/assets/catalogo/Imperial Cincelado a Lacre/Imperial Cincelado a Lacre_Transp.png"
                alt="Mate Imperial Cincelado"
                className="h-full object-contain drop-shadow-md"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#2d1d14] font-serif">Diseñar Mi Mate</h2>
              <p className="text-xs text-[#5f3826]/80 leading-relaxed font-medium">
                Personalizá tu mate Imperial, Camionero o Torpedo con virola de alpaca, cincelado a elección y grabado láser en tiempo real.
              </p>
            </div>

            <button
              type="button"
              onClick={onSelectMate}
              className="w-full py-4 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#7a4a31]/20 transition-all cursor-pointer transform active:scale-[0.98]"
            >
              Diseñar Mi Mate
            </button>
          </div>

          {/* Card 2: Diseñar mi Matera */}
          <div className="bg-white/95 border-2 border-[#e7d7c1] hover:border-[#7a4a31] rounded-3xl p-8 shadow-xl shadow-[#7a4a31]/10 flex flex-col justify-between items-center text-center space-y-6 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#7a4a31]" />
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#7a4a31]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="h-48 w-full flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
              <img
                src="/assets/catalogo/0. Materas/Marrón_1_Transp.png"
                alt="Matera de Cuero Artesanal"
                className="h-full object-contain drop-shadow-md"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#2d1d14] font-serif">Diseñar Mi Matera</h2>
              <p className="text-xs text-[#5f3826]/80 leading-relaxed font-medium">
                Personalizá tu matera de cuero artesanal con compartimentos a medida, apliques de bronce y grabado personalizado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsMateraModalOpen(true)}
              className="w-full py-4 px-6 rounded-xl border-2 border-[#7a4a31] bg-white hover:bg-[#fbf3de] text-[#7a4a31] font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer transform active:scale-[0.98]"
            >
              Diseñar Mi Matera
            </button>
          </div>

        </div>

      </div>

      {/* Matera Dialog Modal (Próximamente) */}
      {isMateraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#e7d7c1] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative text-center animate-in fade-in zoom-in duration-150">
            <button
              type="button"
              onClick={() => setIsMateraModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 font-bold text-base cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-3 pt-4">
              <h3 className="text-2xl font-black text-[#2d1d14] font-serif uppercase tracking-tight">
                Próximamente
              </h3>
              <p className="text-sm text-[#5f3826]/80 leading-relaxed font-medium">
                Estamos trabajando en ajustar la experiencia. Muy pronto podrás hacerlo.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMateraModalOpen(false);
                  onSelectMate();
                }}
                className="w-full py-3.5 px-5 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
              >
                Ir a Diseñar Mi Mate
              </button>
              <button
                type="button"
                onClick={() => setIsMateraModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/50 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
