import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { UserData, WizardStep, SavedDesignItem } from "./types/user";
import { fetchProductPricesFromSupabase, saveUserProfileToSupabase, supabase, saveDesignToSupabase } from "./lib/supabase";
import { uploadOrderPreview } from "./services/storageService";
import { sendOrderToGoogleSheet } from "./services/googleSheetService";
import { captureElementAsBlob } from "./services/capturePreview";
import { WelcomeStep } from "./components/WelcomeStep";
import { ProductSelectionStep } from "./components/ProductSelectionStep";
import { StepIndicator } from "./components/StepIndicator";
import { SummaryStep } from "./components/SummaryStep";
import { SuccessStep } from "./components/SuccessStep";
import { ProfileStep } from "./components/ProfileStep";
import { MateModelSelector } from "./components/MateModelSelector";
import { MateVariantSelector } from "./components/MateVariantSelector";
import { ConfiguratorPreview } from "./components/ConfiguratorPreview";
import { FlatFlejePreview, type FlejeCustomization } from "./components/FlatFlejePreview";
import { FlejeFinishSelector } from "./components/FlejeFinishSelector";
import { RimFinishSelector } from "./components/RimFinishSelector";
import { RimFinishModeSelector } from "./components/RimFinishModeSelector";
import { RimIconSelector } from "./components/RimIconSelector";
import { RimImageModeSelector } from "./components/RimImageModeSelector";
import { RimTextEditor } from "./components/RimTextEditor";
import { RimTextModeSelector } from "./components/RimTextModeSelector";
import { getDefaultVariant, getModelDefinition, getVariantsByModel, mateVariants, type EngravingArea, type MateModel, type MateVariant } from "./catalog/mateCatalog";
import { createDefaultRimSelection, normalizeRimSelection, type RimCustomization } from "./catalog/rimCatalog";
import { getRimFinish } from "./catalog/rimFinishCatalog";
import { getFlejeFinish } from "./catalog/flejeFinishCatalog";
import { getVariantPrice, getCustomizationPrice, getVariantDetails } from "./catalog/pricingCatalog";

type CustomizationPhase = "mate" | "virola" | "fleje";
type PreviewView = "mate" | "virola" | "fleje";

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

interface MateConfiguration {
  modelId: MateModel;
  variantId: string;
  rim: RimCustomization;
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
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-50/50">
        <div className="flex items-center gap-3">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-bold ${isOpen ? "bg-[#7a4a31] text-white" : "bg-zinc-100 text-zinc-500"}`}>{number}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">{title}</span>
        </div>
        <span className="text-[10px] text-zinc-400">{isOpen ? "−" : "＋"}</span>
      </button>
      <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] border-t border-zinc-100 opacity-100" : "grid-rows-[0fr] pointer-events-none opacity-0"}`}>
        <div className="overflow-hidden p-4">{children}</div>
      </div>
    </section>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

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
    switch (path) {
      case "/profile":
        return "profile";
      case "/selection":
      case "/product-selection":
        return "product_selection";
      case "/customizer":
        return "customizer";
      case "/summary":
        return "summary";
      case "/success":
        return "success";
      default:
        return "welcome";
    }
  };

  const [wizardStep, setWizardStepState] = useState<WizardStep>(() => getStepFromPath(location.pathname));

  // Sync route changes with state
  useEffect(() => {
    setWizardStepState(getStepFromPath(location.pathname));
  }, [location.pathname]);

  // Ensure profile ID is synced with Supabase when app loads
  useEffect(() => {
    if (userData && userData.email && !userData.id) {
      saveUserProfileToSupabase(userData).then(({ profile }) => {
        if (profile) {
          const updated = { ...userData, id: profile.id };
          setUserData(updated);
          localStorage.setItem("matearte_user", JSON.stringify(updated));
        }
      });
    }
  }, [userData?.email]);

  const changeStep = (step: WizardStep) => {
    setWizardStepState(step);
    switch (step) {
      case "profile":
        navigate("/profile");
        break;
      case "product_selection":
        navigate("/selection");
        break;
      case "customizer":
        navigate("/customizer");
        break;
      case "summary":
        navigate("/summary");
        break;
      case "success":
        navigate("/success");
        break;
      default:
        navigate("/");
        break;
    }
  };

  useEffect(() => {
    fetchProductPricesFromSupabase();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
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

        // Si inició sesión (ej. OAuth Google) o está en la página de inicio estando logueado, redirigir a /selection
        if (event === "SIGNED_IN" || location.pathname === "/" || location.pathname === "") {
          changeStep("product_selection");
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const [activePhase, setActivePhase] = useState<CustomizationPhase | null>("mate");
  const [previewView, setPreviewView] = useState<PreviewView>("mate");
  const initialVariant = getDefaultVariant("imperial");
  const [configuration, setConfiguration] = useState<MateConfiguration>(() => ({ modelId: initialVariant.model, variantId: initialVariant.id, rim: createDefaultRimSelection(initialVariant) }));
  const selectedMate = mateVariants.find((variant) => variant.id === configuration.variantId) ?? initialVariant;
  const [flejeConfig, setFlejeConfig] = useState<FlejeCustomization>({ finishMode: "none", finishId: "pattern-1", textMode: "none", text: "", imageMode: "none", selectedImageId: null });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [localDesigns] = useState<SavedDesignItem[]>([]);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleWelcomeSubmit = async (data: UserData) => {
    const { profile } = await saveUserProfileToSupabase(data);
    const mergedUser = profile ? { ...data, id: profile.id } : data;
    setUserData(mergedUser);
    localStorage.setItem("matearte_user", JSON.stringify(mergedUser));
    changeStep("product_selection");
  };

  const [lastSavedDesignId, setLastSavedDesignId] = useState<string | null>(null);

  const handleSaveDesign = async () => {
    if (saveStatus !== "idle") return;
    setSaveStatus("saving");

    const { data } = await saveDesignToSupabase({
      designId: lastSavedDesignId,
      userId: userData?.id,
      configuration,
      flejeConfig,
      title: `Mate ${selectedMate.name}`,
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
      configuration,
      flejeConfig,
      title: `Mate ${selectedMate.name}`,
      status: 'draft',
    });
    if (data && data[0]?.id) {
      setLastSavedDesignId(data[0].id);
    }

    changeStep("profile");
  };

  const handleSendToProduction = async () => {
    // 1. Capturar screenshot del preview DE INMEDIATO mientras el componente está montado y visible
    let previewBlob: Blob | null = null;
    if (previewContainerRef.current) {
      try {
        console.log('📸 Capturando vista previa en SummaryStep...');
        previewBlob = await captureElementAsBlob(previewContainerRef.current);
      } catch (err) {
        console.warn('⚠️ Error al capturar vista previa:', err);
      }
    } else {
      console.warn('⚠️ previewContainerRef.current era NULL al enviar a producción');
    }

    // 2. Guardar o actualizar en Supabase DB
    console.log('💾 Guardando/Actualizando pedido en base de datos Supabase...');
    const { data: designData } = await saveDesignToSupabase({
      designId: lastSavedDesignId,
      userId: userData?.id,
      configuration,
      flejeConfig,
      title: `Orden Final - ${selectedMate.name}`,
      status: 'submitted',
    });

    const designId = designData?.[0]?.id || lastSavedDesignId || `design-${Date.now()}`;
    if (designData?.[0]?.id) {
      setLastSavedDesignId(designData[0].id);
    }

    // 3. Subir a Supabase Storage
    let previewImageUrl: string | null = null;
    if (previewBlob) {
      try {
        console.log('☁️ Subiendo imagen a Supabase Storage...');
        previewImageUrl = await uploadOrderPreview(previewBlob, designId);
        console.log('✅ URL de la imagen generada:', previewImageUrl);
      } catch (err) {
        console.warn('⚠️ Error al subir la imagen al Storage:', err);
      }
    } else {
      console.warn('⚠️ No se capturó Blob de imagen para subir');
    }

    // 4. Enviar al Google Sheet
    try {
      console.log('📊 Enviando pedido a Google Sheet...');
      await sendOrderToGoogleSheet({
        userData: effectiveUserData,
        configuration,
        flejeConfig,
        previewImageUrl,
        designId,
      });
    } catch (err) {
      console.warn('⚠️ Error al enviar a Google Sheet:', err);
    }

    changeStep("success");
  };

  const handleLoadDesignFromProfile = (item: SavedDesignItem) => {
    if (item.configuration) {
      setConfiguration(item.configuration);
    }
    if (item.fleje_config) {
      setFlejeConfig(item.fleje_config);
    }
    setLastSavedDesignId(item.id);
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

  const selectedModelDefinition = getModelDefinition(selectedMate.model);
  const compatibleVariants = getVariantsByModel(configuration.modelId);

  const selectModel = (model: MateModel) => {
    const defaultVariant = getDefaultVariant(model);
    setConfiguration((current) => ({ modelId: model, variantId: defaultVariant.id, rim: normalizeRimSelection(defaultVariant, current.rim) }));
    setPreviewView("mate");
    setLastSavedDesignId(null);
  };

  const selectVariant = (variantId: string) => {
    const variant = mateVariants.find((item) => item.id === variantId);
    if (!variant || variant.model !== configuration.modelId) return;
    setConfiguration((current) => ({ ...current, variantId: variant.id, rim: normalizeRimSelection(variant, current.rim) }));
    setPreviewView("mate");
  };

  const activatePhase = (phase: CustomizationPhase) => {
    setActivePhase((currentPhase) => currentPhase === phase ? null : phase);
    setPreviewView(phase);
  };

  const handleUpdateUserData = async (newUserData: UserData) => {
    const { profile } = await saveUserProfileToSupabase(newUserData);
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

  const handleSendDraftToProductionFromProfile = async (design: SavedDesignItem) => {
    const config = design.configuration || configuration;
    const flejeConf = design.fleje_config || flejeConfig;
    const variant = mateVariants.find((v) => v.id === config.variantId) || selectedMate;

    // 1. Actualizar estado a 'submitted' en Supabase DB
    const { data: designData } = await saveDesignToSupabase({
      designId: design.id,
      userId: userData?.id,
      configuration: config,
      flejeConfig: flejeConf,
      title: `Orden Final - ${variant.name}`,
      status: 'submitted',
    });

    const designId = designData?.[0]?.id || design.id;

    // 2. Enviar datos a Google Sheet
    try {
      await sendOrderToGoogleSheet({
        userData: effectiveUserData,
        configuration: config,
        flejeConfig: flejeConf,
        previewImageUrl: null,
        designId,
      });
    } catch (err) {
      console.warn('⚠️ Error enviando borrador a Google Sheet:', err);
    }
  };

  return (
    <div className="mate-theme min-h-screen overflow-x-hidden bg-gradient-to-b from-[#f9ecd0] via-[#fdf7e9] to-[#fbf3de] font-sans text-zinc-800 antialiased flex flex-col">
      {/* Universal Sticky Header */}
      <header className="sticky top-0 z-30 bg-[rgba(251,243,222,0.95)] backdrop-blur-xl border-b border-[#e7d7c1] shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {wizardStep !== "profile" ? (
            <div className="flex items-center gap-3">
              <img src="/logoma.jpg" alt="Matearte" className="h-10 w-10 rounded-2xl object-cover shadow-xs cursor-pointer" onClick={() => changeStep("welcome")} />
              <div>
                <h1 className="text-base font-black tracking-tight text-[#2d1d14] leading-none font-serif cursor-pointer" onClick={() => changeStep("welcome")}>Matearte</h1>
                {userData ? (
                  <span className="text-[11px] text-[#5f3826] font-semibold">Diseñador: {userData.name}</span>
                ) : (
                  <span className="text-[11px] text-[#5f3826]/80 font-medium">Creá tu propio mate</span>
                )}
              </div>
            </div>
          ) : (
            <div className="w-10" />
          )}

          {wizardStep === "profile" ? (
            <div className="flex items-center gap-2.5">
              <img src="/logoma.jpg" alt="Matearte" className="h-8 w-8 rounded-xl object-cover shadow-xs border border-[#7a4a31]/20" />
              <h2 className="text-lg md:text-xl font-black text-[#2d1d14] font-serif tracking-tight uppercase">
                Mi Perfil
              </h2>
            </div>
          ) : (
            <div className="hidden md:block flex-1 max-w-md mx-6">
              <StepIndicator currentStep={wizardStep} onStepClick={(step) => changeStep(step)} />
            </div>
          )}

          {wizardStep !== "profile" && userData ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeStep("profile")}
                className="text-xs font-bold transition-colors py-1.5 px-3 rounded-lg border cursor-pointer border-[#e7d7c1] bg-[#fbf3de]/50 text-[#7a4a31] hover:bg-[#fbf3de]"
              >
                👤 Mi Perfil
              </button>
              <button
                type="button"
                onClick={() => changeStep("welcome")}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-black/5"
                title="Editar mis datos"
              >
                ✏️
              </button>
            </div>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {/* Mobile Step Indicator */}
        {wizardStep !== "profile" && (
          <div className="md:hidden border-t border-[#e7d7c1] py-1 bg-white/40">
            <StepIndicator currentStep={wizardStep} onStepClick={(step) => changeStep(step)} />
          </div>
        )}
      </header>

      {/* Main step content */}
      <div className="flex-1">
        {wizardStep === "welcome" && (
          <WelcomeStep initialData={userData || undefined} onSubmit={handleWelcomeSubmit} />
        )}

        {wizardStep === "product_selection" && (
          <ProductSelectionStep onSelectMate={() => changeStep("customizer")} />
        )}

        {wizardStep === "customizer" && (
          <main className="mx-auto w-full max-w-[1700px] px-4 md:px-6 py-6">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              
              {/* PANEL 1: IZQUIERDA (Acordeón de Personalización) */}
              <aside className="order-2 flex flex-col gap-3 lg:order-1 lg:col-span-4">
                <PhaseAccordion number={1} title="Mate" isOpen={activePhase === "mate"} onToggle={() => activatePhase("mate")}>
                  <div className="space-y-4">
                    <MateModelSelector selectedModel={configuration.modelId} onSelect={selectModel} />
                    <MateVariantSelector variants={compatibleVariants} selectedVariantId={selectedMate.id} onSelect={selectVariant} />
                  </div>
                </PhaseAccordion>

                <PhaseAccordion number={2} title="Virola" isOpen={activePhase === "virola"} onToggle={() => activatePhase("virola")}>
                  <div className="space-y-4">
                    <RimFinishModeSelector
                      mode={configuration.rim.finishMode || "none"}
                      onSelect={(finishMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, finishMode } }))}
                    />

                    {configuration.rim.finishMode === "finish" && (
                      <RimFinishSelector
                        selectedFinishId={configuration.rim.finishId}
                        onSelect={(finishId) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, finishId } }))}
                      />
                    )}

                    <RimTextModeSelector
                      mode={configuration.rim.textMode}
                      onSelect={(textMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, textMode } }))}
                    />
                    {configuration.rim.textMode === "text" && (
                      <RimTextEditor
                        value={configuration.rim.text}
                        disabled={false}
                        onChange={(text) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, text } }))}
                      />
                    )}

                    <RimImageModeSelector
                      mode={configuration.rim.imageMode}
                      onSelect={(imageMode) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, imageMode } }))}
                    />
                    {configuration.rim.imageMode === "image" && (
                      <RimIconSelector
                        selectedImageId={configuration.rim.selectedImageId}
                        onSelect={(selectedImageId) => setConfiguration((current) => ({ ...current, rim: { ...current.rim, selectedImageId } }))}
                      />
                    )}
                  </div>
                </PhaseAccordion>

                <PhaseAccordion number={3} title="Fleje" isOpen={activePhase === "fleje"} onToggle={() => activatePhase("fleje")}>
                  {selectedModelDefinition.hasFleje ? (
                    <div className="space-y-4">
                      <RimFinishModeSelector
                        mode={flejeConfig.finishMode || "none"}
                        onSelect={(finishMode) => setFlejeConfig((c) => ({ ...c, finishMode }))}
                      />

                      {flejeConfig.finishMode === "finish" && (
                        <FlejeFinishSelector
                          selectedFinishId={flejeConfig.finishId}
                          onSelect={(finishId) => setFlejeConfig((current) => ({ ...current, finishId }))}
                        />
                      )}
                      
                      <RimTextModeSelector mode={flejeConfig.textMode} onSelect={(textMode) => setFlejeConfig((c) => ({ ...c, textMode }))} />
                      {flejeConfig.textMode === "text" && (
                        <RimTextEditor
                          label="Texto del fleje (máx. 7 caracteres)"
                          value={flejeConfig.text}
                          disabled={false}
                          maxLength={7}
                          onChange={(text) => setFlejeConfig((c) => ({ ...c, text }))}
                        />
                      )}
                      
                      <RimImageModeSelector mode={flejeConfig.imageMode} onSelect={(imageMode) => setFlejeConfig((c) => ({ ...c, imageMode }))} />
                      {flejeConfig.imageMode === "image" && <RimIconSelector selectedImageId={flejeConfig.selectedImageId} onSelect={(selectedImageId) => setFlejeConfig((c) => ({ ...c, selectedImageId }))} />}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px] leading-relaxed text-zinc-500">El mate Camionero no tiene fleje metálico para grabado.</p>
                  )}
                </PhaseAccordion>

                <div className="mt-2 pt-4 border-t border-zinc-200/80">
                  <button
                    type="button"
                    onClick={handleSaveDesign}
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
              <section className="order-1 flex min-h-[540px] w-full flex-col lg:order-2 lg:col-span-5">
                <div className="mb-4 flex self-center rounded-xl border border-[#e7d7c1] bg-white p-1 shadow-xs">
                  <button type="button" onClick={() => setPreviewView("mate")} className={`rounded-lg px-5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${previewView === "mate" ? "bg-[#7a4a31] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>Mate</button>
                  <button type="button" onClick={() => setPreviewView("virola")} className={`rounded-lg px-5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${previewView === "virola" ? "bg-[#7a4a31] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>Virola</button>
                  <button type="button" onClick={() => setPreviewView("fleje")} className={`rounded-lg px-5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${previewView === "fleje" ? "bg-[#7a4a31] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>Fleje</button>
                </div>

                <div className="flex min-h-[500px] max-h-[540px] flex-1 items-center justify-center rounded-3xl border border-[#e7d7c1] bg-white/60 p-6 shadow-xs" aria-label="Vista previa del mate">
                  {previewView === "mate" ? (
                    <FlejePreview mate={selectedMate} text="" />
                  ) : previewView === "virola" ? (
                    <ConfiguratorPreview rim={configuration.rim} />
                  ) : selectedModelDefinition.hasFleje ? (
                    <FlatFlejePreview flejeConfig={flejeConfig} />
                  ) : (
                    <p className="text-sm font-medium text-zinc-500">Este modelo no tiene fleje para visualizar.</p>
                  )}
                </div>

                {/* Minimalist Product Specification Bar */}
                {(() => {
                  const details = getVariantDetails(selectedMate.id);
                  const displayName = details?.name || selectedMate.name;
                  const virola = details?.virola;
                  const tipoCuero = details?.tipoCuero;

                  return (
                    <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e7d7c1]/90 bg-white/95 px-6 py-3.5 text-center shadow-xs">
                      {/* Renglón de arriba: Nombre de la variante sin itálica y con mayor tamaño */}
                      <span className="text-base md:text-lg font-black tracking-tight text-[#2d1d14] font-serif">
                        {displayName}
                      </span>

                      {/* Renglón de abajo: Virola y Cuero con mayor tamaño */}
                      {(virola || tipoCuero) && (
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs md:text-sm">
                          {virola && (
                            <span>
                              <strong className="font-black text-[#7a4a31] uppercase tracking-wider">Virola:</strong>{" "}
                              <span className="font-semibold text-zinc-800">{virola}</span>
                            </span>
                          )}
                          {virola && tipoCuero && (
                            <span className="text-[#a48e78] font-bold">•</span>
                          )}
                          {tipoCuero && (
                            <span>
                              <strong className="font-black text-[#7a4a31] uppercase tracking-wider">Cuero:</strong>{" "}
                              <span className="font-semibold text-zinc-800">{tipoCuero}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>

              {/* PANEL 3: DERECHA (Resumen del Pedido & Totales) */}
              <aside className="order-3 flex flex-col gap-4 lg:order-3 lg:col-span-3">
                {(() => {
                  const currentPrice = getVariantPrice(configuration.variantId);
                  const rimFin = getRimFinish(configuration.rim.finishId);
                  const flejeFin = getFlejeFinish(flejeConfig.finishId);

                  // Virola extras dinámicos desde Supabase
                  const rimFinishExtraUYU = configuration.rim.finishMode === "finish" ? getCustomizationPrice("rim_finish") : 0;
                  const rimTextExtraUYU = configuration.rim.textMode === "text" ? getCustomizationPrice("rim_text") : 0;
                  const rimImageExtraUYU = configuration.rim.imageMode === "image" ? getCustomizationPrice("rim_image") : 0;
                  const totalExtraVirolaUYU = rimFinishExtraUYU + rimTextExtraUYU + rimImageExtraUYU;

                  // Fleje extras dinámicos desde Supabase
                  const flejeFinishExtraUYU = (selectedModelDefinition.hasFleje && flejeConfig.finishMode === "finish") ? getCustomizationPrice("fleje_finish") : 0;
                  const flejeTextExtraUYU = (selectedModelDefinition.hasFleje && flejeConfig.textMode === "text") ? getCustomizationPrice("fleje_text") : 0;
                  const flejeImageExtraUYU = (selectedModelDefinition.hasFleje && flejeConfig.imageMode === "image") ? getCustomizationPrice("fleje_image") : 0;
                  const totalExtraFlejeUYU = flejeFinishExtraUYU + flejeTextExtraUYU + flejeImageExtraUYU;

                  const totalUYU = currentPrice.priceUYU + totalExtraVirolaUYU + totalExtraFlejeUYU;

                  return (
                    <div className="rounded-3xl border border-[#e7d7c1] bg-white/95 p-5 shadow-xl shadow-[#7a4a31]/5 space-y-5 sticky top-20">
                      <div className="flex items-center justify-between border-b border-[#e7d7c1]/60 pb-3">
                        <h3 className="text-base font-black text-[#2d1d14] font-serif uppercase tracking-tight flex items-center gap-2">
                          <span>🛒 Resumen del Pedido</span>
                        </h3>
                      </div>

                      {/* Desglose de Items */}
                      <div className="space-y-3 text-xs">
                        {/* Mate Base */}
                        <div className="space-y-1 border-b border-[#e7d7c1]/50 pb-2.5">
                          <div className="flex justify-between items-baseline font-bold text-[#2d1d14]">
                            <span>Mate ({selectedModelDefinition.name}):</span>
                            <span className="text-[#7a4a31] text-sm">$ {currentPrice.priceUYU.toLocaleString('es-UY')} UYU</span>
                          </div>
                          <p className="text-[11px] text-[#5f3826]/70 font-medium">
                            {selectedMate.name}
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
                              • Terminación: {configuration.rim.finishMode === "finish" ? `${rimFin?.name || 'Cincelado'} (+$100 UYU)` : "Sin terminación"}
                            </p>
                            <p>
                              • Grabado de texto: {configuration.rim.textMode === "text" ? `"${configuration.rim.text || 'Con texto'}" (+$100 UYU)` : "Sin texto"}
                            </p>
                            <p>
                              • Grabado de imagen: {configuration.rim.imageMode === "image" ? "Con imagen (+$200 UYU)" : "Sin imagen"}
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
                                • Terminación: {flejeConfig.finishMode === "finish" ? `${flejeFin?.name || 'Cincelado'} (+$100 UYU)` : "Sin terminación (Liso)"}
                              </p>
                              <p>
                                • Grabado de texto: {flejeConfig.textMode === "text" ? `"${flejeConfig.text || 'Con texto'}" (+$100 UYU)` : "Sin texto"}
                              </p>
                              <p>
                                • Grabado de imagen: {flejeConfig.imageMode === "image" ? "Con imagen (+$200 UYU)" : "Sin imagen"}
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
                          <span className="text-2xl font-black text-[#2d1d14] font-serif leading-none">
                            $ {totalUYU.toLocaleString('es-UY')} UYU
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
            userData={effectiveUserData}
            configuration={configuration}
            flejeConfig={flejeConfig}
            previewRef={previewContainerRef}
            onEditDesign={() => changeStep("customizer")}
            onEditContact={() => changeStep("welcome")}
            onSendToProduction={handleSendToProduction}
            onSaveDraft={handleSaveDraftFromSummary}
          />
        )}

        {wizardStep === "success" && (
          <SuccessStep userData={effectiveUserData} onReset={handleReset} />
        )}

        {wizardStep === "profile" && (
          <ProfileStep
            userData={effectiveUserData}
            localDesigns={localDesigns}
            onLoadDesign={handleLoadDesignFromProfile}
            onNewDesign={() => {
              setLastSavedDesignId(null);
              changeStep("product_selection");
            }}
            onUpdateUserData={handleUpdateUserData}
            onLogout={handleLogout}
            onSendDraftToProduction={handleSendDraftToProductionFromProfile}
          />
        )}
      </div>

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
