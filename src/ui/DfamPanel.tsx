/* ============================================================
   DfamPanel.tsx - üretilebilirlik (DfAM) denetim paneli
   ------------------------------------------------------------
   earthtojake/text-to-cad (MIT) DfAM sisteminin studio karşılığı:
   süreç seç -> ölçülen gerçekleri limitlerle karşılaştır ->
   kanıt destekli bulgular (✅/❌/❓) + yeniden tasarım talimatı.
   Bulgular "AI'ya gönder" ile Self-Healing akışına geri verir
   (Redesign Handoff).
   ============================================================ */

import { useState } from 'react';
import { PROCESS_LIMITS, type DfamReport, type ProcessId } from '../core/dfam';

interface Props {
  report: DfamReport | null;
  busy: boolean;
  hasModel: boolean;
  onRun: (process: ProcessId) => void;
  onSend: () => void;
}

const STATUS_ICON: Record<string, string> = { pass: '✅', fail: '❌', info: '❓' };

export function DfamPanel({ report, busy, hasModel, onRun, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [process, setProcess] = useState<ProcessId>('fdm');
  const canSend = report !== null && report.fail_count > 0 && !busy;

  return (
    <div className="dfam">
      <div className="dfam__head">
        <button className="dfam__toggle" onClick={() => setOpen((v) => !v)} disabled={!hasModel}>
          {open ? '▾' : '▸'} Üretilebilirlik (DfAM)
          {report ? <span className={`dfam__badge dfam__badge--${report.fail_count > 0 ? 'bad' : 'ok'}`}>
            {report.fail_count > 0 ? `${report.fail_count} hata` : 'temiz'}
          </span> : null}
        </button>
        {open && hasModel ? (
          <div className="dfam__controls">
            <select
              className="dfam__select"
              value={process}
              onChange={(e) => setProcess(e.target.value as ProcessId)}
              aria-label="Üretim süreci"
            >
              {Object.values(PROCESS_LIMITS).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button className="btn btn--ghost btn--sm" onClick={() => onRun(process)} disabled={busy}>
              {busy ? 'ölçülüyor...' : 'Analiz et'}
            </button>
            {canSend ? (
              <button className="btn btn--primary btn--sm" onClick={onSend}>AI'ya gönder</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {open && report ? (
        <div className="dfam__body">
          {report.partial ? (
            <div className="dfam__partial">
              Kısmi rapor ({report.partial_sections.join(', ')}): ölçülmemiş gerçek sıfır anlamına gelmez.
            </div>
          ) : null}
          {report.findings.map((f) => (
            <div key={f.id} className={`finding finding--${f.status}`}>
              <div className="finding__head">
                <span className="finding__icon" aria-hidden="true">{STATUS_ICON[f.status]}</span>
                <span className="finding__title">{f.title}</span>
              </div>
              <div className="finding__detail">{f.detail}</div>
              {f.redesign ? <div className="finding__redesign">↻ {f.redesign}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {open && !report && !busy && hasModel ? (
        <div className="dfam__body dfam__hint">
          Analiz et'e bas: model ölçülür, {PROCESS_LIMITS[process].label} limitleriyle karşılaştırılır.
        </div>
      ) : null}
    </div>
  );
}
