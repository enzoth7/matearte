interface CustomizerIntroStepProps {
  onStart: () => void;
}

export function CustomizerIntroStep({ onStart }: CustomizerIntroStepProps) {
  return (
    <main id="main-content" className="brand-intro">
      <div>
        <h1>Bienvenido al customizador de Matearte</h1>
        <button type="button" onClick={onStart} className="brand-button">Comenzar</button>
      </div>
    </main>
  );
}
