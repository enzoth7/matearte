import { useCallback, useEffect, useState } from "react";
import type { UserData, SavedDesignItem } from "../types/user";
import { deleteDesign, getUserDesigns } from "../lib/supabase";
import { mateVariants } from "../catalog/mateCatalog";
import { formatUYU, getSelectionPricing } from "../catalog/pricingCatalog";
import { getSelectionFromLegacyVariant, resolveMateSelection } from "../catalog/mateDecisionCatalog";
import { usePricing } from "../context/PricingContext";

interface ProfileStepProps {
  userData: UserData;
  localDesigns: SavedDesignItem[];
  onLoadDesign: (design: SavedDesignItem) => void;
  onNewDesign: () => void;
  onUpdateUserData: (data: UserData) => void;
  onLogout?: () => void;
  onSendDraftToProduction?: (design: SavedDesignItem) => Promise<void>;
}

interface DesignTileProps {
  design: SavedDesignItem;
  draft?: boolean;
  onLoad: () => void;
  onCheckout: () => void;
  onDelete: () => void;
}

function DesignTile({ design, draft = false, onLoad, onCheckout, onDelete }: DesignTileProps) {
  const { catalog: pricingCatalog } = usePricing();
  const config = design.configuration || {};
  const variant = mateVariants.find((item) => item.id === config.variantId) || mateVariants[0];
  const selection = resolveMateSelection(config.selection)
    ? config.selection
    : getSelectionFromLegacyVariant(config.variantId, config.size);
  const price = selection ? getSelectionPricing(pricingCatalog, selection) : null;
  const historicalTotal = design.status === "submitted" && typeof config.pricingSnapshot?.totalUYU === "number"
    ? config.pricingSnapshot.totalUYU
    : null;

  return (
    <article className="profile-design-tile">
      <button type="button" onClick={onLoad} className="profile-design-tile__preview" aria-label={`Abrir ${design.title || "diseño"}`}>
        {config.skuId === null ? <span>Imagen pendiente</span> : <img src={variant.image} alt="" />}
      </button>
      <strong>{historicalTotal !== null ? formatUYU(historicalTotal) : price && price.totalUYU > 0 ? formatUYU(price.totalUYU) : "Precio no disponible"}</strong>
      <span>{config.selectionLabels?.engraving ?? "Tipo de grabado pendiente"}</span>
      <time dateTime={design.created_at}>{new Date(design.created_at).toLocaleDateString("es-UY")}</time>
      {draft && (
        <div className="profile-design-tile__actions">
          <button type="button" onClick={onCheckout}>+ Carrito</button>
          <button type="button" onClick={onDelete} aria-label="Eliminar borrador">Eliminar</button>
        </div>
      )}
    </article>
  );
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(userData.name);
  const [editEmail, setEditEmail] = useState(userData.email);
  const [editPhone, setEditPhone] = useState(userData.phone || "");
  const [editCompany, setEditCompany] = useState(userData.company || "");
  const [selectedDraft, setSelectedDraft] = useState<SavedDesignItem | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  useEffect(() => {
    setEditName(userData.name);
    setEditEmail(userData.email);
    setEditPhone(userData.phone || "");
    setEditCompany(userData.company || "");
  }, [userData]);

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getUserDesigns(userData.id);
    setDesigns(!error && Array.isArray(data) ? data : localDesigns);
    setLoading(false);
  }, [localDesigns, userData.id]);

  useEffect(() => { void fetchDesigns(); }, [fetchDesigns]);

  const handleDelete = async (id: string) => {
    setDesigns((current) => current.filter((item) => item.id !== id));
    await deleteDesign(id);
  };

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editName.trim() || !editEmail.trim()) return;
    onUpdateUserData({
      ...userData,
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      company: editCompany.trim(),
    });
    setIsEditModalOpen(false);
  };

  const handleDraftCheckout = async () => {
    if (!selectedDraft || !onSendDraftToProduction) return;
    setIsSubmittingDraft(true);
    try {
      await onSendDraftToProduction(selectedDraft);
      await fetchDesigns();
    } finally {
      setIsSubmittingDraft(false);
      setSelectedDraft(null);
    }
  };

  const orders = designs.filter((item) => item.status === "submitted");
  const drafts = designs.filter((item) => item.status !== "submitted");

  return (
    <main id="main-content" className="profile-page">
      <section className="profile-client brand-surface">
        <img src="/assets/marca/logo.jpg" alt="Marca Matearte" />
        <div className="profile-client__data">
          <h1>{userData.name}</h1>
          <p>{userData.email}</p>
          {userData.phone && <p>{userData.phone}</p>}
          {userData.company && <p>{userData.company}</p>}
        </div>
        <div className="profile-client__actions">
          <button type="button" className="brand-button" onClick={() => setIsEditModalOpen(true)}>Editar mis datos</button>
          {onLogout && <button type="button" className="profile-logout" onClick={onLogout}>Cerrar sesión</button>}
        </div>
      </section>

      <section className="profile-list">
        <h2>Mis pedidos</h2>
        {loading ? <p className="profile-empty">Cargando…</p> : orders.length === 0 ? <p className="profile-empty">Todavía no hay pedidos.</p> : (
          <div className="profile-grid">
            {orders.map((design) => <DesignTile key={design.id} design={design} onLoad={() => onLoadDesign(design)} onCheckout={() => undefined} onDelete={() => undefined} />)}
          </div>
        )}
      </section>

      <div className="profile-divider" />

      <section className="profile-list profile-list--drafts">
        <div className="profile-list__heading">
          <h2>Mis borradores</h2>
          <button type="button" className="brand-button" onClick={onNewDesign}>+ Nuevo diseño</button>
        </div>
        {loading ? <p className="profile-empty">Cargando…</p> : drafts.length === 0 ? <p className="profile-empty">Todavía no hay borradores.</p> : (
          <div className="profile-grid">
            {drafts.map((design) => (
              <DesignTile
                key={design.id}
                design={design}
                draft
                onLoad={() => onLoadDesign(design)}
                onCheckout={() => setSelectedDraft(design)}
                onDelete={() => void handleDelete(design.id)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedDraft && (
        <div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
          <div>
            <h2 id="draft-title">Continuar con el borrador</h2>
            <p>El checkout actual es una simulación visual y no enviará el pedido a producción.</p>
            <div className="brand-modal__actions">
              <button type="button" className="brand-button brand-button--secondary" onClick={() => setSelectedDraft(null)}>Cancelar</button>
              <button type="button" className="brand-button" disabled={isSubmittingDraft} onClick={() => void handleDraftCheckout()}>{isSubmittingDraft ? "Cargando…" : "Continuar"}</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
          <form onSubmit={handleSaveProfile}>
            <h2 id="profile-edit-title">Editar mis datos</h2>
            <label>Nombre completo<input required value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
            <label>Correo electrónico<input type="email" required value={editEmail} onChange={(event) => setEditEmail(event.target.value)} /></label>
            <label>Teléfono / WhatsApp<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></label>
            <label>Empresa / marca<input value={editCompany} onChange={(event) => setEditCompany(event.target.value)} /></label>
            <div className="brand-modal__actions">
              <button type="button" className="brand-button brand-button--secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
              <button type="submit" className="brand-button">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
