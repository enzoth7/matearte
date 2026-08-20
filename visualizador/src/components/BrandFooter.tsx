import approvedFooter from "../../Pantallas/2.png";

interface BrandFooterProps {
  onProfile?: () => void;
}

export function BrandFooter({ onProfile }: BrandFooterProps) {
  return (
    <footer className="brand-footer">
      <button type="button" className="brand-footer__mark" aria-label="Abrir mi perfil" onClick={onProfile}>
        <img src="/logoma.jpg" alt="" />
      </button>
      <div className="brand-footer__signature">
        <strong>ARTE &amp; TRADICIÓN</strong>
        <small>© 2026 Matearte</small>
      </div>
      <div className="brand-footer__institutions" role="img" aria-label="Uruguay y LSQA">
        <img src={approvedFooter} alt="" aria-hidden="true" />
      </div>
    </footer>
  );
}
