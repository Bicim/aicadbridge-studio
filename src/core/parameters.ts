/* ============================================================
   parameters.ts - kaydırıcı paneli için parametre hazırlığı
   ModelIR.parameters -> slider özellikleri + değer doğrulama.
   CADAM Customizer sözdiziminin (// [10:1:200]) rolünü bizde
   Planner'ın ürettiği parametre tanımları üstlenir.
   ============================================================ */

import type { ModelIR, ParameterDef } from './types';

export interface SliderSpec {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  desc?: string;
}

const DEFAULT_SLIDER_RANGE = 0.5; // min/max yoksa value ± %50
const MAX_SAFE_RANGE = 10000;

export function buildSliders(ir: ModelIR): SliderSpec[] {
  const specs: SliderSpec[] = [];
  for (const [name, defRaw] of Object.entries(ir.parameters ?? {})) {
    const def = defRaw as ParameterDef;
    if (!def || typeof def.value !== 'number' || !Number.isFinite(def.value)) continue;
    let { min, max } = def;
    if (min === undefined || !Number.isFinite(min)) min = def.value * (1 - DEFAULT_SLIDER_RANGE);
    if (max === undefined || !Number.isFinite(max)) max = def.value * (1 + DEFAULT_SLIDER_RANGE);
    if (def.value === 0) { min = -50; max = 50; }
    if (min > max) { const t = min; min = max; max = t; }
    if (max - min > MAX_SAFE_RANGE * 2) max = min + MAX_SAFE_RANGE * 2;
    let step = def.step;
    if (step === undefined || !Number.isFinite(step) || step <= 0) {
      const span = max - min;
      step = span > 200 ? 1 : span > 20 ? 0.5 : span > 2 ? 0.1 : 0.01;
    }
    specs.push({ name, value: def.value, min, max, step, desc: def.desc });
  }
  return specs;
}

/** Kullanıcının slider değerini güvenli aralıkta tutar. */
export function clampValue(spec: SliderSpec, value: number): number {
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  const snapped = Math.round(clamped / spec.step) * spec.step;
  return Math.round(snapped * 1e6) / 1e6;
}

/** IR'ın varsayılan değerlerinden parametre sözlüğü kurar. */
export function defaultValues(ir: ModelIR): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, def] of Object.entries(ir.parameters ?? {})) {
    if (def && typeof def.value === 'number') out[name] = def.value;
  }
  return out;
}
