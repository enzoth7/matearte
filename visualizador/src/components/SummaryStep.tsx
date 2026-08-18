import { useState, type RefObject } from "react";
import type { UserData } from "../types/user";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";
import { getModelDefinition, getVariantDefinition, mateSizeLabels } from "../catalog/mateCatalog";
import { getRimOption } from "../catalog/rimCatalog";
import { getRimFinish } from "../catalog/rimFinishCatalog";
import { getFlejeFinish } from "../catalog/flejeFinishCatalog";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import { calculateOrderPricing } from "../catalog/pricingCatalog";
import { ConfiguratorPreview } from "./ConfiguratorPreview";
import { FlatFlejePreview } from "./FlatFlejePreview";

interface SummaryStepProps {
  userData: UserData;
  configuration: MateConfiguration;
  flejeConfig: FlejeCustomization;
  previewRef?: RefObject<HTMLDivElement | null>;
  onEditDesign: () => void;
  onEditContact: () => void;
  onProceedToCheckout: () => void;
  onSaveDraft: () => void;
}
function imageName(selectedImageId: string | null, customName?: string) {
  if (!selectedImageId) return null;
  return customName ?? rimIconCatalog.find((icon) => icon.id === selectedImageId)?.name ?? "Imagen personalizada";
}

export function SummaryStep({
  userData,
  configuration,
  flejeConfig,
  previewRef,
  onEditDesign,
  onEditContact,
  onProceedToCheckout,
  onSaveDraft,
}: SummaryStepProps) {
  const [isDrafting, setIsDrafting] = useState(false);
  const model = getModelDefinition(configuration.modelId);
  const variant = getVariantDefinition(configuration.variantId);
  if (!variant) return null;

  const color = variant.colors.find((item) => item.id === configuration.colorId) ?? variant.colors[0];
  const rimMaterial = getRimOption(configuration.rim.rimId);
  const rimFinish = getRimFinish(configuration.rim.finishId);
  const flejeFinish = getFlejeFinish(flejeConfig.finishId);
  const pricing = calculateOrderPricing(configuration, flejeConfig);
  const rimImageName = configuration.rim.icons.map(icon => imageName(icon.selectedImageId, icon.customImage?.name)).filter(Boolean).join(", ");
  const saveDraft = () => {
    setIsDrafting(true);
    window.setTimeout(() => {
      setIsDrafting(false);
      onSaveDraft();
    }, 500);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <div className="rounded-3xl border border-[#e7d7c1] bg-white/95 p-5 shadow-2xl shadow-[#7a4a31]/10 md:p-9">
        <header className="flex flex-col gap-3 border-b border-[#e7d7c1] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4a31]">Revisión</p>
            <h1 className="mt-1 font-serif text-3xl font-black text-[#2d1d14]">Tu mate personalizado</h1>
            <p className="mt-2 text-sm text-[#5f3826]/80">Revisá las vistas, especificaciones y precios antes de entrar al checkout visual.</p>
          </div>
          <button type="button" onClick={onEditDesign} className="min-h-11 rounded-xl border border-[#7a4a31] bg-white px-4 text-xs font-bold text-[#7a4a31] hover:bg-[#fbf3de]">Modificar diseño</button>
        </header>

        <div className="mt-7 grid gap-7 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-7" ref={previewRef}>
            <div className="rounded-2xl border border-[#e7d7c1] bg-[#fbf3de]/55 p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-widest text-[#7a4a31]">Mate</h2><span className="text-xs font-bold text-[#5f3826]">{model.name}</span></div>
              <img src={variant.image} alt={variant.name} className="mx-auto aspect-square w-full max-w-[310px] object-contain" draggable={false} />
              <p className="text-center font-serif text-lg font-black text-[#2d1d14]">{variant.name}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e7d7c1] bg-[#fbf3de]/55 p-4">
                <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-[#7a4a31]">Virola</h2>
                <ConfiguratorPreview rim={configuration.rim} model={configuration.modelId} />
              </div>
              {model.hasFleje && (
                <div className="rounded-2xl border border-[#e7d7c1] bg-[#fbf3de]/55 p-4 sm:col-span-1">
                  <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-[#7a4a31]">Fleje: frente y dorso</h2>
                  <FlatFlejePreview flejeConfig={flejeConfig} />
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5 lg:col-span-5">
            <section className="rounded-2xl border border-[#e7d7c1] bg-[#fdf7e9] p-5">
              <div className="flex items-center justify-between border-b border-[#e7d7c1] pb-3"><h2 className="text-sm font-black uppercase tracking-wider text-[#7a4a31]">Cliente</h2><button type="button" onClick={onEditContact} className="min-h-11 px-2 text-xs font-bold text-[#7a4a31] hover:underline">Editar</button></div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-[#5f3826]/65">Nombre</dt><dd className="font-bold text-[#2d1d14]">{userData.name}</dd></div>
                <div><dt className="text-[#5f3826]/65">Email</dt><dd className="break-all font-bold text-[#2d1d14]">{userData.email}</dd></div>
                {userData.phone && <div><dt className="text-[#5f3826]/65">WhatsApp</dt><dd className="font-bold text-[#2d1d14]">{userData.phone}</dd></div>}
              </dl>
            </section>

            <section className="rounded-2xl border border-[#e7d7c1] bg-[#fdf7e9] p-5">
              <h2 className="border-b border-[#e7d7c1] pb-3 text-sm font-black uppercase tracking-wider text-[#7a4a31]">Especificaciones</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Producto</dt><dd className="text-right font-bold">{variant.name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Color</dt><dd className="font-bold">{color.name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Tamaño</dt><dd className="font-bold">{mateSizeLabels[configuration.size]}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Virola</dt><dd className="text-right font-bold">{rimMaterial?.name ?? "Original"}</dd></div>
                {configuration.rim.finishMode === "finish" && <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Terminación de virola</dt><dd className="font-bold">{rimFinish?.name}</dd></div>}
                {configuration.rim.textMode === "text" && configuration.rim.text && <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Texto de virola</dt><dd className="max-w-[60%] text-right font-bold text-[#7a4a31]">“{configuration.rim.text}”</dd></div>}
                {rimImageName && <div className="flex justify-between gap-4"><dt className="text-[#5f3826]/70">Imagen de virola</dt><dd className="max-w-[60%] truncate font-bold" title={rimImageName}>{rimImageName}</dd></div>}
                {model.hasFleje && <div className="mt-3 border-t border-[#e7d7c1] pt-3"><dt className="font-bold text-[#5f3826]">Fleje {flejeConfig.finishMode === "finish" ? `· ${flejeFinish?.name}` : "· Liso"}</dt>{(["front", "back"] as const).map((side) => { const item = flejeConfig.sides[side]; const icon = imageName(item.selectedImageId, item.customImage?.name); return <dd key={side} className="mt-2 rounded-lg bg-white/70 p-2"><strong>{side === "front" ? "Frente" : "Dorso"}:</strong> {item.text || "sin texto"}{icon ? ` · ${icon}` : ""}</dd>; })}</div>}
              </dl>
            </section>

            <section className="rounded-2xl border-2 border-emerald-600/70 bg-emerald-50 p-5">
              <div className="flex justify-between text-xs"><span>Mate base</span><strong>$ {pricing.basePriceUYU.toLocaleString("es-UY")} UYU</strong></div>
              {pricing.items.map((item) => <div key={item.id} className="mt-2 flex justify-between gap-3 text-xs"><span>{item.label}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span><strong>+ $ {item.totalUYU.toLocaleString("es-UY")} UYU</strong></div>)}
              <div className="mt-4 flex items-end justify-between border-t border-emerald-300 pt-4"><span className="text-xs font-black uppercase tracking-wider text-emerald-900">Total</span><strong className="font-serif text-2xl text-emerald-950">$ {pricing.totalUYU.toLocaleString("es-UY")} UYU</strong></div>
            </section>

            <div className="space-y-3">
              <button type="button" onClick={onProceedToCheckout} className="min-h-12 w-full rounded-xl bg-[#7a4a31] px-5 text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition-colors hover:bg-[#5f3826]">Continuar al pago</button>
              <button type="button" disabled={isDrafting} onClick={saveDraft} className="min-h-11 w-full rounded-xl border border-[#7a4a31] bg-white px-5 text-xs font-bold text-[#7a4a31] hover:bg-[#fbf3de] disabled:opacity-60">{isDrafting ? "Guardando…" : "Guardar borrador en mi perfil"}</button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
