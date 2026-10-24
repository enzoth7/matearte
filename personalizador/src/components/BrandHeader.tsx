import type { WizardStep } from "../types/user";
import { StepIndicator } from "./StepIndicator";

type IndicatorPhase = "virola" | "fleje";

interface BrandHeaderProps {
  currentStep: WizardStep;
  hasFleje?: boolean;
  customizationPhase?: "mate" | IndicatorPhase | null;
  onStepClick?: (step: WizardStep, phase?: IndicatorPhase) => void;
}

const mainSiteUrl = (import.meta.env.VITE_MAIN_SITE_URL || "http://localhost:3000")
  .trim()
  .replace(/\/$/, "");

export function BrandHeader({ currentStep, hasFleje = false, customizationPhase, onStepClick }: BrandHeaderProps) {
  return (
    <header className="brand-header">
      <a className="brand-header__home" href={mainSiteUrl} aria-label="Volver al sitio de MateArte">
        <img src="/assets/marca/LogoOriginal.jpg" alt="" width="48" height="48" />
        <span className="brand-header__wordmark">
          <strong>MateArte</strong>
          <small>Arte &amp; Tradición</small>
        </span>
      </a>

      <StepIndicator
        currentStep={currentStep}
        hasFleje={hasFleje}
        customizationPhase={customizationPhase}
        onStepClick={onStepClick}
      />
    </header>
  );
}
