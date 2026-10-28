/* ============================================================
   InspectionSheet.tsx - 6 görünümlü denetim sayfası paneli
   CADAM'deki "inspection sheet" kavramının karşılığı: model
   üretildikten sonra 6 yönden fotoğraflanır, görsel modelce
   denetlenir. Panel küçük resimleri ve denetim kararını gösterir.
   ============================================================ */

import { useState } from 'react';
import type { InspectionView } from '../core/snapshot';
import type { VisionReport } from '../ai/vision';

interface Props {
  views: InspectionView[];
  report: VisionReport | null;
}

export function InspectionSheet({ views, report }: Props) {
  const [open, setOpen] = useState(true);
  if (views.length === 0) return null;
  const badge = report ? (report.ok ? '✅ uygun' : `⚠ ${report.issues.length} sorun`) : '❓ denetim yok';
  return (
    <div className="inspection">
      <button className="meta-panel__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Denetim sayfası · 6 görünüm · {badge}
      </button>
      {open ? (
        <>
          <div className="inspection__grid">
            {views.map((v) => (
              <figure key={v.name} className="inspection__cell">
                <img src={v.dataUrl} alt={`Model görünümü: ${v.name}`} loading="lazy" />
                <figcaption>{v.name}</figcaption>
              </figure>
            ))}
          </div>
          {report && !report.ok ? (
            <ul className="inspection__issues">
              {report.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
