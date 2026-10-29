export default function Brand({ compact = false, monochrome = false }) {
  return (
    <div
      className={`brand${compact ? " brand-compact" : ""}${monochrome ? " brand-monochrome" : ""}`}
    >
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 48 56" fill="none" focusable="false">
          <g transform="translate(6 4)">
            <path
              d="M29 2C29 15 6 13 6 29c0 5 3 8 6 10 0-12 23-12 23-27 0-4-2-8-6-10Z"
              fill="var(--brand-ribbon, #24866b)"
            />
            <path
              d="M7 46C7 33 30 35 30 19c0-5-3-8-6-10 0 12-23 12-23 27 0 4 2 8 6 10Z"
              fill="var(--brand-link, #a5cf65)"
            />
          </g>
        </svg>
      </span>
      <div>
        <span className="brand-name">synergy</span>
      </div>
    </div>
  );
}
