export function NumberingIllustration() {
  return (
    <svg
      viewBox="0 0 180 118"
      className="mx-auto h-24 w-36"
      role="img"
      aria-label="Illustration de numérotation de document"
    >
      <defs>
        <linearGradient id="document-number-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="text-primary" stopColor="currentColor" />
          <stop offset="1" className="text-primary/70" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <g transform="rotate(-9 90 59)">
        <rect x="57" y="18" width="68" height="78" rx="8" className="fill-primary/15" />
        <rect x="51" y="12" width="68" height="78" rx="8" fill="url(#document-number-gradient)" />
        <text x="67" y="34" fill="white" fontSize="9" fontWeight="700">
          DOCUMENT
        </text>
        <rect x="62" y="46" width="48" height="28" rx="4" className="fill-warning" />
        <rect x="66" y="51" width="12" height="17" rx="2" className="fill-surface" />
        <rect x="81" y="51" width="12" height="17" rx="2" className="fill-surface" />
        <rect x="96" y="51" width="10" height="17" rx="2" className="fill-surface" />
        <text x="69" y="64" className="fill-foreground" fontSize="11" fontWeight="800">
          0
        </text>
        <text x="84" y="64" className="fill-foreground" fontSize="11" fontWeight="800">
          0
        </text>
        <text x="98" y="64" className="fill-foreground" fontSize="11" fontWeight="800">
          ?
        </text>
      </g>
      <path
        d="M31 69l-12 6M146 60l15 1M135 29l8-10M37 34l-7-7"
        className="stroke-warning"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="139" cy="83" r="5" className="fill-error" />
    </svg>
  );
}
