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
    { key: "virola", id: "customizer", label: "VIROLA", phase: "virola" },
    ...(hasFleje ? [{ key: "fleje", id: "customizer" as WizardStep, label: "FLEJE", phase: "fleje" as IndicatorPhase }] : []),
    { key: "summary", id: "summary", label: "RESUMEN" },
  ];

  const currentIndex = currentStep === "customizer"
    ? hasFleje && customizationPhase === "fleje" ? 2 : 1
    : currentStep === "summary" || currentStep === "checkout" || currentStep === "success"
      ? steps.length - 1
      : 0;

  return (
    <nav className="brand-progress" aria-label="Progreso del personalizador">
      <ol>
        {steps.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const clickable = completed && Boolean(onStepClick);
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.id, step.phase)}
                aria-current={current ? "step" : undefined}
                className={current ? "is-current" : completed ? "is-complete" : ""}
              >
                {index + 1}. {step.label}
              </button>
              {index < steps.length - 1 && <span aria-hidden="true">⟶</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
