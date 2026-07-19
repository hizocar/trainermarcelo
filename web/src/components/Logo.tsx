export function Dumbbell({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="#C8FF00" transform="rotate(45 32 32)">
        <rect x="14" y="29.4" width="36" height="5.2" rx="2.6" />
        <rect x="17.8" y="19.8" width="6.6" height="24.4" rx="3.3" />
        <rect x="39.6" y="19.8" width="6.6" height="24.4" rx="3.3" />
        <rect x="12.4" y="23.3" width="5.4" height="17.4" rx="2.7" />
        <rect x="46.2" y="23.3" width="5.4" height="17.4" rx="2.7" />
      </g>
    </svg>
  );
}

/** Wordmark EliteFit: mancuerna + ELITE blanco / FIT lima. Usar dentro de .brand */
export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <>
      <Dumbbell size={size} />
      <span>
        ELITE<span className="accent">FIT</span>
      </span>
    </>
  );
}
