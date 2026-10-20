import { describe, expect, it } from 'vitest';
import { buildSliders, clampValue, defaultValues } from '../src/core/parameters';
import type { ModelIR } from '../src/core/types';

describe('buildSliders', () => {
  it('tanımlı parametrelerden kaydırıcı kurar', () => {
    const ir: ModelIR = {
      name: 'x',
      parameters: {
        cap: { value: 50, min: 10, max: 100, step: 1, desc: 'Dış çap' },
        duvar: { value: 3 }
      },
      body: []
    };
    const specs = buildSliders(ir);
    expect(specs).toHaveLength(2);
    const cap = specs.find((s) => s.name === 'cap')!;
    expect(cap.min).toBe(10);
    expect(cap.max).toBe(100);
    expect(cap.step).toBe(1);
    expect(cap.desc).toBe('Dış çap');
  });

  it('min/max yoksa value etrafında aralık açar', () => {
    const ir: ModelIR = {
      name: 'x',
      parameters: { uzunluk: { value: 80 } },
      body: []
    };
    const spec = buildSliders(ir)[0];
    expect(spec.min).toBe(40);
    expect(spec.max).toBe(120);
  });

  it('value=0 için simetrik aralık verir', () => {
    const ir: ModelIR = { name: 'x', parameters: { ofset: { value: 0 } }, body: [] };
    const spec = buildSliders(ir)[0];
    expect(spec.min).toBeLessThan(0);
    expect(spec.max).toBeGreaterThan(0);
  });

  it('geçersiz tanımları atlar', () => {
    const ir: ModelIR = {
      name: 'x',
      parameters: { kotu: { value: 'elma' as unknown as number } },
      body: []
    };
    expect(buildSliders(ir)).toHaveLength(0);
  });
});

describe('clampValue', () => {
  it('aralık dışını kırpıp adıma yuvarlar', () => {
    const spec = { name: 'a', value: 50, min: 10, max: 100, step: 1 };
    expect(clampValue(spec, 150)).toBe(100);
    expect(clampValue(spec, 5)).toBe(10);
    expect(clampValue(spec, 55.6)).toBe(56);
  });

  it('ondalık adımları korur', () => {
    const spec = { name: 'a', value: 3, min: 2, max: 6, step: 0.1 };
    expect(clampValue(spec, 4.26)).toBeCloseTo(4.3, 5);
  });
});

describe('defaultValues', () => {
  it('varsayılan değerleri sözlüğe döker', () => {
    const ir: ModelIR = {
      name: 'x',
      parameters: { a: { value: 5 }, b: { value: 7.5 } },
      body: []
    };
    expect(defaultValues(ir)).toEqual({ a: 5, b: 7.5 });
  });
});
