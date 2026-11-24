/* Giriş sayfasının teknik çizimi: Ø100 flanş (Ø35 delik, 6 × Ø6.6 cıvata). Ölçek 3 px/mm. Renkler token'lardan (cloud.css .c-art-*). */
const HOLES = [90, 150, 210, 270, 330, 30].map((a) => [200 + 120 * Math.cos((a * Math.PI) / 180), 200 - 120 * Math.sin((a * Math.PI) / 180)] as const);

export function LoginArt() {
  return (
    <svg viewBox="0 0 400 400" role="presentation" focusable="false">
      <path className="c-art-axis" d="M35 200H365M200 35V365" />
      <circle className="c-art-bolt" cx="200" cy="200" r="120" />
      <circle className="c-art-geo draw" pathLength="1" cx="200" cy="200" r="150" />
      <circle className="c-art-geo draw" pathLength="1" cx="200" cy="200" r="52.5" />
      {HOLES.map(([x, y]) => <circle key={`${x}${y}`} className="c-art-geo draw" pathLength="1" cx={x.toFixed(1)} cy={y.toFixed(1)} r="9.9" />)}
      <g className="c-art-dim">
        <path d="M50 204V378M350 204V378M50 372H350" />
        <polygon points="50,372 58,369 58,375" />
        <polygon points="350,372 342,369 342,375" />
        <rect x="172" y="351" width="56" height="20" rx="4" />
        <text x="200" y="366" textAnchor="middle">Ø100</text>
        <path d="M237.1 162.9L330 70H372" />
        <rect x="330" y="53" width="42" height="17" rx="4" />
        <text x="351" y="66" textAnchor="middle">Ø35</text>
        <path d="M310.9 133L326 112H396" />
        <rect x="330" y="95" width="66" height="17" rx="4" />
        <text x="363" y="108" textAnchor="middle">6 × Ø6.6</text>
      </g>
    </svg>
  );
}
