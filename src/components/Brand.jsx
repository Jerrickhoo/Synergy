export default function Brand({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 36 48" fill="none">
          <path
            d="M29 2C29 15 6 13 6 29c0 5 3 8 6 10 0-12 23-12 23-27 0-4-2-8-6-10Z"
            fill="#48C3A4"
          />
          <path
            d="M7 46C7 33 30 35 30 19c0-5-3-8-6-10 0 12-23 12-23 27 0 4 2 8 6 10Z"
            fill="#B4E956"
          />
        </svg>
      </span>
      <div>
        <span className="brand-name">synergy</span>
        {!compact && <span className="brand-note">GOOD THINGS, TOGETHER</span>}
      </div>
    </div>
  );
}
