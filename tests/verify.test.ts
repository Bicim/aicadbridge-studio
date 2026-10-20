import { describe, expect, it } from 'vitest';
import { verifyExecution } from '../src/core/verify';
import type { ExecStats, Plan } from '../src/core/types';

const plan: Plan = {
  name: 'test',
  parameters: {},
  steps: [{ feature: 'govde', description: 'test' }],
  expectations: { bbox_mm: [50, 50, 80], min_volume_mm3: 50000, parts: 1 }
};

function stats(bbox: [number, number, number], volume = 60000, triangles = 500, parts = 1): ExecStats {
  return { bbox, volume, triangles, parts };
}

describe('verifyExecution', () => {
  it('beklentilere uyan model geçer', () => {
    const report = verifyExecution(plan, stats([50, 51, 79]));
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.summary).toContain('50');
  });

  it('sapmalı boyut sorun üretir', () => {
    const report = verifyExecution(plan, stats([50, 20, 79]));
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes('y boyutu'))).toBe(true);
  });

  it('çok düşük hacim sorun üretir', () => {
    const report = verifyExecution(plan, stats([50, 50, 80], 100));
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.toLowerCase().includes('hacim'))).toBe(true);
  });

  it('parça sayısı farkı sorun üretir', () => {
    const report = verifyExecution(plan, stats([50, 50, 80], 60000, 500, 3));
    expect(report.issues.some((i) => i.includes('Parça sayısı'))).toBe(true);
  });

  it('tolerans içinde küçük sapma geçer (%20 boyut)', () => {
    const report = verifyExecution(plan, stats([50, 58, 80]));
    expect(report.issues.some((i) => i.includes('y boyutu'))).toBe(false);
  });

  it('beklenti yoksa temel kontroller yeter', () => {
    const bare: Plan = { name: 'x', parameters: {}, steps: [{ feature: 'a', description: 'b' }] };
    const report = verifyExecution(bare, stats([10, 10, 10], 1000));
    expect(report.ok).toBe(true);
  });
});
