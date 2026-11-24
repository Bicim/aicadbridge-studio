/* AICADBridge işareti (kendi logomuz): halka + merkez nokta, vurgu renginde. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="8.2" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.2" />
      <circle cx="12" cy="12" r="2.7" style={{ fill: 'var(--accent)' }} />
    </svg>
  );
}
