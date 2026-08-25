interface BrandFooterProps {
  onProfile?: () => void;
}

export function BrandFooter({ onProfile }: BrandFooterProps) {
  return (
    <footer className="brand-footer">
      <button type="button" className="brand-footer__mark" aria-label="Abrir mi perfil" onClick={onProfile}>
        <img src="/assets/marca/logo.jpg" alt="" />
      </button>
      <div className="brand-footer__signature">
        <strong>ARTE &amp; TRADICIÓN</strong>
        <small>© 2026 Matearte</small>
      </div>
    </footer>
  );
}
