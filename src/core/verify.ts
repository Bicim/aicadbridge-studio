/* ============================================================
   verify.ts - geometrik doğrulama
   Plan'ın beklentileri (bbox, hacim, parça sayısı) ile yürütme
   istatistiklerini karşılaştırır. CADAM'deki "çok görünümlü
   denetim"in web-MVP karşılığı: görsel yerine sayısal kanıt.
   Bulgular Self-Healing'e metin olarak gider.
   ============================================================ */

import type { ExecStats, Plan } from './types';

/** Boyut toleransı: beklentinin bu oranı içinde kabul. */
const DIM_TOLERANCE = 0.2; // %20
const VOLUME_TOLERANCE = 0.35; // %35 (CSG üçgenlemesi hacmi biraz oynatır)

export interface VerificationReport {
  ok: boolean;
  issues: string[];
  summary: string;
}

export function verifyExecution(plan: Plan, stats: ExecStats): VerificationReport {
  const issues: string[] = [];
  const exp = plan.expectations;

  if (exp?.bbox_mm) {
    const [ex, ey, ez] = exp.bbox_mm;
    const dims: Array<[number, number, string]> = [
      [stats.bbox[0], ex, 'x'],
      [stats.bbox[1], ey, 'y'],
      [stats.bbox[2], ez, 'z']
    ];
    for (const [actual, expected, axis] of dims) {
      if (expected > 0 && Math.abs(actual - expected) > expected * DIM_TOLERANCE) {
        issues.push(
          `${axis} boyutu beklenenle uyuşmuyor: beklenen ~${expected} mm, ölçülen ${actual.toFixed(1)} mm.`
        );
      }
    }
  }
  if (exp?.min_volume_mm3 !== undefined && stats.volume < exp.min_volume_mm3 * (1 - VOLUME_TOLERANCE)) {
    issues.push(
      `Hacim beklenenin çok altında: beklenen en az ~${exp.min_volume_mm3} mm³, ölçülen ${Math.round(stats.volume)} mm³. ` +
      `Model boş ya da eksik olabilir (delikler çok büyük / difference sırası yanlış olabilir).`
    );
  }
  if (exp?.parts !== undefined && stats.parts !== exp.parts) {
    issues.push(`Parça sayısı farklı: beklenen ${exp.parts}, ölçülen ${stats.parts}.`);
  }
  if (stats.triangles < 12) {
    issues.push('Model neredeyse boş: çok az üçgen üretildi.');
  }

  const summary =
    `Ölçüler ${stats.bbox.map((d) => d.toFixed(0)).join(' × ')} mm · ` +
    `hacim ${Math.round(stats.volume).toLocaleString('tr-TR')} mm³ · ` +
    `${stats.triangles.toLocaleString('tr-TR')} üçgen · ${stats.parts} parça`;

  return { ok: issues.length === 0, issues, summary };
}
