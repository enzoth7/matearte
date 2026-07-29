import { useState, type RefObject } from 'react';
import type { UserData } from '../types/user';
import { getModelDefinition, mateVariants, type MateModel } from '../catalog/mateCatalog';
import { getRimOption, type RimCustomization } from '../catalog/rimCatalog';
import { getRimFinish } from '../catalog/rimFinishCatalog';
import { getFlejeFinish } from '../catalog/flejeFinishCatalog';
import { rimIconCatalog } from '../catalog/rimIconCatalog';
import { getVariantPrice, getCustomizationPrice } from '../catalog/pricingCatalog';
import { ConfiguratorPreview } from './ConfiguratorPreview';
import { FlatFlejePreview, type FlejeCustomization } from './FlatFlejePreview';

interface SummaryStepProps {
  userData: UserData;
  configuration: {
    modelId: MateModel;
    variantId: string;
    rim: RimCustomization;
  };
  flejeConfig: FlejeCustomization;
  previewRef?: RefObject<HTMLDivElement | null>;
  onEditDesign: () => void;
  onEditContact: () => void;
  onSendToProduction: () => void;
  onSaveDraft: () => void;
}

export function SummaryStep({
  userData,
  configuration,
  flejeConfig,
  previewRef,
  onEditDesign,
  onEditContact,
  onSendToProduction,
  onSaveDraft,
}: SummaryStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  const modelDef = getModelDefinition(configuration.modelId);
  const variantDef = mateVariants.find((v) => v.id === configuration.variantId) || mateVariants[0];
  const rimMaterial = getRimOption(configuration.rim.rimId);
  const rimFinish = getRimFinish(configuration.rim.finishId);
  const flejeFinish = getFlejeFinish(flejeConfig.finishId);
  const rimIcon = configuration.rim.selectedImageId ? rimIconCatalog.find((i) => i.id === configuration.rim.selectedImageId) : null;
  const flejeIcon = flejeConfig.selectedImageId ? rimIconCatalog.find((i) => i.id === flejeConfig.selectedImageId) : null;

  const basePrice = getVariantPrice(configuration.variantId);

  // Virola extras dinámicos desde Supabase
  const rimFinishExtraUYU = configuration.rim.finishMode === "finish" ? getCustomizationPrice("rim_finish") : 0;
  const rimTextExtraUYU = configuration.rim.textMode === "text" ? getCustomizationPrice("rim_text") : 0;
  const rimImageExtraUYU = configuration.rim.imageMode === "image" ? getCustomizationPrice("rim_image") : 0;
  const totalExtraVirolaUYU = rimFinishExtraUYU + rimTextExtraUYU + rimImageExtraUYU;

  // Fleje extras dinámicos desde Supabase
  const flejeFinishExtraUYU = (modelDef.hasFleje && flejeConfig.finishMode === "finish") ? getCustomizationPrice("fleje_finish") : 0;
  const flejeTextExtraUYU = (modelDef.hasFleje && flejeConfig.textMode === "text") ? getCustomizationPrice("fleje_text") : 0;
  const flejeImageExtraUYU = (modelDef.hasFleje && flejeConfig.imageMode === "image") ? getCustomizationPrice("fleje_image") : 0;
  const totalExtraFlejeUYU = flejeFinishExtraUYU + flejeTextExtraUYU + flejeImageExtraUYU;

  const totalPriceUYU = basePrice.priceUYU + totalExtraVirolaUYU + totalExtraFlejeUYU;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onSendToProduction();
    } catch (err) {
      console.error('Error enviando a producción:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraft = () => {
    setIsDrafting(true);
    setTimeout(() => {
      setIsDrafting(false);
      onSaveDraft();
    }, 800);
  };

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="py-6 md:py-10 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-4xl bg-white/95 border border-[#e7d7c1] rounded-3xl p-6 md:p-10 shadow-2xl shadow-[#7a4a31]/10 space-y-8">
        
        {/* Header */}
        <div className="text-center border-b border-[#e7d7c1] pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-[#2d1d14] font-serif">
            Revisión de tu Orden de Diseño
          </h1>
          <p className="text-[#5f3826]/80 text-sm mt-1 font-medium">
            Verificá las especificaciones de tu mate personalizado antes de enviar a taller.
          </p>
        </div>

        {/* Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Visual Previews */}
          <div className="lg:col-span-6 space-y-6" ref={previewRef}>
            {/* 1. Selected Mate Model Preview Container */}
            <div className="bg-[#fbf3de]/60 border border-[#e7d7c1] rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-inner">
              <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-[#7a4a31] bg-white/90 px-2.5 py-1 rounded-md border border-[#e7d7c1] shadow-xs">
                Modelo Seleccionado: {modelDef.name}
              </span>
              <div className="w-full max-w-[280px] aspect-square flex items-center justify-center my-3">
                <img src={variantDef.image} alt={variantDef.name} className="h-full w-full object-contain" draggable={false} />
              </div>
              <span className="text-xs font-semibold text-[#5f3826] bg-[#fbf3de] px-3 py-1 rounded-full border border-[#e7d7c1]">
                {variantDef.name}
              </span>
            </div>

            {/* 2. Rim Top View Preview */}
            <div className="bg-[#fbf3de]/60 border border-[#e7d7c1] rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-inner">
              <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-[#7a4a31] bg-white/90 px-2.5 py-1 rounded-md border border-[#e7d7c1] shadow-xs">
                Vista de Virola (Superior)
              </span>
              <div className="w-full max-w-[320px] aspect-square flex items-center justify-center my-4">
                <ConfiguratorPreview rim={configuration.rim} />
              </div>
            </div>

            {/* 3. Fleje Preview (if applicable) */}
            {modelDef.hasFleje && (
              <div className="bg-[#fbf3de]/60 border border-[#e7d7c1] rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-inner">
                <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-[#7a4a31] bg-white/90 px-2.5 py-1 rounded-md border border-[#e7d7c1] shadow-xs">
                  Grabado de Fleje Desplegado
                </span>
                <div className="w-full max-w-[340px] my-3">
                  <FlatFlejePreview flejeConfig={flejeConfig} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Specification Details & Contact */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Contact Specs */}
            <div className="bg-[#fdf7e9] border border-[#e7d7c1] rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center border-b border-[#e7d7c1] pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#7a4a31] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Datos del Cliente
                </h3>
                <button
                  type="button"
                  onClick={onEditContact}
                  className="text-xs text-[#7a4a31] hover:underline font-bold cursor-pointer"
                >
                  Editar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#5f3826]/70 block font-medium">Nombre:</span>
                  <span className="font-bold text-[#2d1d14]">{userData.name}</span>
                </div>
                <div>
                  <span className="text-[#5f3826]/70 block font-medium">Email:</span>
                  <span className="font-bold text-[#2d1d14]">{userData.email}</span>
                </div>
                {userData.phone && (
                  <div>
                    <span className="text-[#5f3826]/70 block font-medium">WhatsApp:</span>
                    <span className="font-bold text-[#2d1d14]">{userData.phone}</span>
                  </div>
                )}
                {userData.company && (
                  <div>
                    <span className="text-[#5f3826]/70 block font-medium">Empresa:</span>
                    <span className="font-bold text-[#2d1d14]">{userData.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="bg-[#fdf7e9] border border-[#e7d7c1] rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[#e7d7c1] pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#7a4a31] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Especificaciones Técnicas
                </h3>
                <button
                  type="button"
                  onClick={onEditDesign}
                  className="text-xs text-[#7a4a31] hover:underline font-bold cursor-pointer"
                >
                  Modificar
                </button>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                  <dt className="text-[#5f3826]/70 font-medium">Modelo de Mate:</dt>
                  <dd className="font-bold text-[#2d1d14] text-right">{modelDef.name} — {variantDef.name}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                  <dt className="text-[#5f3826]/70 font-medium">Material de Virola:</dt>
                  <dd className="font-bold text-[#2d1d14] text-right">{rimMaterial?.name || 'Alpaca'}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                  <dt className="text-[#5f3826]/70 font-medium">Cincelado / Acabado Virola:</dt>
                  <dd className="font-bold text-[#2d1d14] text-right">{rimFinish?.name || 'Liso'}</dd>
                </div>
                {configuration.rim.text && (
                  <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                    <dt className="text-[#5f3826]/70 font-medium">Texto Grabado Virola:</dt>
                    <dd className="font-extrabold text-[#7a4a31] text-right">"{configuration.rim.text}"</dd>
                  </div>
                )}
                {rimIcon && (
                  <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                    <dt className="text-[#5f3826]/70 font-medium">Ícono Grabado Virola:</dt>
                    <dd className="font-bold text-[#2d1d14] text-right">{rimIcon.name}</dd>
                  </div>
                )}
                {modelDef.hasFleje && (
                  <>
                    <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                      <dt className="text-[#5f3826]/70 font-medium">Acabado de Fleje:</dt>
                      <dd className="font-bold text-[#2d1d14] text-right">{flejeFinish?.name || 'Estándar'}</dd>
                    </div>
                    {flejeConfig.text && (
                      <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                        <dt className="text-[#5f3826]/70 font-medium">Texto Grabado Fleje:</dt>
                        <dd className="font-extrabold text-[#7a4a31] text-right">"{flejeConfig.text}"</dd>
                      </div>
                    )}
                    {flejeIcon && (
                      <div className="flex justify-between py-1 border-b border-[#e7d7c1]/60">
                        <dt className="text-[#5f3826]/70 font-medium">Ícono Fleje:</dt>
                        <dd className="font-bold text-[#2d1d14] text-right">{flejeIcon.name}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>

            {/* Total Price Card */}
            <div className="bg-emerald-50 border-2 border-emerald-600/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 block">
                  Precio Total
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-950 font-serif block leading-none">
                  $ {totalPriceUYU.toLocaleString('es-UY')} UYU
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting || isDrafting}
                onClick={() => setShowDisclaimer(true)}
                className="w-full py-4 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-base shadow-xl shadow-[#7a4a31]/20 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 ENVIAR DISEÑO A PRODUCCIÓN</span>
                  </>
                )}
              </button>

              {/* NEW: Guardar borrador en mi perfil */}
              <button
                type="button"
                disabled={isSubmitting || isDrafting}
                onClick={handleDraft}
                className="w-full py-3.5 px-6 rounded-xl border border-[#7a4a31] bg-white hover:bg-[#fbf3de] text-[#7a4a31] font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider disabled:opacity-50"
              >
                {isDrafting ? (
                  <span>Guardando en perfil...</span>
                ) : (
                  <span>💾 GUARDAR BORRADOR EN MI PERFIL</span>
                )}
              </button>

              <button
                type="button"
                onClick={onEditDesign}
                className="w-full py-3 px-4 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/50 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors flex items-center justify-center cursor-pointer"
              >
                Volver a Modificar el Diseño
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Production Disclaimer Confirmation Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#e7d7c1] rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-700 border-b border-[#e7d7c1] pb-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-[#2d1d14] font-serif">Confirmar Envío a Producción</h3>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-900 leading-relaxed shadow-inner">
              ⚠️ Una vez enviado a la producción ya no puedes editar o eliminar este pedido.
            </div>

            <p className="text-xs text-[#5f3826]/80 font-medium">
              Tu mate se enviará directamente al taller para comenzar su fabricación. ¿Deseás confirmar el envío?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisclaimer(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/60 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisclaimer(false);
                  handleConfirm();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
              >
                Sí, Enviar a Producción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
