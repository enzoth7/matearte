import { useState, useEffect } from 'react';
import type { UserData, SavedDesignItem } from '../types/user';
import { getUserDesigns, deleteDesign } from '../lib/supabase';
import { getModelDefinition, mateVariants } from '../catalog/mateCatalog';
import { getVariantPrice } from '../catalog/pricingCatalog';

interface ProfileStepProps {
  userData: UserData;
  localDesigns: SavedDesignItem[];
  onLoadDesign: (design: SavedDesignItem) => void;
  onNewDesign: () => void;
  onUpdateUserData: (data: UserData) => void;
  onLogout?: () => void;
  onSendDraftToProduction?: (design: SavedDesignItem) => Promise<void>;
}

export function ProfileStep({
  userData,
  localDesigns,
  onLoadDesign,
  onNewDesign,
  onUpdateUserData,
  onLogout,
  onSendDraftToProduction,
}: ProfileStepProps) {
  const [designs, setDesigns] = useState<SavedDesignItem[]>(localDesigns);
  const [loading, setLoading] = useState(true);

  // Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(userData.name);
  const [editEmail, setEditEmail] = useState(userData.email);
  const [editPhone, setEditPhone] = useState(userData.phone || '');
  const [editCompany, setEditCompany] = useState(userData.company || '');

  // Draft Production Disclaimer Modal State
  const [selectedDraftToSubmit, setSelectedDraftToSubmit] = useState<SavedDesignItem | null>(null);
  const [showDraftDisclaimer, setShowDraftDisclaimer] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  useEffect(() => {
    setEditName(userData.name);
    setEditEmail(userData.email);
    setEditPhone(userData.phone || '');
    setEditCompany(userData.company || '');
  }, [userData]);

  const fetchDesigns = async () => {
    setLoading(true);
    const { data, error } = await getUserDesigns(userData.id);
    if (!error && Array.isArray(data)) {
      setDesigns(data);
    } else {
      setDesigns(localDesigns);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDesigns();
  }, [userData.id]);

  const handleDelete = async (id: string) => {
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    await deleteDesign(id);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) return;

    onUpdateUserData({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      company: editCompany.trim(),
    });

    setIsEditModalOpen(false);
  };

  const handleConfirmSendDraftToProduction = async () => {
    if (!selectedDraftToSubmit || !onSendDraftToProduction) return;
    setIsSubmittingDraft(true);
    try {
      await onSendDraftToProduction(selectedDraftToSubmit);
      await fetchDesigns();
    } catch (err) {
      console.error('Error enviando borrador a producción:', err);
    } finally {
      setIsSubmittingDraft(false);
      setShowDraftDisclaimer(false);
      setSelectedDraftToSubmit(null);
    }
  };

  return (
    <div className="py-8 md:py-12 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Profile User Card */}
        <div className="bg-white/95 border border-[#e7d7c1] rounded-3xl p-6 md:p-8 shadow-xl shadow-[#7a4a31]/10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#7a4a31]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-5">
            {/* Mate Icon Avatar */}
            <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-[#7a4a31]/30 shadow-md shrink-0 bg-[#fbf3de] flex items-center justify-center">
              <img src="/logoma.jpg" alt="Matearte Icon" className="h-full w-full object-cover" />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#2d1d14] font-serif">{userData.name}</h1>
              <p className="text-xs font-semibold text-[#5f3826]/80">{userData.email}</p>
              {userData.phone && <p className="text-[11px] text-[#a48e78]">WhatsApp: {userData.phone}</p>}
              {userData.company && <p className="text-[11px] text-[#a48e78]">Empresa: {userData.company}</p>}
            </div>
          </div>

          {/* Action Bar Container */}
          <div className="flex flex-col gap-2.5 w-full md:w-[360px] shrink-0">
            {/* Top: Diseñar nuevo mate (full width) */}
            <button
              type="button"
              onClick={onNewDesign}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-sm md:text-base uppercase tracking-wider shadow-lg shadow-[#7a4a31]/20 transition-all cursor-pointer transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>＋ DISEÑAR NUEVO MATE</span>
            </button>

            {/* Bottom Row: 50% Editar mis datos | 50% Salir de la cuenta */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="py-2.5 px-3 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/70 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
              >
                <span>✏️ Editar mis datos</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="py-2.5 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
                >
                  <span>🚪 Salir de la cuenta</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Saved Drafts / Designs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#2d1d14] font-serif flex items-center gap-2">
              <span>🧉 Mis Borradores & Diseños Guardados</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#7a4a31]/10 text-[#7a4a31]">
                {designs.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white/80 border border-[#e7d7c1] rounded-2xl">
              <div className="inline-block animate-spin h-6 w-6 border-2 border-[#7a4a31] border-t-transparent rounded-full mb-2" />
              <p className="text-xs font-semibold text-[#5f3826]">Cargando tus borradores desde Supabase...</p>
            </div>
          ) : designs.length === 0 ? (
            <div className="p-12 text-center bg-white/90 border border-[#e7d7c1] rounded-3xl space-y-4 shadow-sm">
              <span className="text-4xl">🧉</span>
              <h3 className="text-lg font-bold text-[#2d1d14]">Todavía no tenés mates guardados</h3>
              <p className="text-xs text-[#5f3826]/80 max-w-sm mx-auto">
                Personalizá tu primer mate en tiempo real y guardalo en tu perfil para consultar o enviar a taller.
              </p>
              <button
                type="button"
                onClick={onNewDesign}
                className="py-3 px-6 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
              >
                Comenzar a Diseñar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {designs.map((design) => {
                const config = design.configuration || {};
                const modelDef = config.modelId ? getModelDefinition(config.modelId) : null;
                const variantDef = mateVariants.find((v) => v.id === config.variantId) || mateVariants[0];
                const isSubmitted = design.status === 'submitted';
                const price = config.variantId ? getVariantPrice(config.variantId) : null;

                return (
                  <div
                    key={design.id}
                    className="bg-white/95 border border-[#e7d7c1] rounded-2xl p-5 shadow-lg shadow-[#7a4a31]/5 flex flex-col justify-between space-y-4 relative hover:border-[#7a4a31]/40 transition-all"
                  >
                    {/* Badge status */}
                    <div className="flex justify-between items-center border-b border-[#e7d7c1]/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          isSubmitted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-[#f3e1b9] text-[#7a4a31] border border-[#e7d7c1]'
                        }`}>
                          {isSubmitted ? '✓ Enviado a Producción' : '💾 Borrador'}
                        </span>

                        {!isSubmitted && (
                          <button
                            type="button"
                            onClick={() => handleDelete(design.id)}
                            className="p-1 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer text-xs"
                            title="Eliminar borrador"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] text-[#a48e78] font-medium">
                        {new Date(design.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Content Preview */}
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-24 bg-[#fbf3de]/60 border border-[#e7d7c1] rounded-xl flex items-center justify-center p-2 shrink-0">
                        {variantDef && (
                          <img src={variantDef.image} alt={variantDef.name} className="h-full w-full object-contain" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-[#2d1d14] text-sm font-serif">
                          {design.title || (modelDef ? `Mate ${modelDef.name}` : 'Mate Custom')}
                        </h4>
                        <p className="text-xs text-[#5f3826]/80 font-medium">
                          {variantDef?.name}
                        </p>
                        {config.rim?.text && (
                          <p className="text-[11px] text-[#7a4a31] font-bold">
                            Virola: "{config.rim.text}"
                          </p>
                        )}
                        {design.fleje_config?.text && (
                          <p className="text-[11px] text-[#7a4a31] font-bold">
                            Fleje: "{design.fleje_config.text}"
                          </p>
                        )}
                        {price && price.priceUYU > 0 && (
                          <p className="text-xs font-black text-[#2d1d14] pt-1">
                            {price.formattedUYU} <span className="text-[10px] text-[#a48e78] font-normal">({price.formattedARS})</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions conditional based on status */}
                    {isSubmitted ? (
                      <div className="pt-2 border-t border-emerald-100/80">
                        <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs">
                          <span>🔒 En taller</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e7d7c1]/60">
                        <button
                          type="button"
                          onClick={() => onLoadDesign(design)}
                          className="py-2.5 px-3 rounded-xl bg-[#fbf3de] hover:bg-[#f3e1b9] text-[#7a4a31] font-extrabold text-xs transition-colors cursor-pointer text-center border border-[#e7d7c1] flex items-center justify-center gap-1"
                        >
                          ✏️ Cargar / Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDraftToSubmit(design);
                            setShowDraftDisclaimer(true);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all cursor-pointer text-center shadow-xs uppercase tracking-wider flex items-center justify-center gap-1"
                        >
                          🚀 Enviar Producción
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Production Disclaimer Modal for Drafts */}
      {showDraftDisclaimer && selectedDraftToSubmit && (
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
              El borrador <strong>"{selectedDraftToSubmit.title || 'Mate Custom'}"</strong> se enviará directamente a taller. ¿Deseás confirmar el envío?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingDraft}
                onClick={() => {
                  setShowDraftDisclaimer(false);
                  setSelectedDraftToSubmit(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/60 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingDraft}
                onClick={handleConfirmSendDraftToProduction}
                className="flex-1 py-3 px-4 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingDraft ? (
                  <span>Enviando...</span>
                ) : (
                  <span>Sí, Enviar a Producción</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Data Modal Dialog */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#e7d7c1] rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 relative animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-[#e7d7c1] pb-3">
              <h3 className="text-lg font-black text-[#2d1d14] font-serif">Editar Mis Datos</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5f3826] mb-1">
                  Empresa / Marca
                </label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#fdf7e9]/60 border border-[#e7d7c1] text-[#2d1d14] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7a4a31]/30 focus:border-[#7a4a31]"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/50 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
