import { useCallback, useEffect, useState } from "react";
import type { UserData, SavedDesignItem } from "../types/user";
import { deleteDesign, duplicateDesign, getUserDesigns, uploadProfileAvatar } from "../lib/supabase";
import { countryName, countryOptions } from "../lib/countries";
import { mateVariants } from "../catalog/mateCatalog";
import { formatUYU, getSelectionPricing } from "../catalog/pricingCatalog";
import { getSelectionFromLegacyVariant, resolveMateSelection } from "../catalog/mateDecisionCatalog";
import { usePricing } from "../context/PricingContext";

const URUGUAY_DEPARTMENTS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
  "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
  "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

interface ProfileStepProps {
  userData: UserData;
  localDesigns: SavedDesignItem[];
  onLoadDesign: (design: SavedDesignItem) => void;
  onNewDesign: () => void;
  onUpdateUserData: (data: UserData) => Promise<void>;
  onLogout?: () => void;
  onSendDraftToProduction?: (design: SavedDesignItem) => Promise<void>;
}

interface DesignTileProps {
  design: SavedDesignItem;
  draft?: boolean;
  onLoad: () => void;
  onCheckout?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

type ProfileIconName = "email" | "location" | "birthday";

function ProfileIcon({ name }: { name: ProfileIconName }) {
  if (name === "email") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5.5h18v13H3z" />
        <path d="m4 6.5 8 6.5 8-6.5" />
      </svg>
    );
  }

  if (name === "location") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11h16v9H4zM4 15h16M8 11V8m4 3V8m4 3V8" />
      <path d="M8 6c0-1 1-2 1-2s1 1 1 2a1 1 0 0 1-2 0Zm4 0c0-1 1-2 1-2s1 1 1 2a1 1 0 0 1-2 0Zm4 0c0-1 1-2 1-2s1 1 1 2a1 1 0 0 1-2 0Z" />
    </svg>
  );
}

function DesignTile({ design, draft = false, onLoad, onCheckout, onDelete, onDuplicate }: DesignTileProps) {
  const { catalog: pricingCatalog } = usePricing();
  const config = design.configuration || {};
  const variant = mateVariants.find((item) => item.id === config.variantId) || mateVariants[0];
  const selection = resolveMateSelection(config.selection)
    ? config.selection
    : getSelectionFromLegacyVariant(config.variantId, config.size);
  const price = selection ? getSelectionPricing(pricingCatalog, selection) : null;

  return (
    <article className="profile-design-tile">
      {draft && (
        <button
          type="button"
          className="profile-design-tile__delete"
          onClick={onDelete}
          aria-label={`Eliminar borrador ${design.design_code}`}
          title="Eliminar borrador"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onLoad}
        className="profile-design-tile__preview"
        aria-label={draft ? `Continuar ${design.title || "borrador"}` : `Usar ${design.title || "diseño"} como base`}
      >
        {config.skuId === null ? <span>Imagen pendiente</span> : <img className="mate-product-photo" src={variant.image} alt="" />}
      </button>
      <strong>{price && price.totalUYU > 0 ? formatUYU(price.totalUYU) : "Precio no disponible"}</strong>
      <span className="profile-design-tile__type">{design.title}</span>
      <time dateTime={design.updated_at}>Última modificación: {new Date(design.updated_at).toLocaleDateString("es-UY")}</time>
      {draft && (
        <div className="profile-design-tile__actions">
          <button type="button" onClick={onCheckout}>+ Carrito</button>
          <button type="button" onClick={onDuplicate}>Duplicar</button>
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(!userData.profileComplete);
  const [editName, setEditName] = useState(userData.name);
  const [editPhone, setEditPhone] = useState(userData.phone || "");
  const [editCompany, setEditCompany] = useState(userData.company || "");
  const [editBirthDate, setEditBirthDate] = useState(userData.birthDate || "");
  const [editCountryCode, setEditCountryCode] = useState(userData.countryCode || "UY");
  const [editDepartment, setEditDepartment] = useState(userData.department || "");
  const [editCity, setEditCity] = useState(userData.city || "");
  const [editAddress, setEditAddress] = useState(userData.addressLine1 || "");
  const [editPostalCode, setEditPostalCode] = useState(userData.postalCode || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<SavedDesignItem | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  useEffect(() => {
    setEditName(userData.name);
    setEditPhone(userData.phone || "");
    setEditCompany(userData.company || "");
    setEditBirthDate(userData.birthDate || "");
    setEditCountryCode(userData.countryCode || "UY");
    setEditDepartment(userData.department || "");
    setEditCity(userData.city || "");
    setEditAddress(userData.addressLine1 || "");
    setEditPostalCode(userData.postalCode || "");
    if (!userData.profileComplete) setIsEditModalOpen(true);
  }, [userData]);

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getUserDesigns(userData.id);
    setDesigns(!error && Array.isArray(data) ? data : localDesigns);
    setLoading(false);
  }, [localDesigns, userData.id]);

  useEffect(() => { void fetchDesigns(); }, [fetchDesigns]);

  const handleDelete = async (design: SavedDesignItem) => {
    if (!window.confirm(`¿Eliminar el borrador ${design.design_code}? Esta acción no se puede deshacer.`)) return;
    const id = design.id;
    setDesigns((current) => current.filter((item) => item.id !== id));
    await deleteDesign(id);
  };

  const handleDuplicate = async (design: SavedDesignItem) => {
    const { error } = await duplicateDesign(design.id);
    if (!error) await fetchDesigns();
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!editName.trim() || !editBirthDate || !editCountryCode || !editCity.trim() || !editAddress.trim() || (editCountryCode === "UY" && !editDepartment.trim())) {
      setFormError("Completá nombre, cumpleaños, país, ciudad y dirección. Para Uruguay también necesitamos el departamento.");
      return;
    }
    setIsSavingProfile(true);
    try {
      let avatarPath = userData.avatarPath || "";
      let avatarUrl = userData.avatarUrl || "";
      if (avatarFile && userData.id) {
        const uploaded = await uploadProfileAvatar(userData.id, avatarFile);
        if (uploaded.error || !uploaded.path) throw uploaded.error || new Error("No se pudo subir la foto.");
        avatarPath = uploaded.path;
        avatarUrl = uploaded.signedUrl || "";
      }
      await onUpdateUserData({
        ...userData,
        name: editName.trim(),
        phone: editPhone.trim(),
        company: editCompany.trim(),
        birthDate: editBirthDate,
        countryCode: editCountryCode,
        department: editDepartment,
        city: editCity.trim(),
        addressLine1: editAddress.trim(),
        postalCode: editPostalCode.trim(),
        avatarPath,
        avatarUrl,
        profileComplete: true,
      });
      setAvatarFile(null);
      setIsEditModalOpen(false);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudieron guardar tus datos.");
    } finally {
      setIsSavingProfile(false);
    }
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

  const savedDesigns = designs.filter((design) => design.status === "saved");
  const drafts = designs.filter((design) => design.status === "draft");
  const profileCountryCode = userData.countryCode || "UY";
  const profileCountryName = countryName(profileCountryCode);
  const locationLabel = [userData.city, userData.department, profileCountryName].filter(Boolean).join(", ");
  const birthdayLabel = userData.birthDate ? userData.birthDate.split("-").reverse().join("/") : "";

  return (
    <main id="main-content" className="profile-page">
      <section className="profile-client brand-surface">
        <button type="button" className="profile-client__avatar" onClick={() => setIsEditModalOpen(true)} aria-label="Cambiar foto de perfil">
          <img src={userData.avatarUrl || "/assets/marca/LogoOriginal.jpg"} alt={`Foto de ${userData.name}`} />
          <span>Cambiar foto</span>
        </button>
        <div className="profile-client__data">
          <div className="profile-client__name">
            <h1>{userData.name}</h1>
            <span className={`flag:${profileCountryCode} profile-country-flag`} role="img" aria-label={`Bandera de ${profileCountryName}`} />
          </div>
          <div className="profile-client__meta">
            <p><ProfileIcon name="email" /><span>{userData.email}</span></p>
            <p><ProfileIcon name="location" /><span>{locationLabel}</span></p>
            {birthdayLabel && <p><ProfileIcon name="birthday" /><span>{birthdayLabel}</span></p>}
          </div>
        </div>
        <div className="profile-client__actions">
          <button type="button" className="brand-button" onClick={() => setIsEditModalOpen(true)}>Editar mis datos</button>
          {onLogout && <button type="button" className="profile-logout" onClick={onLogout}>Cerrar sesión</button>}
        </div>
      </section>

      <section className="profile-list profile-list--saved">
        <div className="profile-list__heading">
          <div>
            <h2>Mis pedidos</h2>
            <p>Diseños que ya enviaste al carrito. Podés abrirlos para usarlos como base.</p>
          </div>
        </div>
        {loading ? <p className="profile-empty">Cargando…</p> : savedDesigns.length === 0 ? <p className="profile-empty">Todavía no tenés pedidos.</p> : (
          <div className="profile-grid">
            {savedDesigns.map((design) => <DesignTile key={design.id} design={design} onLoad={() => onLoadDesign(design)} />)}
          </div>
        )}
      </section>

      <section className="profile-list profile-list--drafts">
        <div className="profile-list__heading">
          <div>
            <h2>Mis borradores</h2>
            <p>Trabajos en curso que se actualizan sin crear copias nuevas.</p>
          </div>
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
                onDuplicate={() => void handleDuplicate(design)}
                onDelete={() => void handleDelete(design)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedDraft && (
        <div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
          <div>
            <h2 id="draft-title">Continuar con el borrador</h2>
            <p>El diseño se agregará al carrito principal. El servidor verificará precio, archivos y sesión antes de permitir la compra.</p>
            <div className="brand-modal__actions">
              <button type="button" className="brand-button brand-button--secondary" onClick={() => setSelectedDraft(null)}>Cancelar</button>
              <button type="button" className="brand-button" disabled={isSubmittingDraft} onClick={() => void handleDraftCheckout()}>{isSubmittingDraft ? "Cargando…" : "Continuar"}</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" aria-describedby="profile-edit-description">
          <form className="profile-form" onSubmit={(event) => void handleSaveProfile(event)}>
            <h2 id="profile-edit-title">{userData.profileComplete ? "Editar mis datos" : "Completá tus datos"}</h2>
            <p id="profile-edit-description">Registrá tu cumpleaños y dirección para que podamos preparar tus compras y saber dónde enviar tus mates.</p>
            <div className="profile-form__grid">
              <label className="profile-form__wide">Nombre completo<input autoFocus required value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
              <label>Fecha de cumpleaños<input type="date" required max={new Date().toISOString().slice(0, 10)} value={editBirthDate} onChange={(event) => setEditBirthDate(event.target.value)} /></label>
              <label>Teléfono / WhatsApp<input type="tel" autoComplete="tel" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></label>
              <label>País<select required autoComplete="country" value={editCountryCode} onChange={(event) => setEditCountryCode(event.target.value)}>{countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
              {editCountryCode === "UY" ? (
                <label>Departamento<select required autoComplete="address-level1" value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)}><option value="">Elegí un departamento</option>{URUGUAY_DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></label>
              ) : (
                <label>Estado / provincia <small>(opcional)</small><input autoComplete="address-level1" maxLength={80} value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} /></label>
              )}
              <label>Ciudad / localidad<input required autoComplete="address-level2" value={editCity} onChange={(event) => setEditCity(event.target.value)} /></label>
              <label className="profile-form__wide">Dirección<input required autoComplete="street-address" value={editAddress} onChange={(event) => setEditAddress(event.target.value)} /></label>
              <label>Código postal<input inputMode="numeric" autoComplete="postal-code" value={editPostalCode} onChange={(event) => setEditPostalCode(event.target.value)} /></label>
              <label>Empresa / marca<input value={editCompany} onChange={(event) => setEditCompany(event.target.value)} /></label>
              <label className="profile-form__wide">Foto de perfil<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} /><small>PNG, JPEG o WebP. Máximo 2 MB.</small></label>
            </div>
            {formError && <p className="profile-form__error" role="alert">{formError}</p>}
            <div className="brand-modal__actions">
              {userData.profileComplete && <button type="button" className="brand-button brand-button--secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>}
              <button type="submit" className="brand-button" disabled={isSavingProfile}>{isSavingProfile ? "Guardando…" : "Guardar datos"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
