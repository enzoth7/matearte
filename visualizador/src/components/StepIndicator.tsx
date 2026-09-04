import type { WizardStep } from "../types/user";

type IndicatorPhase = "virola" | "fleje";

interface StepIndicatorProps {
  currentStep: WizardStep;
  hasFleje?: boolean;
  customizationPhase?: "mate" | IndicatorPhase | null;
  onStepClick?: (step: WizardStep, phase?: IndicatorPhase) => void;
}

interface IndicatorStep {
  key: string;
  id: WizardStep;
  label: string;
  phase?: IndicatorPhase;
}

export function StepIndicator({ currentStep, hasFleje = false, customizationPhase, onStepClick }: StepIndicatorProps) {
  const steps: IndicatorStep[] = [
    { key: "mate", id: "product_selection", label: "ELEGÍ TU MATE" },
    { key: "personalize", id: "customizer", label: "PERSONALIZÁ", phase: "virola" },
    { key: "create", id: "customizer", label: "CREÁ TU DISEÑO", phase: hasFleje ? "fleje" : "virola" },
    { key: "summary", id: "summary", label: "REVISÁ" },
  ];

  const currentIndex = currentStep === "customizer"
    ? customizationPhase === "fleje" ? 2 : 1
    : currentStep === "summary" || currentStep === "checkout" || currentStep === "success"
      ? 3
      : 0;

  return (
    <nav className="brand-progress" aria-label="Progreso del personalizador">
      <ol className="brand-progress__labels">
        {steps.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const clickable = Boolean(onStepClick);
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.id, step.phase)}
                aria-current={current ? "step" : undefined}
                className={current ? "is-current" : completed ? "is-complete" : ""}
              >
                <strong>{String(index + 1).padStart(2, "0")} · </strong>
                <span>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="brand-progress__segments" aria-hidden="true">
        {steps.map((step, index) => (
          <span
            key={step.key}
            className={index === currentIndex ? "is-current" : index < currentIndex ? "is-complete" : ""}
          />
        ))}
      </div>
    </nav>
  );
}
