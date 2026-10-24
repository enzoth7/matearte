interface PersonalizerIntroStepProps {
  onStart: () => void;
}

export function PersonalizerIntroStep({ onStart }: PersonalizerIntroStepProps) {
  return (
    <main id="main-content" className="brand-intro">
      <div className="brand-intro__layout">
        <div className="brand-intro__copy">
          <h1>Diseñá un mate que hable de vos</h1>
          <button type="button" onClick={onStart} className="brand-button brand-button--pill">
            Empezar a diseñar
          </button>
        </div>
        <figure className="brand-intro__media">
          <img
            src="/assets/personalizador/bienvenida-mates.png"
            alt="Selección de mates artesanales de MateArte"
            width="1346"
            height="1560"
          />
        </figure>
      </div>
    </main>
  );
}
