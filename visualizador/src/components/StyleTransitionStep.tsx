interface StyleTransitionStepProps {
  onContinue: () => void;
}

export function StyleTransitionStep({ onContinue }: StyleTransitionStepProps) {
  return (
    <main id="main-content" className="brand-style-transition">
      <div>
        <h1>Ahora vamos a darle tu estilo</h1>
        <button type="button" className="brand-button" onClick={onContinue}>Siguiente</button>
      </div>
    </main>
  );
}
