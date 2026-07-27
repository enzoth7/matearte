import { useState, useEffect } from 'react';
import type { UserData, SavedDesignItem } from '../types/user';
import { getUserDesigns, deleteDesign } from '../lib/supabase';
import { getModelDefinition, mateVariants } from '../catalog/mateCatalog';

interface ProfileStepProps {
  userData: UserData;
  localDesigns: SavedDesignItem[];
  onLoadDesign: (design: SavedDesignItem) => void;
  onNewDesign: () => void;
  onUpdateUserData: (data: UserData) => void;
}

export function ProfileStep({
  userData,
  localDesigns,
  onLoadDesign,
  onNewDesign,
  onUpdateUserData,
}: ProfileStepProps) {
  const [designs, setDesigns] = useState<SavedDesignItem[]>(localDesigns);
  const [loading, setLoading] = useState(true);

  // Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(userData.name);
  const [editEmail, setEditEmail] = useState(userData.email);
  const [editPhone, setEditPhone] = useState(userData.phone || '');
  const [editCompany, setEditCompany] = useState(userData.company || '');

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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="py-2.5 px-4 rounded-xl border border-[#e7d7c1] bg-[#fbf3de]/50 hover:bg-[#fbf3de] text-[#5f3826] font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>✏️ Editar mis datos</span>
            </button>
            <button
              type="button"
              onClick={onNewDesign}
              className="py-3 px-5 rounded-xl bg-[#7a4a31] hover:bg-[#5f3826] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
            >
              + Diseñar Nuevo Mate
            </button>
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

                return (
                  <div
                    key={design.id}
                    className="bg-white/95 border border-[#e7d7c1] rounded-2xl p-5 shadow-lg shadow-[#7a4a31]/5 flex flex-col justify-between space-y-4 relative hover:border-[#7a4a31]/40 transition-all"
                  >
                    {/* Badge status */}
                    <div className="flex justify-between items-center border-b border-[#e7d7c1]/60 pb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        design.status === 'submitted'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-[#f3e1b9] text-[#7a4a31] border border-[#e7d7c1]'
                      }`}>
                        {design.status === 'submitted' ? '✓ Enviado a Producción' : '💾 Borrador'}
                      </span>
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
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#e7d7c1]/60">
                      <button
                        type="button"
                        onClick={() => onLoadDesign(design)}
                        className="flex-1 py-2 px-3 rounded-lg bg-[#7a4a31] hover:bg-[#5f3826] text-white font-bold text-xs transition-colors cursor-pointer text-center"
                      >
                        Cargar / Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(design.id)}
                        className="py-2 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer"
                        title="Eliminar borrador"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

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
