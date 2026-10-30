export default function Brand({ compact = false }) {
  return (
    <div
      className={`brand${compact ? " brand-compact" : ""}`}
      role="img"
      aria-label="Synergy"
    >
      <span className="brand-symbol" aria-hidden="true">
        <img src="/brand/synergy-logo.svg" alt="" draggable="false" />
      </span>
      <div aria-hidden="true">
        <span className="brand-name">Synergy</span>
      </div>
    </div>
  );
}
