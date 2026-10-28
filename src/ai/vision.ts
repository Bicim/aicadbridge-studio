/* ============================================================
   vision.ts - görsel doğrulama orkestrasyonu
   ------------------------------------------------------------
   Modeli 6 yönden render eder (denetim sayfası), görüntüleri
   görsel destekli modele gönderir, yapılandırılmış uygunluk
   kararı ({ok, issues}) çıkarır. CADAM analizindeki P1
   "browser-taraflı görsel doğrulama döngüsü"nün karşılığı:
   bulgular Healer'a metin olarak geri verilir.
   ============================================================ */

import { chat, extractJson, type AiConfig } from './providers';
import { VISION_SYSTEM, buildVisionUserPrompt } from './prompts';
import { renderInspectionSheet, type InspectionView } from '../core/snapshot';
import type { ExecutedPart, Plan } from '../core/types';

export interface VisionReport {
  ok: boolean;
  issues: string[];
}

export interface VisionOutcome {
  report: VisionReport;
  inspection: InspectionView[];
}

/** Model yanıtından yapılandırılmış denetim kararı çıkarır (saf işlev). */
export function parseVisionReport(raw: unknown): VisionReport {
  if (!raw || typeof raw !== 'object') throw new Error('Görsel denetim yanıtı JSON nesnesi değil.');
  const p = raw as Record<string, unknown>;
  const issues = Array.isArray(p.issues)
    ? p.issues.filter((i): i is string => typeof i === 'string' && i.trim().length > 0).map((i) => i.trim()).slice(0, 5)
    : [];
  return {
    ok: p.ok === true && issues.length === 0,
    issues
  };
}

/** Modeli render eder, görüntülerle denetim yapar. Yalnız tarayıcıda. */
export async function runVisionCheck(
  cfg: AiConfig,
  userPrompt: string,
  plan: Plan,
  parts: ExecutedPart[]
): Promise<VisionOutcome> {
  const inspection = renderInspectionSheet(parts);
  const text = await chat(cfg, {
    system: VISION_SYSTEM,
    messages: [{
      role: 'user',
      content: buildVisionUserPrompt(userPrompt, plan.name, plan.steps.map((s) => s.description)),
      images: inspection.map((v) => v.dataUrl)
    }],
    maxTokens: 1500
  });
  return { report: parseVisionReport(extractJson(text)), inspection };
}
