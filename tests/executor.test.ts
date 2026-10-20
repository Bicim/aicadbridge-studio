import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { executeIR } from '../src/core/executor';
import { meshVolume } from '../src/core/volume';
import type { ModelIR } from '../src/core/types';

function bboxOf(ir: ModelIR): [number, number, number] {
  const result = executeIR(ir);
  const box = new THREE.Box3();
  for (const part of result.parts) box.expandByObject(new THREE.Mesh(part.geometry));
  const size = new THREE.Vector3();
  box.getSize(size);
  return [size.x, size.y, size.z];
}

describe('executor', () => {
  it('silindir hacmi formüle yakın (pi * r^2 * h)', () => {
    const result = executeIR({
      name: 'silindir',
      parameters: {},
      body: [{ op: 'cylinder', radius: 10, height: 20, segments: 96 }]
    });
    const expected = Math.PI * 100 * 20;
    expect(Math.abs(meshVolume(result.parts[0].geometry))).toBeGreaterThan(expected * 0.97);
    expect(Math.abs(meshVolume(result.parts[0].geometry))).toBeLessThan(expected * 1.03);
    expect(result.stats.bbox).toEqual([20, 20, 20]);
  });

  it('difference içi boş silindir üretir', () => {
    const result = executeIR({
      name: 'boru',
      parameters: {},
      body: [{
        op: 'difference',
        children: [
          { op: 'cylinder', radius: 10, height: 20, segments: 64 },
          { op: 'cylinder', radius: 8, height: 30, segments: 64 }
        ]
      }]
    });
    const expected = Math.PI * (100 - 64) * 20; // ~2262 mm^3
    expect(result.stats.volume).toBeGreaterThan(expected * 0.9);
    expect(result.stats.volume).toBeLessThan(expected * 1.1);
  });

  it('pattern_circular delik çemberi hacmi düşürür', () => {
    const plate: ModelIR = {
      name: 'plaka',
      parameters: { delik_cap: { value: 10 } },
      body: [
        {
          op: 'difference',
          children: [
            { op: 'box', size: [100, 10, 100] },
            {
              op: 'pattern_circular',
              count: 4,
              radius: 35,
              axis: 'y',
              children: [{ op: 'cylinder', radius: 'delik_cap / 2', height: 30, segments: 32 }]
            }
          ]
        }
      ]
    };
    const result = executeIR(plate);
    const removed = 4 * Math.PI * 25 * 10; // 4 delik * pi*r^2*h
    expect(result.stats.volume).toBeLessThan(100000 - removed * 0.85);
    expect(result.stats.volume).toBeGreaterThan(100000 - removed * 1.15);
  });

  it('ifade parametreleri çözülür (cap/2)', () => {
    const ir: ModelIR = {
      name: 'ifade',
      parameters: { cap: { value: 20 }, yukseklik: { value: 30 } },
      body: [{ op: 'cylinder', radius: 'cap / 2', height: 'yukseklik', segments: 64 }]
    };
    const result = executeIR(ir);
    expect(result.stats.bbox[0]).toBeCloseTo(20, 0);
    expect(result.stats.bbox[1]).toBeCloseTo(30, 0);
  });

  it('translate konumu kaydırır', () => {
    const ir: ModelIR = {
      name: 'kaydir',
      parameters: {},
      body: [{ op: 'translate', offset: [20, 0, 0], children: [{ op: 'box', size: [10, 10, 10] }] }]
    };
    const result = executeIR(ir);
    const geom = result.parts[0].geometry;
    geom.computeBoundingBox();
    expect(geom.boundingBox!.min.x).toBeCloseTo(15, 5);
    expect(geom.boundingBox!.max.x).toBeCloseTo(25, 5);
  });

  it('kök color düğümü parçayı renklendirir', () => {
    const result = executeIR({
      name: 'renkli',
      parameters: {},
      body: [{ op: 'color', color: '#ff0000', children: [{ op: 'box', size: [10, 10, 10] }] }]
    });
    expect(result.parts[0].color).toBe('#ff0000');
    expect(result.stats.parts).toBe(1);
  });

  it('override değerleri uygular', () => {
    const ir: ModelIR = {
      name: 'param',
      parameters: { cap: { value: 20 } },
      body: [{ op: 'cylinder', radius: 'cap / 2', height: 10, segments: 48 }]
    };
    const result = executeIR(ir, { overrides: { cap: 40 } });
    expect(result.stats.bbox[0]).toBeCloseTo(40, 0);
  });

  it('boş body açıklayıcı hata verir', () => {
    expect(() => executeIR({ name: 'bos', parameters: {}, body: [] })).toThrow(/body/);
  });

  it('sıfır boyutlu box hata verir', () => {
    expect(() =>
      executeIR({ name: 'sifir', parameters: {}, body: [{ op: 'box', size: [0, 10, 10] }] })
    ).toThrow(/pozitif/);
  });

  it('torus için tube < radius zorunlu', () => {
    expect(() =>
      executeIR({ name: 'hatali', parameters: {}, body: [{ op: 'torus', radius: 5, tube: 10 }] })
    ).toThrow(/torus/);
  });

  it('bbox yardımcısı üç ekseni ölçer', () => {
    const [x, y, z] = bboxOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [30, 10, 20] }] });
    expect(x).toBeCloseTo(30, 0);
    expect(y).toBeCloseTo(10, 0);
    expect(z).toBeCloseTo(20, 0);
  });
});
