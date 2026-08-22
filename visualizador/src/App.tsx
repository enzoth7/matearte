import { lazy, Suspense, useCallback, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { UserData, WizardStep, SavedDesignItem } from "./types/user";
import { isSupabaseConfigured, saveUserProfileToSupabase, supabase, saveDesignToSupabase } from "./lib/supabase";
import { WelcomeStep } from "./components/WelcomeStep";
import { CustomizerIntroStep } from "./components/CustomizerIntroStep";
import { MateSelectionStep } from "./components/MateSelectionStep";
import { StepIndicator } from "./components/StepIndicator";
import { SummaryStep } from "./components/SummaryStep";
import { SuccessStep } from "./components/SuccessStep";
import { ProfileStep } from "./components/ProfileStep";
import { ConfiguratorPreview } from "./components/ConfiguratorPreview";
import { FlatFlejePreview } from "./components/FlatFlejePreview";
import { FlejeFinishSelector } from "./components/FlejeFinishSelector";
import { RimFinishSelector } from "./components/RimFinishSelector";
import { RimFinishModeSelector } from "./components/RimFinishModeSelector";
import { RimImageModeSelector } from "./components/RimImageModeSelector";
import { RimTextEditor } from "./components/RimTextEditor";
import { RimTextFields } from "./components/RimTextFields";
import { RimTextModeSelector } from "./components/RimTextModeSelector";
import { CustomImageUpload } from "./components/CustomImageUpload";
import { CheckoutStep, type PaymentPricingSnapshot } from "./components/CheckoutStep";
import { VirolaIconSelector } from "./components/VirolaIconSelector";
import { BrandFooter } from "./components/BrandFooter";
import { StyleTransitionStep } from "./components/StyleTransitionStep";
import { usePricing } from "./context/PricingContext";
import { getDefaultColor, getDefaultVariant, getModelDefinition, getVariantDefinition, mateVariants, type EngravingArea, type MateSize, type MateVariant } from "./catalog/mateCatalog";
import {
  EMPTY_MATE_SELECTION,
  getFirstIncompleteStage,
  getSelectedTexture,
  getSelectionFromLegacyVariant,
  getSelectionLabels,
  resolveMateSelection,
  sanitizeMateSelection,
  shouldAskForMetal,
  engravingTypeOptions,
  getEngravingCapabilities,
  type MateSelection,
  type MateSelectionStage,
  type ResolvedMateProduct,
} from "./catalog/mateDecisionCatalog";
import { createDefaultRimSelection, normalizeRimSelection } from "./catalog/rimCatalog";
import { getRimFinish } from "./catalog/rimFinishCatalog";
import { getFlejeFinish } from "./catalog/flejeFinishCatalog";
import { calculateOrderPricing, countChargeableCharacters, formatUYU, getCustomizationPrice, getMercadoPagoCommissionPercent } from "./catalog/pricingCatalog";
import { createDefaultFlejeCustomization, normalizeFlejeCustomization, type CustomImageAsset, type EditableElement, type FlejeCustomization, type FlejeSide, type MateConfiguration } from "./types/customizer";

type CustomizationPhase = "mate" | "virola" | "fleje";
type PreviewView = "mate" | "virola" | "fleje";
type PendingAuthAction = "save-customizer" | "save-summary" | "checkout" | "profile" | "edit-contact";

const PricingDashboard = lazy(() => import("./components/PricingDashboard").then((module) => ({ default: module.PricingDashboard })));

interface BaseImageProps {
  src: string;
  alt: string;
}

interface PhaseAccordionProps {
  number: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function BaseImage({ src, alt }: BaseImageProps) {
  return <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-contain" draggable={false} />;
}

function FlejeTextLayer({ text, engravingArea }: { text: string; engravingArea: EngravingArea | null }) {
  if (!text.trim() || !engravingArea) return null;

  const fontSize = Math.max(60, 140 - Math.max(0, text.length - 4) * 5.5);
  const letterSpacing = text.length > 12 ? 4 : 6;
  const textLength = Math.min(860, Math.max(300, text.length * fontSize * 0.62 + Math.max(0, text.length - 1) * letterSpacing));

  return (
    <div
      data-layer="fleje-text"
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: `${engravingArea.x}%`,
        top: `${engravingArea.y}%`,
        width: `${engravingArea.width}%`,
        height: `${engravingArea.height}%`,
      }}
    >
      <svg viewBox="0 0 1000 160" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <text
          x="500"
          y="84"
          textAnchor="middle"
          dominantBaseline="middle"
          textLength={textLength}
          lengthAdjust="spacingAndGlyphs"
          fill="#2d1d14"
          stroke="#b8ae9d"
          strokeWidth="1.2"
          paintOrder="stroke"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={fontSize}
          fontWeight="700"
          letterSpacing={letterSpacing}
          style={{ mixBlendMode: "multiply" }}
        >
          {text.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function FlejePreview({ mate, text }: { mate: MateVariant; text: string }) {
  const model = getModelDefinition(mate.model);
  return (
    <div className="relative aspect-square w-full max-w-[540px]" aria-label={`Vista lateral del mate ${mate.name}`}>
      <BaseImage src={mate.image} alt={`Mate ${mate.name} visto de frente`} />
      <FlejeTextLayer text={model.hasFleje ? text : ""} engravingArea={model.engravingArea} />
    </div>
  );
}

function PhaseAccordion({ number, title, isOpen, onToggle, children }: PhaseAccordionProps) {
  const panelId = `customizer-phase-${title.toLowerCase()}`;
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-50/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a4a31]"
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-bold ${isOpen ? "bg-[#7a4a31] text-white" : "bg-zinc-100 text-zinc-500"}`}>{number}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">{title}</span>
        </div>
        <span className="text-[10px] text-zinc-400">{isOpen ? "−" : "＋"}</span>
      </button>
      <div
        id={panelId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] border-t border-zinc-100 opacity-100" : "grid-rows-[0fr] pointer-events-none opacity-0"}`}
      >
        <div className="overflow-hidden p-4">{children}</div>
      </div>
    </section>
  );
}

const SELECTION_SESSION_KEY = "matearte_selection_v2";

function selectionStageFromPath(path: string): MateSelectionStage {
  if (path.endsWith("/texture")) return "texture";
  if (path.endsWith("/metal")) return "metal";
  if (path.endsWith("/size")) return "size";
  if (path.endsWith("/fleje-engraving")) return "fleje-engraving";
  if (path.endsWith("/engraving")) return "engraving";
  return "model";
}

function createConfigurationFromResolved(
  product: ResolvedMateProduct,
  current?: Partial<MateConfiguration> | null,
): MateConfiguration {
  const variant = getVariantDefinition(product.legacyVariantId) ?? getDefaultVariant(product.shapeId);
  const rim = normalizeRimSelection(variant, current?.rim);
  rim.rimId = product.rimId;
  const selection: MateSelection = {
    familyId: product.familyId,
    textureId: product.textureId,
    colorId: product.colorId,
    metalId: product.metalId,
    sizeId: product.sizeId,
    engravingTypeId: product.engravingTypeId,
    flejeEngravingTypeId: product.flejeEngravingTypeId,
  };

  return {
    schemaVersion: 2,
    productId: product.productId,
    skuId: product.skuId,
    selection,
    selectionLabels: getSelectionLabels(selection),
    engravingTypeId: product.engravingTypeId,
    flejeEngravingTypeId: product.flejeEngravingTypeId,
    capabilities: product.capabilities,
    isLegacy: false,
    modelId: product.shapeId,
    variantId: variant.id,
    size: product.sizeId,
    colorId: product.colorId,
    rim,
  };
}

function createMateConfiguration(variant: MateVariant): MateConfiguration {
  const selection = getSelectionFromLegacyVariant(variant.id, variant.defaultSize);
  const resolved = selection ? resolveMateSelection(selection) : null;
  if (resolved) return createConfigurationFromResolved(resolved);
  const model = getModelDefinition(variant.model);
  return {
    schemaVersion: 2,
    productId: null,
    skuId: variant.id,
    selection: { ...EMPTY_MATE_SELECTION },
    selectionLabels: {
      family: model.name,
      texture: variant.name,
      color: getDefaultColor(variant).name,
      metal: "Configuración anterior",
      size: variant.defaultSize,
      engraving: "Sin definir",
    },
    engravingTypeId: null,
    flejeEngravingTypeId: null,
    capabilities: { hasRim: true, hasFleje: model.hasFleje },
    isLegacy: true,
    modelId: variant.model,
    variantId: variant.id,
    size: variant.defaultSize,
    colorId: getDefaultColor(variant).id,
    rim: createDefaultRimSelection(variant),
  };
}

function normalizeMateConfiguration(value: Partial<MateConfiguration> | null | undefined): MateConfiguration {
  const variant = mateVariants.find((item) => item.id === value?.variantId)
    ?? getDefaultVariant(value?.modelId ?? "imperial");
  const size: MateSize = variant.availableSizes.includes(value?.size as MateSize) ? value?.size as MateSize : variant.defaultSize;
  const storedSelection = sanitizeMateSelection(value?.selection);
  const migratedSelection = resolveMateSelection(storedSelection)
    ? storedSelection
    : getSelectionFromLegacyVariant(variant.id, size);
  const resolved = migratedSelection ? resolveMateSelection(migratedSelection) : null;
  if (resolved) return createConfigurationFromResolved(resolved, value);

  const model = getModelDefinition(variant.model);
  const colorId = variant.colors.some((color) => color.id === value?.colorId) ? value?.colorId as string : getDefaultColor(variant).id;
  return {
    schemaVersion: 2,
    productId: null,
    skuId: variant.id,
    selection: { ...EMPTY_MATE_SELECTION },
    selectionLabels: value?.selectionLabels ?? {
      family: model.name,
      texture: variant.name,
      color: variant.colors.find((color) => color.id === colorId)?.name ?? colorId,
      metal: "Configuración anterior",
      size,
      engraving: value?.selectionLabels?.engraving ?? "Sin definir",
    },
    engravingTypeId: value?.engravingTypeId ?? storedSelection.engravingTypeId ?? null,
    flejeEngravingTypeId: value?.flejeEngravingTypeId ?? storedSelection.flejeEngravingTypeId ?? null,
    capabilities: value?.capabilities ?? { hasRim: true, hasFleje: model.hasFleje },
    isLegacy: true,
    modelId: variant.model,
    variantId: variant.id,
    size,
    colorId,
    rim: normalizeRimSelection(variant, value?.rim),
  };
}

function VisualizerApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { catalog: pricingCatalog, refresh: refreshPricing } = usePricing();
  const customizationPriceLabel = (id: string) => {
    const value = getCustomizationPrice(pricingCatalog, configuration.engravingTypeId, id);
    if (value === null) return "Precio no disponible";
    const unit = id.endsWith("_text") ? " por carácter" : id.endsWith("_image") ? " por imagen" : "";
    return `${formatUYU(value)}${unit}`;
  };

  // Load user data from localStorage if available
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const saved = localStorage.getItem("matearte_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Helper to convert route to wizard step
  const getStepFromPath = (path: string): WizardStep => {
    if (path.startsWith("/selection")) return "product_selection";
    switch (path) {
      case "/access":
        return "access";
      case "/profile":
        return "profile";
      case "/product-selection":
        return "product_selection";
      case "/customizer":
        return "customizer";
      case "/summary":
        return "summary";
      case "/checkout":
        return "checkout";
      case "/success":
        return "success";
      default:
        return "welcome";
    }
  };

  const [wizardStep, setWizardStepState] = useState<WizardStep>(() => getStepFromPath(location.pathname));
  const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction | null>(() => {
    const saved = sessionStorage.getItem("matearte_pending_auth_action");
    return saved as PendingAuthAction | null;
  });

  // Sync route changes with state
  useEffect(() => {
    setWizardStepState(getStepFromPath(location.pathname));
  }, [location.pathname]);

  // Ensure profile ID is synced with Supabase when app loads
  useEffect(() => {
    let active = true;

    if (isSupabaseConfigured && userData && userData.email && !userData.id && !userData.isGuest) {
      saveUserProfileToSupabase(userData).then(({ profile }) => {
        if (profile && active) {
          const updated = { ...userData, id: profile.id };
          setUserData(updated);
          localStorage.setItem("matearte_user", JSON.stringify(updated));
        }
      });
    }

    return () => {
      active = false;
    };
  }, [userData]);

  const changeStep = useCallback((step: WizardStep) => {
    setWizardStepState(step);
    switch (step) {
      case "profile":
        navigate("/profile");
        break;
      case "access":
        navigate("/access");
        break;
      case "product_selection":
        navigate("/selection/model");
        break;
      case "customizer":
        navigate("/customizer");
        break;
      case "summary":
        navigate("/summary");
        break;
      case "checkout":
        navigate("/checkout");
        break;
      case "success":
        navigate("/success");
        break;
      default:
        navigate("/");
        break;
    }
  }, [navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || "";
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split("@")[0] || "Usuario Google";
        const userObj: UserData = {
          id: session.user.id,
          name,
          email,
          phone: session.user.user_metadata?.phone || "",
          company: session.user.user_metadata?.company || "",
        };
        setUserData(userObj);
        localStorage.setItem("matearte_user", JSON.stringify(userObj));
        saveUserProfileToSupabase(userObj);

        if (window.location.search.includes('error') || window.location.hash.includes('access_token') || window.location.search.includes('code')) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        // La navegación posterior al acceso se resuelve con pendingAuthAction para
        // poder retomar exactamente Guardar, Checkout o Perfil.
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [changeStep]);

  useEffect(() => {
    if (wizardStep === "summary" || wizardStep === "checkout") void refreshPricing(true);
  }, [refreshPricing, wizardStep]);

  const [activePhase, setActivePhase] = useState<CustomizationPhase | null>("virola");
  const [previewView, setPreviewView] = useState<PreviewView>("virola");
  const initialVariant = getDefaultVariant("imperial");
  const [configuration, setConfiguration] = useState<MateConfiguration>(() => createMateConfiguration(initialVariant));
  const [selection, setSelection] = useState<MateSelection>(() => {
    try {
      const saved = sessionStorage.getItem(SELECTION_SESSION_KEY);
      return saved ? sanitizeMateSelection(JSON.parse(saved)) : { ...EMPTY_MATE_SELECTION };
    } catch {
      return { ...EMPTY_MATE_SELECTION };
    }
  });
  const selectionStage = selectionStageFromPath(location.pathname);
  const selectedDecisionTexture = getSelectedTexture(selection);
  const selectionHasFleje = selectedDecisionTexture?.capabilities.hasFleje
    ?? (selection.familyId === "camionero" || selection.familyId === "torpedo" ? false : configuration.capabilities.hasFleje);
  const indicatorHasFleje = wizardStep === "product_selection"
    ? selectionHasFleje
    : configuration.capabilities.hasFleje;
  const selectedMate = mateVariants.find((variant) => variant.id === configuration.variantId) ?? initialVariant;
  const [flejeConfig, setFlejeConfig] = useState<FlejeCustomization>(() => createDefaultFlejeCustomization());
  const [activeFlejeSide, setActiveFlejeSide] = useState<FlejeSide>("front");
  const [selectedRimElement, setSelectedRimElement] = useState<string | null>("text");
  const [placingRimIconId, setPlacingRimIconId] = useState<string | null>(null);
  const [selectedFlejeElement, setSelectedFlejeElement] = useState<EditableElement | null>("text");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showStyleIntro, setShowStyleIntro] = useState(false);
  const [allowIncompletePhaseNavigation, setAllowIncompletePhaseNavigation] = useState(false);
  const [localDesigns] = useState<SavedDesignItem[]>([]);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const uploadedRimIcon = configuration.rim.icons.find((icon) => icon.customImage) ?? null;

  const updateUploadedRimIcon = (asset: CustomImageAsset | null) => {
    const existingId = uploadedRimIcon?.id ?? null;

    if (!asset) {
      setConfiguration((current) => ({
        ...current,
        rim: {
          ...current.rim,
          icons: current.rim.icons.filter((icon) => icon.id !== existingId),
        },
      }));
      if (selectedRimElement === existingId) setSelectedRimElement(null);
      if (placingRimIconId === existingId) setPlacingRimIconId(null);
      return;
    }

    const iconId = existingId ?? crypto.randomUUID();
    const count = configuration.rim.icons.length;
    const angles = [90, 45, 135];
    const angle = angles[count] ?? 90;
    const rad = angle * (Math.PI / 180);
    const initialPos = {
      x: Math.round((0.5 + Math.cos(rad) * 0.378) * 1000) / 1000,
      y: Math.round((0.5 + Math.sin(rad) * 0.378) * 1000) / 1000,
    };

    setConfiguration((current) => {
      const existing = current.rim.icons.find((icon) => icon.id === existingId);
      const uploadedIcon = {
        id: iconId,
        selectedImageId: asset.id,
        customImage: asset,
        transform: existing?.transform ?? { x: initialPos.x, y: initialPos.y, scale: 1, rotation: 0, side: "rim" as const },
      };

      return {
        ...current,
        rim: {
          ...current.rim,
          icons: existing
            ? current.rim.icons.map((icon) => icon.id === existing.id ? uploadedIcon : icon)
            : [...current.rim.icons, uploadedIcon],
        },
      };
    });
    setSelectedRimElement(iconId);
    setPreviewView("virola");
  };

  const locateUploadedRimIcon = () => {
    if (!uploadedRimIcon) return;
    setSelectedRimElement(uploadedRimIcon.id);
    setPlacingRimIconId((current) => current === uploadedRimIcon.id ? null : uploadedRimIcon.id);
    setPreviewView("virola");
    window.requestAnimationFrame(() => previewContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  useEffect(() => {
    if (!placingRimIconId) return;
    const cancelPlacement = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlacingRimIconId(null);
    };
    window.addEventListener("keydown", cancelPlacement);
    return () => window.removeEventListener("keydown", cancelPlacement);
  }, [placingRimIconId]);

  useEffect(() => {
    if (previewView !== "virola") setPlacingRimIconId(null);
  }, [previewView]);

  useEffect(() => {
    sessionStorage.setItem(SELECTION_SESSION_KEY, JSON.stringify(selection));
  }, [selection]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, showStyleIntro, activePhase]);

  useEffect(() => {
    const resolved = resolveMateSelection(selection);
    if (!resolved) return;
    if (configuration.productId !== resolved.productId && (wizardStep === "customizer" || wizardStep === "summary" || wizardStep === "checkout")) {
      setConfiguration((current) => createConfigurationFromResolved(resolved, current));
    }
    if (wizardStep === "checkout" && !resolved.skuId) {
      navigate("/summary", { replace: true });
    }
  }, [configuration.productId, navigate, selection, wizardStep]);

  useEffect(() => {
    const incomplete = getFirstIncompleteStage(selection);
    if ((wizardStep === "customizer" || wizardStep === "summary" || wizardStep === "checkout") && incomplete && !configuration.isLegacy && !allowIncompletePhaseNavigation) {
      navigate(`/selection/${incomplete}`, { replace: true });
      return;
    }
    if (wizardStep !== "product_selection") return;
    if (selectionStage === "metal" && !shouldAskForMetal(selection) && (incomplete === "size" || incomplete === "engraving" || incomplete === null)) {
      navigate("/selection/size", { replace: true });
      return;
    }
    if (!incomplete) return;
    const order: MateSelectionStage[] = ["model", "texture", "metal", "size", "engraving"];
    if (order.indexOf(selectionStage) > order.indexOf(incomplete)) {
      navigate(`/selection/${incomplete}`, { replace: true });
    }
  }, [allowIncompletePhaseNavigation, configuration.isLegacy, navigate, selection, selectionStage, wizardStep]);

  const handleWelcomeSubmit = async (data: UserData) => {
    const { profile } = data.isGuest
      ? { profile: null }
      : await saveUserProfileToSupabase(data);
    const mergedUser = profile ? { ...data, id: profile.id } : data;
    setUserData(mergedUser);
    localStorage.setItem("matearte_user", JSON.stringify(mergedUser));
    if (!pendingAuthAction) changeStep("product_selection");
  };

  const [lastSavedDesignId, setLastSavedDesignId] = useState<string | null>(null);

  const configurationWithPricingSnapshot = (payment?: PaymentPricingSnapshot) => {
    const pricing = calculateOrderPricing(configuration, flejeConfig, pricingCatalog);
    if (!pricing.isPriceReady || pricing.catalogVersion === null || !pricing.catalogVersionId) return configuration;
    return {
      ...configuration,
      pricingSnapshot: {
        catalogVersion: pricing.catalogVersion,
        catalogVersionId: pricing.catalogVersionId,
        basePriceUYU: pricing.basePriceUYU,
        breakdown: pricing.breakdown!,
        extrasUYU: pricing.extrasUYU,
        totalUYU: payment?.totalUYU ?? pricing.totalUYU,
        subtotalUYU: payment?.subtotalUYU ?? pricing.totalUYU,
        paymentMethod: payment?.method ?? null,
        mercadoPagoCommissionPercent: payment?.commissionPercent ?? getMercadoPagoCommissionPercent(pricingCatalog),
        mercadoPagoCommissionUYU: payment?.commissionUYU ?? 0,
        items: pricing.items.map(({ id, label, quantity, unitPriceUYU, totalUYU }) => ({ id, label, quantity, unitPriceUYU, totalUYU })),
      },
    };
  };

  const handleSaveDesign = async () => {
    if (saveStatus !== "idle") return;
    setSaveStatus("saving");

    const { data } = await saveDesignToSupabase({
      designId: lastSavedDesignId,
      userId: userData?.id,
      configuration: configurationWithPricingSnapshot(),
      flejeConfig,
      title: `Mate ${configuration.selectionLabels.texture}`,
      status: 'draft',
    });

    if (data && data[0]?.id) {
      setLastSavedDesignId(data[0].id);
    }

    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus("idle");
        changeStep("summary");
      }, 800);
    }, 800);
  };

  const handleSaveDraftFromSummary = async () => {
    const { data } = await saveDesignToSupabase({
      designId: lastSavedDesignId,
      userId: userData?.id,
      configuration: configurationWithPricingSnapshot(),
      flejeConfig,
      title: `Mate ${configuration.selectionLabels.texture}`,
      status: 'draft',
    });
    if (data && data[0]?.id) {
      setLastSavedDesignId(data[0].id);
    }

    changeStep("profile");
  };

  const handleCheckoutComplete = async (payment: PaymentPricingSnapshot) => {
    const { data } = await saveDesignToSupabase({
      designId: lastSavedDesignId,
      userId: userData?.id,
      configuration: configurationWithPricingSnapshot(payment),
      flejeConfig,
      title: `Mate ${configuration.selectionLabels.texture}`,
      status: "submitted",
    });
    if (data && data[0]?.id) setLastSavedDesignId(data[0].id);
    changeStep("success");
  };

  const runAuthenticatedAction = (action: PendingAuthAction) => {
    switch (action) {
      case "save-customizer":
        void handleSaveDesign();
        break;
      case "save-summary":
        void handleSaveDraftFromSummary();
        break;
      case "checkout":
        changeStep("checkout");
        break;
      case "profile":
      case "edit-contact":
        changeStep("profile");
        break;
    }
  };

  const requireAuthentication = (action: PendingAuthAction) => {
    if (userData && (!userData.isGuest || !isSupabaseConfigured)) {
      runAuthenticatedAction(action);
      return;
    }
    sessionStorage.setItem("matearte_pending_auth_action", action);
    setPendingAuthAction(action);
    changeStep("access");
  };

  useEffect(() => {
    if (!pendingAuthAction || !userData || (userData.isGuest && isSupabaseConfigured)) return;
    sessionStorage.removeItem("matearte_pending_auth_action");
    setPendingAuthAction(null);
    runAuthenticatedAction(pendingAuthAction);
    // runAuthenticatedAction intentionally uses the current design state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAuthAction, userData]);

  useEffect(() => {
    if (wizardStep !== "profile" || (userData && (!userData.isGuest || !isSupabaseConfigured))) return;
    sessionStorage.setItem("matearte_pending_auth_action", "profile");
    setPendingAuthAction("profile");
    changeStep("access");
  }, [changeStep, userData, wizardStep]);

  const handleLoadDesignFromProfile = (item: SavedDesignItem) => {
    if (item.configuration) {
      const normalized = normalizeMateConfiguration(item.configuration);
      setConfiguration(normalized);
      setSelection(normalized.isLegacy ? { ...EMPTY_MATE_SELECTION } : normalized.selection);
    }
    if (item.fleje_config) {
      setFlejeConfig(normalizeFlejeCustomization(item.fleje_config));
    }
    setLastSavedDesignId(item.id);
    setActivePhase("virola");
    setPreviewView("virola");
    setShowStyleIntro(false);
    changeStep("customizer");
  };

  const handleReset = () => {
    setLastSavedDesignId(null);
    changeStep("profile");
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("matearte_user");
    } catch (e) {
      console.warn("Could not remove user from localStorage", e);
    }
    setUserData(null);
    setLastSavedDesignId(null);
    changeStep("welcome");
  };

  const baseModelDefinition = getModelDefinition(configuration.modelId);
  const selectedModelDefinition = {
    ...baseModelDefinition,
    hasFleje: configuration.capabilities.hasFleje,
  };

  const goToSelectionStage = (stage: MateSelectionStage) => navigate(`/selection/${stage}`);

  const handleSelectionBack = () => {
    const previous: Record<MateSelectionStage, MateSelectionStage | null> = {
      model: null,
      texture: "model",
      metal: "texture",
      size: shouldAskForMetal(selection) ? "metal" : "texture",
      engraving: "size",
      "fleje-engraving": "engraving",
    };
    const target = previous[selectionStage];
    if (target) goToSelectionStage(target);
    else changeStep("welcome");
  };

  const hasConfiguredFleje = () => {
    if (flejeConfig.finishMode === "finish") return true;
    return Object.values(flejeConfig.sides).some((side) => (
      Boolean(side.text.trim())
      || Boolean(side.selectedImageId)
    ));
  };

  const commitResolvedSelection = (product: ResolvedMateProduct) => {
    if (configuration.capabilities.hasFleje && !product.capabilities.hasFleje && hasConfiguredFleje()) {
      const confirmed = window.confirm(
        "El mate elegido no admite fleje. Si continuás se eliminarán los textos, imágenes y terminaciones configurados en el fleje. La personalización compatible de la virola se conservará.",
      );
      if (!confirmed) return;
    }

    setConfiguration((current) => createConfigurationFromResolved(product, current));
    if (!product.capabilities.hasFleje) setFlejeConfig(createDefaultFlejeCustomization());
    setActivePhase("virola");
    setPreviewView("virola");
    setShowStyleIntro(true);
    setLastSavedDesignId(null);
    changeStep("customizer");
  };

  const handleSelectionContinue = () => {
    const next: Record<MateSelectionStage, MateSelectionStage | null> = {
      model: "texture",
      texture: shouldAskForMetal(selection) ? "metal" : "size",
      metal: "size",
      size: "engraving",
      engraving: getSelectedTexture(selection)?.capabilities.hasFleje ? "fleje-engraving" : null,
      "fleje-engraving": null,
    };
    const target = next[selectionStage];
    if (target) {
      goToSelectionStage(target);
      return;
    }
    const product = resolveMateSelection(selection);
    if (product) commitResolvedSelection(product);
  };

  const editMateSelection = () => {
    setSelection(configuration.isLegacy ? { ...EMPTY_MATE_SELECTION } : sanitizeMateSelection(configuration.selection));
    changeStep("product_selection");
  };

  const activatePhase = (phase: CustomizationPhase) => {
    setActivePhase((currentPhase) => currentPhase === phase ? null : phase);
    setPreviewView(phase);
  };

  const handleCustomizerBack = () => {
    if (activePhase === "fleje") {
      setActivePhase("virola");
      setPreviewView("virola");
      return;
    }
    goToSelectionStage("engraving");
  };

  const handleCustomizerNext = () => {
    if (activePhase !== "fleje" && selectedModelDefinition.hasFleje) {
      setActivePhase("fleje");
      setPreviewView("fleje");
      return;
    }
    changeStep("summary");
  };

  const updateFlejeSide = (
    side: FlejeSide,
    updates: Partial<FlejeCustomization["sides"][FlejeSide]>,
  ) => {
    setFlejeConfig((current) => ({
      ...current,
      sides: {
        ...current.sides,
        [side]: { ...current.sides[side], ...updates },
      },
    }));
  };

  const handleUpdateUserData = async (newUserData: UserData) => {
    const { profile } = newUserData.isGuest
      ? { profile: null }
      : await saveUserProfileToSupabase(newUserData);
    const mergedUser = profile ? { ...newUserData, id: profile.id } : newUserData;
    setUserData(mergedUser);
    localStorage.setItem("matearte_user", JSON.stringify(mergedUser));
  };

  const effectiveUserData = userData || {
    name: "Invitado Matearte",
    email: "invitado@matearte.com",
    phone: "",
    company: "",
  };

  const handleDraftCheckoutFromProfile = async (design: SavedDesignItem) => {
    const normalized = normalizeMateConfiguration(design.configuration);
    setConfiguration(normalized);
    setSelection(normalized.isLegacy ? { ...EMPTY_MATE_SELECTION } : normalized.selection);
    setFlejeConfig(normalizeFlejeCustomization(design.fleje_config));
    setLastSavedDesignId(design.id);
    changeStep("checkout");
  };

  return (
    <div className="brand-app brand-desktop-note">
      <a className="brand-skip-link" href="#main-content">Saltar al contenido</a>
      {wizardStep === "profile" ? (
        <div className="brand-profile-title">Perfil de cliente</div>
      ) : wizardStep === "access" ? (
        <div className="brand-access-title">Acceso Matearte</div>
      ) : (
        <StepIndicator
          currentStep={showStyleIntro && wizardStep === "customizer" ? "product_selection" : wizardStep}
          hasFleje={indicatorHasFleje}
          customizationPhase={activePhase}
          onStepClick={(step, phase) => {
            setAllowIncompletePhaseNavigation(step !== "product_selection");
            if (phase) {
              setActivePhase(phase);
              setPreviewView(phase);
              setShowStyleIntro(false);
            }
            changeStep(step);
          }}
        />
      )}

      <div className="brand-main">
        {wizardStep === "welcome" && (
          <CustomizerIntroStep onStart={() => changeStep("product_selection")} />
        )}

        {wizardStep === "access" && (
          <WelcomeStep initialData={userData || undefined} onSubmit={handleWelcomeSubmit} />
        )}

        {wizardStep === "product_selection" && (
          <MateSelectionStep
            stage={selectionStage}
            selection={selection}
            onChange={setSelection}
            onBack={handleSelectionBack}
            onContinue={handleSelectionContinue}
          />
        )}

        {wizardStep === "customizer" && showStyleIntro && (
          <StyleTransitionStep onContinue={() => setShowStyleIntro(false)} />
        )}

        {wizardStep === "customizer" && !showStyleIntro && (
          <main id="main-content" className="brand-customizer" data-phase={activePhase ?? "virola"}>
            <div className="brand-customizer__actions">
              <button type="button" onClick={handleCustomizerBack} className="brand-button">Atrás</button>
              <button type="button" onClick={handleCustomizerNext} disabled={saveStatus !== "idle"} className="brand-button">
                {saveStatus === "saving" ? "Guardando…" : "Siguiente"}
              </button>
            </div>
            <div className="customizer-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              
              {/* PANEL 1: IZQUIERDA (Acordeón de Personalización) */}
              <aside className="customizer-controls order-2 flex flex-col gap-3 lg:order-1 lg:col-span-4">
                <PhaseAccordion number={1} title="Mate" isOpen={activePhase === "mate"} onToggle={() => activatePhase("mate")}>
                  <div className="space-y-3 text-xs">
                    <dl className="space-y-2 rounded-xl border border-[#e7d7c1] bg-[#fdf7e9] p-3">
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Familia</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.family}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Textura</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.texture}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Color</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.color}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Metal</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.metal}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Tamaño</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.size}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-[#5f3826]/70">Grabado</dt><dd className="text-right font-bold text-[#2d1d14]">{configuration.selectionLabels.engraving}</dd></div>
                    </dl>
                    <button type="button" onClick={editMateSelection} className="min-h-11 w-full rounded-xl border border-[#7a4a31] bg-white px-3 font-bold text-[#7a4a31] transition-colors hover:bg-[#fbf3de] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31]">
                      Cambiar mate
                    </button>
                  </div>
                </PhaseAccordion>

                <PhaseAccordion number={2} title="Virola" isOpen={activePhase === "virola"} onToggle={() => activatePhase("virola")}>
                  <div className="customizer-card-grid">
                    <section className="customizer-control-card">
                      <h3>Texto</h3>
                      <RimTextModeSelector
                        mode={configuration.rim.textMode}
                        onSelect={(textMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, textMode } }))}
                      />
                      {configuration.rim.textMode === "text" && (
                        <RimTextFields
                          texts={configuration.rim.texts}
                          selectedElement={selectedRimElement}
                          onSelectElement={setSelectedRimElement}
                          onChange={(texts) => setConfiguration((current) => ({
                            ...current,
                            rim: {
                              ...current.rim,
                              text: texts[0]?.text ?? "",
                              textTransform: texts[0]?.transform ?? current.rim.textTransform,
                              texts,
                            },
                          }))}
                        />
                      )}
                      {configuration.rim.textMode === "text" && (() => {
                        const engravingType = configuration.engravingTypeId;
                        if (!engravingType) return null;
                        if (engravingType === "laser") {
                          return <p className="customizer-inline-price">Letras incluidas en el precio fijo del Láser</p>;
                        }
                        const allText = (configuration.rim.texts ?? []).map((t) => t.text).join("");
                        const charCount = countChargeableCharacters(allText);
                        const pricePerChar = getCustomizationPrice(pricingCatalog, engravingType, "rim_text") ?? 150;
                        const total = charCount * pricePerChar;
                        return (
                          <div className="customizer-price-bar">
                            <p className="customizer-price-bar__label">
                              El precio por cada letra en apliques es de <strong>$ {pricePerChar.toLocaleString("es-UY")}</strong>
                            </p>
                            {charCount > 0 && (
                              <span className="customizer-price-bar__total">$ {total.toLocaleString("es-UY")}</span>
                            )}
                          </div>
                        );
                      })()}
                    </section>

                    <section className="customizer-control-card">
                      <h3>Íconos</h3>
                      <RimImageModeSelector
                        mode={configuration.rim.imageMode}
                        onSelect={(imageMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, imageMode } }))}
                      />
                      {configuration.rim.imageMode === "image" && (
                        <div className="customizer-card-body customizer-card-body--icons">
                          <VirolaIconSelector
                            icons={configuration.rim.icons}
                            onChange={(icons) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, icons } }))}
                            selectedElementId={selectedRimElement}
                            onSelectElement={(id) => {
                              setSelectedRimElement(id);
                              setPreviewView("virola");
                            }}
                          />
                          {(configuration.rim.icons.length < 3 || uploadedRimIcon) && (
                            <div className="customizer-upload">
                              <CustomImageUpload
                                value={uploadedRimIcon?.customImage ?? null}
                                onChange={updateUploadedRimIcon}
                                onPlace={locateUploadedRimIcon}
                                isPlacing={placingRimIconId === uploadedRimIcon?.id}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {configuration.rim.imageMode === "image" && (() => {
                        const engravingType = configuration.engravingTypeId;
                        if (!engravingType) return null;
                        const iconCount = configuration.rim.icons.filter((icon) => icon.selectedImageId || icon.customImage).length;
                        const pricePerIcon = getCustomizationPrice(pricingCatalog, engravingType, "rim_image") ?? 400;
                        const total = iconCount * pricePerIcon;
                        return (
                          <div className="customizer-price-bar">
                            <p className="customizer-price-bar__label">
                              El precio por cada ícono o escudo en apliques es de <strong>$ {pricePerIcon.toLocaleString("es-UY")}</strong>
                            </p>
                            {iconCount > 0 && (
                              <span className="customizer-price-bar__total">$ {total.toLocaleString("es-UY")}</span>
                            )}
                          </div>
                        );
                      })()}
                    </section>

                    <section className="customizer-control-card">
                      <h3>Terminación</h3>
                      <RimFinishModeSelector mode={configuration.rim.finishMode || "none"} onSelect={(finishMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, finishMode } }))} />
                      {configuration.rim.finishMode === "finish" && (
                        <div className="customizer-card-body customizer-card-body--finish">
                          <RimFinishSelector
                            selectedFinishId={configuration.rim.finishId}
                            onSelect={(finishId) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, finishId } }))}
                          />
                        </div>
                      )}
                    </section>
                  </div>
                </PhaseAccordion>

                {selectedModelDefinition.hasFleje && (
                <PhaseAccordion number={3} title="Fleje" isOpen={activePhase === "fleje"} onToggle={() => activatePhase("fleje")}>
                  {selectedModelDefinition.hasFleje ? (
                    <div className="customizer-card-grid">
                      <section className="customizer-control-card">
                        <h3>Tipo de aplique</h3>
                        <div className="flex flex-col gap-2">
                          {engravingTypeOptions
                            .filter((option) => getEngravingCapabilities(configuration.selection.familyId, configuration.selection.textureId).flejeEngravingTypes.includes(option.id))
                            .map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setConfiguration((current) => ({ ...current, flejeEngravingTypeId: option.id }))}
                                aria-pressed={configuration.flejeEngravingTypeId === option.id}
                                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${configuration.flejeEngravingTypeId === option.id ? "border-[#5f3826] bg-[#5f3826] text-white" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
                              >
                                <span className="font-medium">{option.label}</span>
                              </button>
                            ))}
                        </div>
                      </section>

                      <section className="customizer-control-card">
                        <h3>Texto</h3>
                        <RimTextModeSelector
                          mode={flejeConfig.sides.front.textMode === "text" || flejeConfig.sides.back.textMode === "text" ? "text" : "none"}
                          onSelect={(textMode) => setFlejeConfig((current) => ({
                            ...current,
                            sides: {
                              front: { ...current.sides.front, textMode },
                              back: { ...current.sides.back, textMode },
                            },
                          }))}
                        />
                        {(flejeConfig.sides.front.textMode === "text" || flejeConfig.sides.back.textMode === "text") && (
                          <div className="fleje-side-stack">
                            {(["front", "back"] as FlejeSide[]).map((side) => (
                              <section
                                className="fleje-side-panel fleje-text-side"
                                key={side}
                                onFocusCapture={() => {
                                  setActiveFlejeSide(side);
                                  setSelectedFlejeElement("text");
                                }}
                                onPointerDownCapture={() => setActiveFlejeSide(side)}
                              >
                                <h4>{side === "front" ? "Frente" : "Dorso"}</h4>
                                <RimTextEditor
                                  label={`Texto del ${side === "front" ? "frente" : "dorso"}`}
                                  value={flejeConfig.sides[side].text}
                                  disabled={false}
                                  maxLength={7}
                                  compact
                                  onChange={(text) => updateFlejeSide(side, { text, textMode: "text" })}
                                />
                              </section>
                            ))}
                          </div>
                        )}
                        {(flejeConfig.sides.front.textMode === "text" || flejeConfig.sides.back.textMode === "text") && (
                          <span className="customizer-control-price">{customizationPriceLabel("fleje_text")}</span>
                        )}
                      </section>

                      <section className="customizer-control-card">
                        <h3>Íconos</h3>
                        <RimImageModeSelector
                          mode={flejeConfig.sides.front.imageMode === "image" || flejeConfig.sides.back.imageMode === "image" ? "image" : "none"}
                          onSelect={(imageMode) => setFlejeConfig((current) => ({
                            ...current,
                            sides: {
                              front: { ...current.sides.front, imageMode },
                              back: { ...current.sides.back, imageMode },
                            },
                          }))}
                        />
                        {(flejeConfig.sides.front.imageMode === "image" || flejeConfig.sides.back.imageMode === "image") && (
                          <div className="fleje-side-stack">
                            {(["front", "back"] as FlejeSide[]).map((side) => (
                              <section
                                className="fleje-side-panel"
                                key={side}
                                onFocusCapture={() => {
                                  setActiveFlejeSide(side);
                                  setSelectedFlejeElement("image");
                                }}
                                onPointerDownCapture={() => setActiveFlejeSide(side)}
                              >
                                <h4>{side === "front" ? "Frente" : "Dorso"}</h4>
                                <VirolaIconSelector
                                  limit={14}
                                  icons={flejeConfig.sides[side].icons || []}
                                  onChange={(icons) => updateFlejeSide(side, { icons, imageMode: "image" })}
                                  selectedElementId={selectedFlejeElement === "image" ? flejeConfig.sides[side].icons[0]?.id : null}
                                  onSelectElement={() => {
                                    setActiveFlejeSide(side);
                                    setSelectedFlejeElement("image");
                                  }}
                                />
                                {(flejeConfig.sides[side].icons?.length < 14) && (
                                  <div className="customizer-upload mt-4">
                                    <CustomImageUpload
                                      value={null}
                                      onChange={(asset) => {
                                        if (asset) {
                                          updateFlejeSide(side, {
                                            icons: [...(flejeConfig.sides[side].icons || []), { id: crypto.randomUUID(), selectedImageId: null, customImage: asset, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side } }],
                                            imageMode: "image"
                                          });
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                        {(flejeConfig.sides.front.imageMode === "image" || flejeConfig.sides.back.imageMode === "image") && (
                          <span className="customizer-control-price">{customizationPriceLabel("fleje_image")}</span>
                        )}
                      </section>

                      <section className="customizer-control-card">
                        <h3>Terminación</h3>
                        <RimFinishModeSelector mode={flejeConfig.finishMode || "none"} onSelect={(finishMode) => setFlejeConfig((current) => ({ ...current, finishMode }))} />
                        {flejeConfig.finishMode === "finish" && <FlejeFinishSelector selectedFinishId={flejeConfig.finishId} onSelect={(finishId) => setFlejeConfig((current) => ({ ...current, finishId }))} />}
                      </section>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px] leading-relaxed text-zinc-500">El mate Camionero no tiene fleje metálico para grabado.</p>
                  )}
                </PhaseAccordion>
                )}

                <div className="mt-2 pt-4 border-t border-zinc-200/80">
                  <button
                    type="button"
                    onClick={() => changeStep("summary")}
                    disabled={saveStatus !== "idle"}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
                      saveStatus === "saved"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : saveStatus === "saving"
                        ? "bg-zinc-400 cursor-not-allowed"
                        : "bg-[#7a4a31] hover:bg-[#5f3826]"
                    }`}
                  >
                    {saveStatus === "saving" && (
                      <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    )}
                    {saveStatus === "saved" && (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                    {saveStatus === "idle" && "Guardar diseño y continuar"}
                    {saveStatus === "saving" && "Guardando diseño..."}
                    {saveStatus === "saved" && "¡Diseño Guardado! Avanzando..."}
                  </button>
                </div>
              </aside>

              {/* PANEL 2: CENTRO (Visualizador 3D / Preview) */}
              <section className="customizer-preview order-1 flex min-h-[540px] w-full flex-col lg:order-2 lg:col-span-5">
                <div ref={previewContainerRef} className="flex min-h-[500px] max-h-[540px] flex-1 items-center justify-center rounded-3xl border border-[#e7d7c1] bg-white/60 p-6 shadow-xs" aria-label="Vista previa del mate">
                  {previewView === "mate" ? (
                    <FlejePreview mate={selectedMate} text="" />
                  ) : previewView === "virola" ? (
                    <ConfiguratorPreview
                      rim={configuration.rim}
                      model={configuration.modelId}
                      engravingTypeId={configuration.engravingTypeId}
                      editable
                      selectedElement={selectedRimElement}
                      placingElementId={placingRimIconId}
                      onPlacementComplete={() => setPlacingRimIconId(null)}
                      onSelectElement={setSelectedRimElement}
                      onToggleInvert={(element) => setConfiguration((current) => {
                        const updatedTexts = current.rim.texts.map((t, idx) => {
                          if (t.id === element || (element === "text" && idx === 0)) {
                            return { ...t, inverted: !t.inverted };
                          }
                          return t;
                        });
                        return {
                          ...current,
                          rim: {
                            ...current.rim,
                            texts: updatedTexts,
                          },
                        };
                      })}
                      onTransformChange={(element, transform) => setConfiguration((current) => {
                        if (element === "text" || element === "text-1") {
                          const updatedTexts = current.rim.texts.map((t, idx) =>
                            idx === 0 || t.id === "text-1" ? { ...t, transform } : t
                          );
                          return {
                            ...current,
                            rim: {
                              ...current.rim,
                              textTransform: transform,
                              texts: updatedTexts,
                            },
                          };
                        }
                        if (element === "text-2") {
                          const updatedTexts = current.rim.texts.map((t, idx) =>
                            idx === 1 || t.id === "text-2" ? { ...t, transform } : t
                          );
                          return {
                            ...current,
                            rim: {
                              ...current.rim,
                              texts: updatedTexts,
                            },
                          };
                        }
                        return {
                          ...current,
                          rim: {
                            ...current.rim,
                            icons: current.rim.icons.map((icon) => icon.id === element ? { ...icon, transform } : icon),
                          },
                        };
                      })}
                    />
                  ) : selectedModelDefinition.hasFleje ? (
                    <FlatFlejePreview
                      flejeConfig={flejeConfig}
                      engravingTypeId={configuration.engravingTypeId}
                      activeSide={activeFlejeSide}
                      editable
                      selectedElement={selectedFlejeElement}
                      onSelectSide={setActiveFlejeSide}
                      onSelectElement={setSelectedFlejeElement}
                      onTransformChange={(side, element, transform) => updateFlejeSide(side, {
                        ...(element === "text" && { textTransform: transform }),
                        ...(element === "image" && { imageTransform: transform }),
                        ...(element === "finish" && { finishTransform: transform }),
                        icons: flejeConfig.sides[side].icons?.map(icon => icon.id === element ? { ...icon, transform } : icon) ?? [],
                      })}
                    />
                  ) : (
                    <p className="text-sm font-medium text-zinc-500">Este modelo no tiene fleje para visualizar.</p>
                  )}
                </div>

                {/* Minimalist Product Specification Bar */}
                {(() => {
                  return (
                    <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e7d7c1]/90 bg-white/95 px-6 py-3.5 text-center shadow-xs">
                      <span className="text-base md:text-lg font-black tracking-tight text-[#2d1d14] font-serif">
                        {configuration.selectionLabels.texture}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs md:text-sm">
                        <span><strong className="font-black uppercase tracking-wider text-[#7a4a31]">Metal:</strong> <span className="font-semibold text-zinc-800">{configuration.selectionLabels.metal}</span></span>
                        <span className="font-bold text-[#a48e78]">•</span>
                        <span><strong className="font-black uppercase tracking-wider text-[#7a4a31]">Cuero:</strong> <span className="font-semibold text-zinc-800">{configuration.selectionLabels.color}</span></span>
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* PANEL 3: DERECHA (Resumen del Pedido & Totales) */}
              <aside className="customizer-order-summary order-3 flex flex-col gap-4 lg:order-3 lg:col-span-3">
                {(() => {
                  const pricing = calculateOrderPricing(configuration, flejeConfig, pricingCatalog);
                  const rimFin = getRimFinish(configuration.rim.finishId);
                  const flejeFin = getFlejeFinish(flejeConfig.finishId);

                  const totalExtraVirolaUYU = pricing.items.filter((item) => item.id.startsWith("rim_")).reduce((total, item) => total + item.totalUYU, 0);

                  const totalExtraFlejeUYU = pricing.items.filter((item) => item.id.startsWith("fleje_")).reduce((total, item) => total + item.totalUYU, 0);

                  const totalUYU = pricing.totalUYU;

                  return (
                    <div className="rounded-3xl border border-[#e7d7c1] bg-white/95 p-5 shadow-xl shadow-[#7a4a31]/5 space-y-5 sticky top-20">
                      <div className="flex items-center justify-between border-b border-[#e7d7c1]/60 pb-3">
                        <h3 className="text-base font-black text-[#2d1d14] font-serif uppercase tracking-tight flex items-center gap-2">
                          <span>Resumen del pedido</span>
                        </h3>
                      </div>

                      {/* Desglose de Items */}
                      <div className="space-y-3 text-xs">
                        {/* Mate Base */}
                        <div className="space-y-1 border-b border-[#e7d7c1]/50 pb-2.5">
                          <div className="flex justify-between items-baseline font-bold text-[#2d1d14]">
                            <span>Mate ({configuration.selectionLabels.family}):</span>
                            <span className="text-[#7a4a31] text-sm">{pricing.isPriceReady ? `$ ${pricing.basePriceUYU.toLocaleString('es-UY')} UYU` : "Precio pendiente"}</span>
                          </div>
                          <p className="text-[11px] text-[#5f3826]/70 font-medium">
                            {configuration.selectionLabels.texture} · {configuration.selectionLabels.color}
                          </p>
                        </div>

                        {/* Virola Desglose */}
                        <div className="space-y-1 border-b border-[#e7d7c1]/50 pb-2.5">
                          <div className="flex justify-between items-baseline font-bold text-[#2d1d14]">
                            <span>Virola:</span>
                            <span className="text-[#7a4a31]">
                              {totalExtraVirolaUYU > 0 ? `+ $ ${totalExtraVirolaUYU} UYU` : "Incluida ($0)"}
                            </span>
                          </div>
                          
                          <div className="space-y-0.5 text-[11px] text-zinc-600 font-medium">
                            <p>
                                Terminación: {configuration.rim.finishMode === "finish" ? (rimFin?.name || 'Cincelado') : "Sin terminación"}
                            </p>
                            <p>
                              • Grabado de texto: {configuration.rim.textMode === "text" ? (() => {
                                const activeTexts = configuration.rim.texts?.filter(t => t.text.trim()) ?? (configuration.rim.text ? [{ id: "text-1", text: configuration.rim.text }] : []);
                                if (activeTexts.length === 0) return "Sin texto";
                                return activeTexts.map((t, idx) => `T${idx + 1}: "${t.text}"`).join(" + ") + ` (+${customizationPriceLabel("rim_text")})`;
                              })() : "Sin texto"}
                            </p>
                            <p>
                              • Grabado de imagen: {configuration.rim.imageMode === "image" ? `Con imagen (+${customizationPriceLabel("rim_image")})` : "Sin imagen"}
                            </p>
                          </div>
                        </div>

                        {/* Fleje Desglose */}
                        {selectedModelDefinition.hasFleje && (
                          <div className="space-y-1 border-b border-[#e7d7c1]/50 pb-2.5">
                            <div className="flex justify-between items-baseline font-bold text-[#2d1d14]">
                              <span>Fleje:</span>
                              <span className="text-[#7a4a31]">
                                {totalExtraFlejeUYU > 0 ? `+ $ ${totalExtraFlejeUYU} UYU` : "Incluido ($0)"}
                              </span>
                            </div>
                            <div className="space-y-0.5 text-[11px] text-zinc-600 font-medium">
                              <p>
                                • Terminación: {flejeConfig.finishMode === "finish" ? (flejeFin?.name || 'Cincelado') : "Sin terminación (Liso)"}
                              </p>
                              <p>
                                • Textos configurados: {(["front", "back"] as FlejeSide[]).filter((side) => flejeConfig.sides[side].textMode === "text" && flejeConfig.sides[side].text.trim()).length}
                              </p>
                              <p>
                                • Imágenes configuradas: {(["front", "back"] as FlejeSide[]).filter((side) => flejeConfig.sides[side].imageMode === "image" && flejeConfig.sides[side].selectedImageId).length}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Caja de Total Pedido */}
                      <div className="rounded-2xl bg-[#fbf3de] border-2 border-[#7a4a31]/30 p-4 space-y-1 shadow-xs">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-black uppercase tracking-wider text-[#7a4a31]">
                            Total Pedido
                          </span>
                          <span className="text-right text-2xl font-black text-[#2d1d14] font-serif leading-none">
                            {pricing.isPriceReady ? `$ ${totalUYU.toLocaleString('es-UY')} UYU` : "Pendiente"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </aside>

            </div>
          </main>
        )}

        {wizardStep === "summary" && (
          <SummaryStep
            userData={userData}
            configuration={configuration}
            flejeConfig={flejeConfig}
            previewRef={previewContainerRef}
            onEditDesign={() => changeStep("customizer")}
            onEditContact={() => requireAuthentication("edit-contact")}
            onProceedToCheckout={() => requireAuthentication("checkout")}
            onSaveDraft={() => requireAuthentication("save-summary")}
          />
        )}

        {wizardStep === "checkout" && (
          <CheckoutStep
            subtotalUYU={calculateOrderPricing(configuration, flejeConfig, pricingCatalog).totalUYU}
            pricingReady={calculateOrderPricing(configuration, flejeConfig, pricingCatalog).isCheckoutReady}
            mercadoPagoCommissionPercent={getMercadoPagoCommissionPercent(pricingCatalog)}
            onBack={() => changeStep("summary")}
            onContinue={(payment) => void handleCheckoutComplete(payment)}
          />
        )}

        {wizardStep === "success" && (
          <SuccessStep userData={effectiveUserData} onReset={handleReset} mockPayment />
        )}

        {wizardStep === "profile" && (
          <ProfileStep
            userData={effectiveUserData}
            localDesigns={localDesigns}
            onLoadDesign={handleLoadDesignFromProfile}
            onNewDesign={() => {
              setLastSavedDesignId(null);
              setSelection({ ...EMPTY_MATE_SELECTION });
              changeStep("product_selection");
            }}
            onUpdateUserData={handleUpdateUserData}
            onLogout={handleLogout}
            onSendDraftToProduction={handleDraftCheckoutFromProfile}
          />
        )}
      </div>

      <BrandFooter onProfile={() => requireAuthentication("profile")} />

      {/* Save Success Toast */}
      {saveStatus === "saved" && (
        <div className="fixed bottom-6 right-6 z-50 flex animate-bounce items-center gap-4 rounded-2xl bg-white p-4 shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100 transition-all duration-300">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800">¡Guardado con éxito!</p>
            <p className="text-xs font-medium text-zinc-500">Avanzando al resumen de producción...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  return location.pathname.startsWith("/dashboard") ? (
    <Suspense fallback={<main className="pricing-loading" id="main-content">Cargando administración…</main>}>
      <PricingDashboard />
    </Suspense>
  ) : <VisualizerApp />;
}
