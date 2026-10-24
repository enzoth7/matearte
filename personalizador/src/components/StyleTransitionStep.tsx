interface StyleTransitionStepProps {
  onContinue: () => void;
}

export function StyleTransitionStep({ onContinue }: StyleTransitionStepProps) {
  return (
    <main id="main-content" className="brand-style-transition">
      <div>
        <h1>Tu mate ya tiene forma. Ahora dale una voz.</h1>
        <button type="button" className="brand-button" onClick={onContinue}>Ir al editor</button>
      </div>
    </main>
  );
}
