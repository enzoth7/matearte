import type { WizardStep } from '../types/user';

interface StepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

const steps: { id: WizardStep; label: string; number: number }[] = [
  { id: 'welcome', label: 'Tus Datos', number: 1 },
  { id: 'customizer', label: 'Personalización', number: 2 },
  { id: 'summary', label: 'Resumen & Enviar', number: 3 },
];

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const getStepIndex = (step: WizardStep) => {
    switch (step) {
      case 'welcome': return 0;
      case 'customizer': return 1;
      case 'summary':
      case 'success': return 2;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full max-w-xl mx-auto py-2 px-4">
      <div className="relative flex items-start justify-between">
        {/* Line Behind Steps aligned exactly to the vertical center of the 36px (h-9) circle buttons (18px) */}
        <div className="absolute top-[18px] left-6 right-6 -translate-y-1/2 h-0.5 bg-[#e7d7c1] -z-0" />
        <div 
          className="absolute top-[18px] left-6 -translate-y-1/2 h-0.5 bg-[#7a4a31] transition-all duration-500 -z-0"
          style={{ width: `calc(${((currentIndex / (steps.length - 1)) * 100)}% - ${currentIndex === (steps.length - 1) ? 0 : 24}px)` }}
        />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isClickable = idx < currentIndex && onStepClick;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(step.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-[#7a4a31] text-white shadow-md ring-4 ring-[#7a4a31]/20 scale-110'
                    : isCompleted
                    ? 'bg-[#5f3826] text-white cursor-pointer hover:bg-[#7a4a31]'
                    : 'bg-[#fbf3de] text-[#7a4a31]/50 border border-[#e7d7c1]'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </button>
              <span
                className={`mt-1.5 text-[11px] font-semibold transition-colors ${
                  isCurrent ? 'text-[#2d1d14]' : isCompleted ? 'text-[#5f3826]' : 'text-[#a48e78]'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
