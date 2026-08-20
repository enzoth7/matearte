import { useRef, useState } from "react";
import { createCustomizationAsset } from "../services/customizationAsset";
import type { CustomImageAsset } from "../types/customizer";

interface CustomImageUploadProps {
  value: CustomImageAsset | null;
  onChange: (asset: CustomImageAsset | null) => void;
  onPlace?: () => void;
  isPlacing?: boolean;
}

export function CustomImageUpload({ value, onChange, onPlace, isPlacing = false }: CustomImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("loading");
    setMessage("Preparando una vista previa segura…");
    try {
      const asset = await createCustomizationAsset(file);
      onChange(asset);
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo procesar el archivo.");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[#cdb79d] bg-[#fbf3de]/60 p-3">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="custom-image-upload__layout">
        {value ? (
          <img src={value.previewUrl} alt="Vista previa del archivo cargado" className="h-12 w-12 rounded-lg border border-[#e7d7c1] bg-white object-contain p-1" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#e7d7c1] bg-white text-[#7a4a31]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[#2d1d14]">{value?.name ?? "Cargá tu imagen"}</p>
          <p className="text-[10px] text-[#5f3826]/70">PNG, JPG o SVG · máximo 5 MB</p>
        </div>
        <div className="custom-image-upload__actions">
          <button
            type="button"
            disabled={status === "loading"}
            onClick={() => inputRef.current?.click()}
            className="min-h-11 rounded-lg border border-[#7a4a31] bg-white px-3 text-xs font-bold text-[#7a4a31] transition-colors hover:bg-[#fbf3de] disabled:cursor-wait disabled:opacity-60"
          >
            {status === "loading" ? "Procesando…" : value ? "Cambiar" : "Elegir"}
          </button>
          {value && (
            <>
              <button type="button" onClick={() => { setMessage(""); onChange(null); }} className="custom-image-upload__remove">
                Quitar archivo cargado
              </button>
              {onPlace && (
                <button
                  type="button"
                  onClick={onPlace}
                  aria-pressed={isPlacing}
                  className="custom-image-upload__place"
                >
                  Ubicar en el visualizador
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {message && <p role={status === "error" ? "alert" : "status"} className={`mt-2 text-[10px] font-medium ${status === "error" ? "text-red-700" : "text-[#5f3826]/80"}`}>{message}</p>}
    </div>
  );
}
