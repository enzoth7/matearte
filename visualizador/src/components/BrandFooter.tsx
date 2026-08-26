interface BrandFooterProps {
  onProfile?: () => void;
}

export function BrandFooter({ onProfile }: BrandFooterProps) {
  return (
    <footer className="brand-footer">
      <button type="button" className="brand-footer__mark" aria-label="Abrir mi perfil" onClick={onProfile}>
        <img src="/assets/marca/LogoOriginal.jpg" alt="" width="76" height="76" />
      </button>
      <div className="brand-footer__signature">
        <strong>ARTE &amp; TRADICIÓN</strong>
        <small>© 2026 Matearte</small>
      </div>
      <div className="brand-footer__institutions">
        <img src="/assets/marca/UruguayLSQA.png" alt="Uruguay LSQA" width="414" height="189" loading="lazy" />
      </div>
    </footer>
  );
}
