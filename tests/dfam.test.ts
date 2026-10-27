/* ============================================================
   dfam.test.ts - DfAM ölçüm ve değerlendirme motoru testleri
   text-to-cad (MIT) dfam_tool.py portunun tarayıcı davranışı:
   tabla, aşırı açı, duvar kalınlığı, destek hacmi, yön adayları,
   süreç limiti karşılaştırması ve 3MF belge üretimi.
   ============================================================ */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { executeIR } from '../src/core/executor';
import { build3mfDocuments } from '../src/core/export';
import {
  analyzeDfam, meshFacts, orientationFacts, overhangFacts, scaleHint,
  supportVolume, wallThickness, dfamRedesignPrompt, PROCESS_LIMITS
} from '../src/core/dfam';
import type { ExecutedPart, ModelIR } from '../src/core/types';

function partsOf(ir: ModelIR): ExecutedPart[] {
  return executeIR(ir).parts;
}

/** Masa: dikayak + üstte plaka (aşırı açı üretir). Bacak plakaya
 *  hacimsel olarak girer (tam temas eden yüzey yerine sağlam CSG). */
function tableIr(): ModelIR {
  return {
    name: 'masa',
    parameters: {},
    body: [
      {
        op: 'union',
        children: [
          { op: 'box', size: [10, 24, 10] },
          { op: 'translate', offset: [0, 11, 0], children: [{ op: 'box', size: [30, 4, 30] }] }
        ]
      }
    ]
  };
}

describe('dfam - mesh gerçekleri', () => {
  it('kutu: su geçirmez, 12+ üçgen, gövde sayısı parça sayısı', () => {
    const parts = partsOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [20, 10, 30] }] });
    const facts = meshFacts(parts);
    expect(facts.watertight).toBe(true);
    expect(facts.triangle_count).toBeGreaterThanOrEqual(12);
    expect(facts.body_count).toBe(1);
    expect(facts.bbox_mm).toEqual([20, 10, 30]);
  });

  it('tek yanlı düzlem su geçirmez değildir', () => {
    const part: ExecutedPart = { geometry: new THREE.PlaneGeometry(10, 10) };
    expect(meshFacts([part]).watertight).toBe(false);
  });

  it('CSG dikişleri: T-eksemli ama mühürlü -> kapalı sayılır', () => {
    // three-bvh-csg birleşiminde yan yüzler bölünmemiş, alt yüz bölünmüş
    // kenar zinciriyle bağlanir (T-tepe noktasi). Geometri mühürlüdür.
    const facts = meshFacts(partsOf(tableIr()));
    expect(facts.open_edges).toBeGreaterThan(0);
    expect(facts.uncovered_edges).toBe(0);
    expect(facts.t_seams).toBe(true);
    expect(facts.watertight).toBe(true);
  });

  it('ölçek ipucu: 1 mm altı çapraz kutu şüpheli', () => {
    const part: ExecutedPart = { geometry: new THREE.BoxGeometry(0.2, 0.3, 0.1) };
    expect(scaleHint([part]).units_suspect).toBe(true);
    expect(scaleHint(partsOf({ name: 'k', parameters: {}, body: [{ op: 'box', size: [20, 10, 30] }] })).units_suspect).toBe(false);
  });
});

describe('dfam - aşırı açı ve destek', () => {
  it('tablada oturan kutu: limit altı yüz yok', () => {
    const parts = partsOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [20, 10, 30] }] });
    const over = overhangFacts(parts, 45);
    expect(over.down_facing_area_below_limit_mm2).toBe(0);
  });

  it('masa: plakanın altı limit altı sayılır (plaka altı - bacak kesiti ~800 mm²)', () => {
    const over = overhangFacts(partsOf(tableIr()), 45);
    expect(over.down_facing_area_below_limit_mm2).toBeGreaterThan(700);
    expect(over.down_facing_area_below_limit_mm2).toBeLessThan(1000);
    expect(over.face_count_below_limit).toBeGreaterThan(0);
  });

  it('masa: destek hacmi prizma üst sınırı ~800×21 mm³', () => {
    const support = supportVolume(partsOf(tableIr()), 45);
    // Plaka alt yüzü y=9, minY=-12 -> yükseklik 21; alan ~800.
    expect(support.estimated_support_volume_mm3).toBeGreaterThan(15000);
    expect(support.estimated_support_volume_mm3).toBeLessThan(18000);
    expect(support.support_to_part_ratio_pct).toBeGreaterThan(0);
  });

  it('çevrilmiş masa: destek alanı ~0 (yön adayı çalışır)', () => {
    const parts = partsOf(tableIr());
    const candidates = orientationFacts(parts, 45);
    const flip = candidates.find((c) => c.orientation === 'çevir 180° (X)');
    const current = candidates.find((c) => c.orientation === 'mevcut (+Y)');
    expect(flip).toBeDefined();
    expect(current).toBeDefined();
    expect(flip!.support_area_mm2).toBeLessThan(current!.support_area_mm2 * 0.1);
    // Kurulum yüksekliği: çevrilince de toplam yükseklik aynı (25).
    expect(flip!.build_height_mm).toBeCloseTo(25, 0);
  });

  it('genişleyen koni 40° duvar: FDM 45° limitinde sayılır, SLA 30° limitinde sayılmaz', () => {
    // radiusBottom=6, radiusTop=16, h=8.4 -> duvar eğimi ~40°.
    const ir: ModelIR = {
      name: 'koni',
      parameters: {},
      body: [{ op: 'cone', radiusBottom: 6, radiusTop: 16, height: 8.4, segments: 96 }]
    };
    const parts = partsOf(ir);
    expect(overhangFacts(parts, 45).down_facing_area_below_limit_mm2).toBeGreaterThan(0);
    expect(overhangFacts(parts, 30).down_facing_area_below_limit_mm2).toBe(0);
  });
});

describe('dfam - duvar kalınlığı', () => {
  it('katı kutu: en ince ölçüm en küçük boyut (~10 mm)', () => {
    const parts = partsOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [20, 10, 30] }] });
    const wall = wallThickness(parts, 600);
    expect(wall.error).toBeUndefined();
    expect(wall.p05_mm).toBeGreaterThan(9.5);
    expect(wall.p05_mm).toBeLessThan(10.5);
    expect(wall.min_mm).toBeGreaterThan(9);
  });

  it('içi boş kutu: kalınlık duvar ölçüsüne (~3 mm) düşer', () => {
    const ir: ModelIR = {
      name: 'kutu-ici-bos',
      parameters: {},
      body: [
        {
          op: 'difference',
          children: [
            { op: 'box', size: [20, 20, 20] },
            { op: 'box', size: [14, 14, 22] }
          ]
        }
      ]
    };
    const wall = wallThickness(partsOf(ir), 1200);
    expect(wall.error).toBeUndefined();
    expect(wall.p05_mm).toBeGreaterThan(2.5);
    expect(wall.p05_mm).toBeLessThan(3.5);
  });
});

describe('dfam - karşılaştırma katmanı', () => {
  it('katı kutu FDM: aşırı açı yok, duvar yeterli -> hata 0', () => {
    const report = analyzeDfam(partsOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [30, 15, 30] }] }), 'fdm');
    expect(report.fail_count).toBe(0);
    expect(report.findings.find((f) => f.id === 'overhang')?.status).toBe('pass');
    expect(report.findings.find((f) => f.id === 'wall')?.status).toBe('pass');
  });

  it('ince duvarlı kutu FDM: duvar ihlali -> hata + yeniden tasarım talimatı', () => {
    const ir: ModelIR = {
      name: 'ince',
      parameters: {},
      body: [
        { op: 'difference', children: [{ op: 'box', size: [30, 30, 30] }, { op: 'box', size: [28, 28, 32] }] }
      ]
    };
    const report = analyzeDfam(partsOf(ir), 'fdm');
    const wall = report.facts.wall_thickness;
    expect(wall.p05_mm).toBeLessThan(1.6);
    const wallFinding = report.findings.find((f) => f.id === 'wall');
    expect(wallFinding?.status).toBe('fail');
    expect(wallFinding?.redesign).toBeTruthy();
    const prompt = dfamRedesignPrompt(report);
    expect(prompt).toContain('yeniden üret');
  });

  it('toz süreci (SLS): destek açısı bulgusu yerine toz notu', () => {
    const report = analyzeDfam(partsOf(tableIr()), 'sls');
    expect(report.facts.overhangs.down_facing_area_below_limit_mm2).toBeGreaterThan(0);
    expect(report.findings.find((f) => f.id === 'overhang')).toBeUndefined();
    expect(report.findings.find((f) => f.id === 'powder')?.status).toBe('info');
  });

  it('süreç limitleri tablosu text-to-cad kaynak değerlerini taşır', () => {
    expect(PROCESS_LIMITS.fdm.minUnsupportedWall).toBe(1.6);
    expect(PROCESS_LIMITS.fdm.selfSupportAngle).toBe(45);
    expect(PROCESS_LIMITS.sla.selfSupportAngle).toBe(30);
    expect(PROCESS_LIMITS.sls.powder).toBe(true);
    expect(PROCESS_LIMITS.pbf.minSupportedWall).toBe(0.4);
  });
});

describe('3MF dışa aktarma belgeleri', () => {
  it('kutu: belge üçlüsü, mm birimi, Z-yukarı koordinatlar, 36 köşe', () => {
    const parts = partsOf({ name: 'kutu', parameters: {}, body: [{ op: 'box', size: [20, 10, 30] }] });
    const docs = build3mfDocuments(parts);
    expect(docs['[Content_Types].xml']).toContain('3dmanufacturing-3dmodel+xml');
    expect(docs['_rels/.rels']).toContain('/3D/3dmodel.model');
    const model = docs['3D/3dmodel.model'];
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"');
    // Y-yukarı -> Z-yukarı: orijinal z=±15 -> yeni y=∓15; orijinal y=±5 -> yeni z=±5.
    expect(model).toContain('y="15"');
    expect(model).toContain('z="5"');
    expect((model.match(/<vertex /g) ?? []).length).toBe(36); // toNonIndexed kutu
    expect((model.match(/<triangle /g) ?? []).length).toBe(12);
    expect(model).toContain('<item objectid="1"/>');
  });

  it('renkli iki parça: iki nesne + iki malzeme', () => {
    const ir: ModelIR = {
      name: 'iki',
      parameters: {},
      body: [
        { op: 'color', color: '#ff0000', children: [{ op: 'box', size: [10, 10, 10] }] },
        { op: 'color', color: '#00ff00', children: [{ op: 'translate', offset: [20, 0, 0], children: [{ op: 'box', size: [10, 10, 10] }] }] }
      ]
    };
    const docs = build3mfDocuments(partsOf(ir));
    const model = docs['3D/3dmodel.model'];
    expect((model.match(/<object /g) ?? []).length).toBe(2);
    expect((model.match(/<base /g) ?? []).length).toBe(2);
    expect(model).toContain('displaycolor="#FF0000FF"');
    expect(model).toContain('<item objectid="2"/>');
  });
});
