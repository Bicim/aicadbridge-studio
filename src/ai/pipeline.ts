/* ============================================================
   pipeline.ts - iki aşamalı üretim hattı + self-healing
   Fusion tarafındaki run_pipeline_helper'ın web karşılığı:
   Planner (niyet -> plan JSON) -> Coder (plan -> ModelIR)
   -> Executor (CSG) -> Verify (geometrik beklentiler)
   -> sorun varsa Healer (en fazla 3 deneme).
   ============================================================ */

import { chat, extractJson, type AiConfig } from './providers';
import {
  PLANNER_SYSTEM, CODER_SYSTEM, HEALER_SYSTEM,
  buildPlannerUserPrompt, buildCoderUserPrompt, buildHealerUserPrompt
} from './prompts';
import { runVisionCheck, type VisionReport } from './vision';
import type { InspectionView } from '../core/snapshot';
import { executeIR } from '../core/executor';
import { verifyExecution, type VerificationReport } from '../core/verify';
import type { LogEntry, ModelIR, Plan, Stage } from '../core/types';

export const MAX_HEAL_ATTEMPTS = 3;

export interface PipelineResult {
  plan: Plan;
  ir: ModelIR;
  verification: VerificationReport;
  attempts: number;
  logs: LogEntry[];
  /** Görsel denetim kararı; kapalıysa ya da yapılamadıysa null */
  vision: VisionReport | null;
  /** 6 görünümlü denetim sayfası (PNG data URL); görsel denetim yapıldıysa */
  inspection: InspectionView[] | null;
}

export type ProgressFn = (stage: Stage, message: string, ok?: boolean) => void;

function sanitizePlan(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') throw new Error('Planner bir JSON nesnesi döndürmedi.');
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim()) throw new Error('Plan "name" alanı eksik.');
  if (!Array.isArray(p.steps) || p.steps.length === 0) throw new Error('Plan "steps" listesi boş.');
  const steps = p.steps.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`steps[${i}] nesne değil.`);
    const step = s as Record<string, unknown>;
    if (typeof step.description !== 'string') throw new Error(`steps[${i}].description eksik.`);
    return {
      feature: typeof step.feature === 'string' ? step.feature : `adim_${i + 1}`,
      description: step.description
    };
  });
  const parameters: Record<string, { value: number; min?: number; max?: number; step?: number; desc?: string }> = {};
  if (p.parameters && typeof p.parameters === 'object') {
    for (const [name, def] of Object.entries(p.parameters as Record<string, unknown>)) {
      if (!def || typeof def !== 'object') continue;
      const d = def as Record<string, unknown>;
      if (typeof d.value !== 'number' || !Number.isFinite(d.value)) continue;
      parameters[name] = {
        value: d.value,
        min: typeof d.min === 'number' ? d.min : undefined,
        max: typeof d.max === 'number' ? d.max : undefined,
        step: typeof d.step === 'number' ? d.step : undefined,
        desc: typeof d.desc === 'string' ? d.desc : undefined
      };
    }
  }
  const exp = p.expectations as Record<string, unknown> | undefined;
  return {
    name: p.name.trim(),
    description: typeof p.description === 'string' ? p.description : undefined,
    parameters,
    steps,
    expectations: exp && typeof exp === 'object' ? {
      bbox_mm: Array.isArray(exp.bbox_mm) && exp.bbox_mm.length === 3
        ? [Number(exp.bbox_mm[0]), Number(exp.bbox_mm[1]), Number(exp.bbox_mm[2])]
        : undefined,
      min_volume_mm3: typeof exp.min_volume_mm3 === 'number' ? exp.min_volume_mm3 : undefined,
      parts: typeof exp.parts === 'number' ? exp.parts : undefined
    } : undefined
  };
}

export async function runPipeline(
  cfg: AiConfig,
  userPrompt: string,
  onProgress: ProgressFn = () => {}
): Promise<PipelineResult> {
  const logs: LogEntry[] = [];
  const progress: ProgressFn = (stage, message, ok) => {
    logs.push({ stage, message, ok });
    onProgress(stage, message, ok);
  };

  /* --- 1) Planner --- */
  progress('plan', 'Plan hazırlanıyor (Planner)...');
  const planText = await chat(cfg, {
    system: PLANNER_SYSTEM,
    messages: [{ role: 'user', content: buildPlannerUserPrompt(userPrompt) }],
    maxTokens: 4000
  });
  const plan = sanitizePlan(extractJson(planText));
  progress('plan', `Plan hazır: ${plan.name} · ${plan.steps.length} adım`, true);

  /* --- 2) Coder --- */
  progress('code', 'Geometri kodu üretiliyor (Coder)...');
  const irText = await chat(cfg, {
    system: CODER_SYSTEM,
    messages: [{ role: 'user', content: buildCoderUserPrompt(plan) }],
    maxTokens: 8000
  });
  let ir = extractJson<ModelIR>(irText);
  progress('code', 'ModelIR alındı, çalıştırılıyor...', true);

  /* --- 3) Yürüt + doğrula + onar --- */
  let attempts = 0;
  let verification: VerificationReport | null = null;
  let lastError: string | null = null;
  let vision: VisionReport | null = null;
  let inspection: InspectionView[] | null = null;

  while (attempts < MAX_HEAL_ATTEMPTS) {
    attempts++;
    vision = null; // her deneme kendi görsel denetimini üretir; eskisi asma
    inspection = null;
    try {
      progress('execute', `Geometri kuruluyor (deneme ${attempts})...`);
      const result = executeIR(ir);
      progress('verify', 'Geometrik doğrulama...');
      verification = verifyExecution(plan, result.stats);
      if (verification.ok) {
        if (cfg.vision !== false) {
          progress('verify', 'Görsel denetim (6 görünümlü denetim sayfası)...');
          try {
            const outcome = await runVisionCheck(cfg, userPrompt, plan, result.parts);
            vision = outcome.report;
            inspection = outcome.inspection;
          } catch (e) {
            // Görsel destekli model yoksa vb.: sessizce degrade et, sayısal sonucu koru
            progress('verify', `Görsel denetim atlandı: ${(e as Error).message}`, false);
          }
        }
        if (!vision || vision.ok) {
          progress('done', verification.summary + (vision ? ' · görsel denetim uygun' : ''), true);
          return { plan, ir, verification, attempts, logs, vision, inspection };
        }
        progress('heal', `Görsel denetim sorunları: ${vision.issues.length} adet`, false);
      } else {
        progress('heal', `Doğrulama sorunları: ${verification.issues.length} adet`, false);
      }
      lastError = null;
    } catch (e) {
      lastError = (e as Error).message;
      progress('heal', `Çalıştırma hatası: ${lastError}`, false);
    }

    if (attempts >= MAX_HEAL_ATTEMPTS) break;

    /* --- Healer --- */
    const problems = lastError
      ? [lastError]
      : [
          ...(verification?.issues ?? []),
          ...(vision && !vision.ok ? vision.issues.map((i) => 'Görsel denetim: ' + i) : [])
        ];
    progress('heal', `Onarım deneniyor (${attempts}/${MAX_HEAL_ATTEMPTS})...`);
    try {
      const healedText = await chat(cfg, {
        system: HEALER_SYSTEM,
        messages: [{
          role: 'user',
          content: buildHealerUserPrompt(
            ir,
            problems,
            attempts,
            `${plan.name}: ${plan.steps.map((s) => s.feature).join(', ')}`
          )
        }],
        maxTokens: 8000
      });
      ir = extractJson<ModelIR>(healedText);
    } catch (e) {
      progress('heal', `Onarım yanıtı çözümlenemedi: ${(e as Error).message}`, false);
    }
  }

  /* --- Deneler tükendi: son durumu olduğu gibi döndür --- */
  if (lastError) {
    throw new Error(`${MAX_HEAL_ATTEMPTS} deneme sonunda model kurulamadı. Son hata: ${lastError}`);
  }
  const finalResult = executeIR(ir);
  verification = verifyExecution(plan, finalResult.stats);
  progress('done', `Model ${verification.ok ? 'doğrulandı' : 'uyarılarla'} tamamlandı: ${verification.summary}`, verification.ok);
  return { plan, ir, verification, attempts, logs, vision, inspection };
}
