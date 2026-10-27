/* ============================================================
   dfam.ts - Üretilebilirlik (DfAM) ölçüm ve değerlendirme motoru
   ------------------------------------------------------------
   earthtojake/text-to-cad (MIT) projesindeki DfAM sisteminin
   tarayıcı portu: skills/dfam-check/scripts/dfam_tool.py
   (ölçüm) + references/process-limits.md (süreç limitleri) +
   SKILL.md (karşılaştırma ve yeniden tasarım aktarımı).

   Farklı uyarlamalar:
   - Studio Y yukarı kullanır (text-to-cad Z yukarı): "aşağı"
     = normal.y < 0, tabla = XZ düzlemi, kurulum yönü +Y.
   - ModelIR zaten parça listesi verir: her ExecutedPart ayrı
     bir "gövde" olarak ölçülür (araçtaki mesh.split yerine).
   - Duvar kalınlığı ray-cast'i three-mesh-bvh ile hızlandırılır.
   Ölçüm katmanı yalnızca gerçekleri raporlar; pass/fail kararı
   süreç limitleriyle karşılaştırmadan gelir (araçtaki gibi).
   ============================================================ */

import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { ExecutedPart } from './types';
import { meshVolume } from './volume';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/* ---------------- Süreç limitleri (process-limits.md) ---------------- */

export type ProcessId = 'fdm' | 'sla' | 'sls' | 'mjf' | 'pbf';

export interface ProcessLimits {
  id: ProcessId;
  label: string;
  /** Destekli üretilebilen en ince duvar (mm) */
  minSupportedWall: number;
  /** Desteksiz üretilebilen en ince duvar (mm) — muhafazakar karşılaştırma bunu kullanır */
  minUnsupportedWall: number;
  /** Kendi kendini destekleyen açı (yataydan derece); toz süreçlerinde geçersiz */
  selfSupportAngle: number | null;
  /** Toz yatağı süreci: destek açısı bulguları uygulanmaz */
  powder: boolean;
}

/** Kaynak: Hubs/Formlabs/HP/EOS tasarım kılavuzları, ISO/ASTM 52910 çerçevesi. */
export const PROCESS_LIMITS: Record<ProcessId, ProcessLimits> = {
  fdm: { id: 'fdm', label: 'FDM / FFF', minSupportedWall: 1.2, minUnsupportedWall: 1.6, selfSupportAngle: 45, powder: false },
  sla: { id: 'sla', label: 'SLA / DLP', minSupportedWall: 0.5, minUnsupportedWall: 1.0, selfSupportAngle: 30, powder: false },
  sls: { id: 'sls', label: 'SLS (PA12)', minSupportedWall: 0.7, minUnsupportedWall: 0.7, selfSupportAngle: null, powder: true },
  mjf: { id: 'mjf', label: 'MJF', minSupportedWall: 0.5, minUnsupportedWall: 0.5, selfSupportAngle: null, powder: true },
  pbf: { id: 'pbf', label: 'PBF-LB metal', minSupportedWall: 0.4, minUnsupportedWall: 0.5, selfSupportAngle: 45, powder: false }
};

/* ---------------- Yüz verileri ---------------- */

interface PartFaces {
  /** Üçgen merkezleri [x,y,z] düz dizi */
  centroid: number[];
  /** Birim normaller [x,y,z] düz dizi */
  normal: number[];
  /** Üçgen alanları */
  area: number[];
  totalArea: number;
  triangles: number;
}

function extractFaces(geometry: THREE.BufferGeometry): PartFaces {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const centroid: number[] = [];
  const normal: number[] = [];
  const area: number[] = [];
  let totalArea = 0;
  const ax: number[] = [0, 0, 0], bx: number[] = [0, 0, 0], cx: number[] = [0, 0, 0];
  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    ax[0] = pos.getX(i0); ax[1] = pos.getY(i0); ax[2] = pos.getZ(i0);
    bx[0] = pos.getX(i1); bx[1] = pos.getY(i1); bx[2] = pos.getZ(i1);
    cx[0] = pos.getX(i2); cx[1] = pos.getY(i2); cx[2] = pos.getZ(i2);
    const e1x = bx[0] - ax[0], e1y = bx[1] - ax[1], e1z = bx[2] - ax[2];
    const e2x = cx[0] - ax[0], e2y = cx[1] - ax[1], e2z = cx[2] - ax[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    const triArea = len / 2;
    if (len > 1e-12) { nx /= len; ny /= len; nz /= len; }
    centroid.push((ax[0] + bx[0] + cx[0]) / 3, (ax[1] + bx[1] + cx[1]) / 3, (ax[2] + bx[2] + cx[2]) / 3);
    normal.push(nx, ny, nz);
    area.push(triArea);
    totalArea += triArea;
  }
  return { centroid, normal, area, totalArea, triangles: count / 3 };
}

/* ---------------- Ölçülmüş gerçekler ---------------- */

export interface MeshFacts {
  bbox_mm: [number, number, number];
  volume_mm3: number;
  surface_area_mm2: number;
  triangle_count: number;
  watertight: boolean;
  body_count: number;
  /** T-eksem farkındalıklı testin ayrıntısı (bkz. watertightFacts) */
  open_edges: number;
  uncovered_edges: number;
  t_seams: boolean;
}

export interface ScaleHint {
  bbox_diagonal_mm: number;
  units_suspect: boolean;
  note: string;
}

export interface OverhangFacts {
  angle_limit_used_deg: number;
  down_facing_area_below_limit_mm2: number;
  down_facing_area_below_limit_pct: number;
  face_count_below_limit: number;
  down_facing_angle_histogram_mm2: Record<string, number>;
  largest_faces_below_limit: Array<{ location_xyz: [number, number, number]; surface_angle_deg: number; area_mm2: number }>;
}

export interface WallStats {
  samples_valid: number;
  min_mm: number;
  p05_mm: number;
  p25_mm: number;
  median_mm: number;
  max_mm: number;
  thinnest_samples: Array<{ location_xyz: [number, number, number]; thickness_mm: number }>;
}

export interface WallFacts extends Partial<WallStats> {
  body_count: number;
  per_body?: Array<{ body: number; min_mm: number | null; p05_mm: number | null; median_mm: number | null; samples_valid: number }>;
  error?: string;
}

export interface SupportFacts {
  angle_limit_used_deg: number;
  estimated_support_volume_mm3: number;
  part_volume_mm3: number;
  support_to_part_ratio_pct: number;
  method: string;
}

export interface OrientationCandidate {
  orientation: string;
  support_area_mm2: number;
  support_area_pct: number;
  build_height_mm: number;
}

export interface WatertightFacts {
  watertight: boolean;
  /** Tam iki üçgenle paylaşılmayan kenar sayısı */
  open_edges: number;
  /** Doğrusal çakışık komşu kenarlarla kapatılamayan (gerçek boşluk) kenar sayısı */
  uncovered_edges: number;
  /** T-tepe noktalı dikiş var mı (CSG motorlarının normal çıktısı) */
  t_seams: boolean;
}

/**
 * Kapanma testi — T-eksem farkındalıklı.
 * Katı kural (her kenar tam 2 üçgen) three-bvh-csg çıktısında her modelde
 * ihlal edilir: boolean dikişlerinde bir yüz bölünmemiş kenarla, öbürü
 * bölünmüş kenar zinciriyle bağlanır (T-tepe noktası). Bu yüzeyler
 * geometrik olarak mühürlüdür (hacim/alan doğru, dilimleyici kabul
 * eder). Bu yüzden açık kalan her kenar, aynı doğru üzerindeki diğer
 * kenar segmentlerinin birleşimiyle tamamen örtülüyorsa yüzey kapalı
 * sayılır; örtülemeyen kenar gerçek bir boşluktur.
 */
function watertightFacts(geometry: THREE.BufferGeometry): WatertightFacts {
  const none: WatertightFacts = { watertight: false, open_edges: 0, uncovered_edges: 0, t_seams: false };
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  if (!pos) return none;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  if (count < 6) return none;
  // Aynı konumdaki köşeleri tek kimlikte birleştir (CSG çıktısı indekssiz olabilir).
  const vertexId = new Map<string, number>();
  const coords: Array<[number, number, number]> = [];
  const ids = new Int32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const key = `${Math.round(pos.getX(v) * 1e5)},${Math.round(pos.getY(v) * 1e5)},${Math.round(pos.getZ(v) * 1e5)}`;
    let id = vertexId.get(key);
    if (id === undefined) { id = coords.length; coords.push([pos.getX(v), pos.getY(v), pos.getZ(v)]); vertexId.set(key, id); }
    ids[v] = id;
  }
  const edgeCount = new Map<string, number>();
  const edgeVerts = new Map<string, [number, number]>();
  for (let i = 0; i + 2 < count; i += 3) {
    const a = ids[index ? index.getX(i) : i];
    const b = ids[index ? index.getX(i + 1) : i + 1];
    const c = ids[index ? index.getX(i + 2) : i + 2];
    if (a === b || b === c || a === c) {
      return { watertight: false, open_edges: 0, uncovered_edges: 1, t_seams: false }; // dejenere üçgen
    }
    for (const [p, q] of [[a, b], [b, c], [c, a]] as Array<[number, number]>) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      edgeVerts.set(key, [p, q]);
    }
  }
  const open: Array<[number, number]> = [];
  for (const [key, n] of edgeCount) if (n !== 2) open.push(edgeVerts.get(key)!);
  if (open.length === 0) return { watertight: true, open_edges: 0, uncovered_edges: 0, t_seams: false };
  // Kapsama testi pahalı olabilir; çok fazla açık kenarda muhafazakar kal.
  if (open.length > 2000) {
    return { watertight: false, open_edges: open.length, uncovered_edges: open.length, t_seams: false };
  }

  const sub = (p: [number, number, number], q: [number, number, number]) =>
    [q[0] - p[0], q[1] - p[1], q[2] - p[2]] as [number, number, number];
  const dot = (u: [number, number, number], v: [number, number, number]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = (u: [number, number, number], v: [number, number, number]) =>
    [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] as [number, number, number];
  const norm = (u: [number, number, number]) => Math.hypot(u[0], u[1], u[2]);
  const TOL = 1e-5;

  const all = [...edgeVerts.values()];
  let uncovered = 0;
  for (const [a, b] of open) {
    const pa = coords[a], pb = coords[b];
    const d = sub(pa, pb);
    const L = norm(d);
    if (L < TOL) continue; // sıfır uzunluklu kenar zaten örtülü sayılır
    const u: [number, number, number] = [d[0] / L, d[1] / L, d[2] / L];
    const intervals: Array<[number, number]> = [];
    for (const [c1, c2] of all) {
      if (c1 === a && c2 === b) continue;
      const pc = coords[c1], pd = coords[c2];
      const d2 = sub(pc, pd);
      const L2 = norm(d2);
      if (L2 < TOL) continue;
      const u2: [number, number, number] = [d2[0] / L2, d2[1] / L2, d2[2] / L2];
      if (norm(cross(u, u2)) > 1e-6) continue; // paralel değil
      if (norm(cross(u, sub(pa, pc))) > 1e-4) continue; // aynı doğru değil
      const t1 = dot(sub(pa, pc), u);
      const t2 = dot(sub(pa, pd), u);
      intervals.push([Math.min(t1, t2), Math.max(t1, t2)]);
    }
    intervals.sort((x, y) => x[0] - y[0]);
    let covered = 0;
    let fail = false;
    for (const [s, e] of intervals) {
      if (s > covered + TOL) { fail = true; break; }
      covered = Math.max(covered, e);
    }
    if (covered < L - TOL) fail = true;
    if (fail) uncovered++;
  }
  return {
    watertight: uncovered === 0,
    open_edges: open.length,
    uncovered_edges: uncovered,
    t_seams: open.length > 0 && uncovered === 0
  };
}

export function meshFacts(parts: ExecutedPart[]): MeshFacts {
  const box = new THREE.Box3();
  let volume = 0, area = 0, triangles = 0;
  let watertight = true, openEdges = 0, uncoveredEdges = 0, tSeams = false;
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
    volume += Math.abs(meshVolume(part.geometry));
    triangles += (part.geometry.index ? part.geometry.index.count : part.geometry.attributes.position.count) / 3;
    area += extractFaces(part.geometry).totalArea;
    const w = watertightFacts(part.geometry);
    openEdges += w.open_edges;
    uncoveredEdges += w.uncovered_edges;
    if (w.t_seams) tSeams = true;
    if (!w.watertight) watertight = false;
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    bbox_mm: [round(size.x, 2), round(size.y, 2), round(size.z, 2)],
    volume_mm3: round(volume, 1),
    surface_area_mm2: round(area, 1),
    triangle_count: Math.round(triangles),
    watertight,
    body_count: parts.length,
    open_edges: openEdges,
    uncovered_edges: uncoveredEdges,
    t_seams: tSeams
  };
}

export function scaleHint(parts: ExecutedPart[]): ScaleHint {
  const box = new THREE.Box3();
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  const diag = size.length();
  const suspect = Number.isFinite(diag) && diag < 1.0;
  return {
    bbox_diagonal_mm: round(diag, 4),
    units_suspect: suspect,
    note: suspect
      ? 'Çapraz kutu ölçüsü 1 mm altında; kaynak muhtemelen metre/inç biriminde. Aşırı açı, destek ve kalınlık sayılarına güvenmeden önce mm olarak ölçekle.'
      : 'Sınırlayıcı kutu mm birimiyle tutarlı.'
  };
}

/** Aşağı bakan yüzler: 0 = düz tavan, 90 = dikey. Tabladakiler hariç. */
export function overhangFacts(parts: ExecutedPart[], angleLimit: number): OverhangFacts {
  let minY = Infinity;
  const faces: PartFaces[] = parts.map((p) => extractFaces(p.geometry));
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) minY = Math.min(minY, part.geometry.boundingBox.min.y);
  }
  if (!Number.isFinite(minY)) minY = 0;

  let totalArea = 0;
  for (const f of faces) totalArea += f.totalArea;

  let belowArea = 0, belowFaces = 0;
  const histogram: Record<string, number> = {};
  const offenders: Array<{ location_xyz: [number, number, number]; surface_angle_deg: number; area_mm2: number }> = [];

  for (const f of faces) {
    for (let t = 0; t < f.area.length; t++) {
      const ny = f.normal[t * 3 + 1];
      if (ny >= -1e-6) continue; // aşağı bakmıyor
      const cy = f.centroid[t * 3 + 1];
      if (cy < minY + 0.1) continue; // tablada yatıyor
      const surfaceAngle = 90 - (Math.asin(Math.min(1, Math.max(0, -ny))) * 180) / Math.PI;
      const bin = Math.min(9, Math.floor(surfaceAngle / 10)) * 10;
      const key = `${bin}-${bin + 10}deg`;
      histogram[key] = round((histogram[key] ?? 0) + f.area[t], 2);
      if (surfaceAngle < angleLimit) {
        belowArea += f.area[t];
        belowFaces++;
        offenders.push({
          location_xyz: [round(f.centroid[t * 3], 2), round(cy, 2), round(f.centroid[t * 3 + 2], 2)],
          surface_angle_deg: round(surfaceAngle, 1),
          area_mm2: round(f.area[t], 2)
        });
      }
    }
  }
  offenders.sort((a, b) => b.area_mm2 - a.area_mm2);

  return {
    angle_limit_used_deg: angleLimit,
    down_facing_area_below_limit_mm2: round(belowArea, 2),
    down_facing_area_below_limit_pct: totalArea > 0 ? round((100 * belowArea) / totalArea, 1) : 0,
    face_count_below_limit: belowFaces,
    down_facing_angle_histogram_mm2: histogram,
    largest_faces_below_limit: offenders.slice(0, 8)
  };
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Duvar kalınlığı: parça başına alan-ağırlıklı örneklem, içe ray-cast. */
export function wallThickness(parts: ExecutedPart[], samples = 1500): WallFacts {
  const totalTriangles = parts.reduce(
    (n, p) => n + (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3, 0);
  if (totalTriangles > 250000) {
    return { body_count: parts.length, error: `Ağ çok yoğun (${Math.round(totalTriangles)} üçgen); kalınlık ölçümü atlandı.` };
  }

  const faces = parts.map((p) => extractFaces(p.geometry));
  const areas = faces.map((f) => f.totalArea);
  const totalArea = areas.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(totalArea) || totalArea <= 0) {
    return { body_count: parts.length, error: 'Pozitif yüz alanı yok; kalınlık ölçülemedi.' };
  }

  // Örnek bütçesini yüzey alanına göre paylaştır (küçük gövdelere taban ver).
  const budgets = areas.map((a) => Math.max(64, Math.round((samples * a) / totalArea)));

  const pooled: number[] = [];
  const pooledOrigins: number[] = [];
  const perBody: WallFacts['per_body'] = [];
  const raycaster = new THREE.Raycaster();
  (raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;

  parts.forEach((part, i) => {
    const f = faces[i];
    const n = Math.min(budgets[i], f.area.length);
    if (n <= 0 || f.totalArea <= 0) {
      perBody.push({ body: i, min_mm: null, p05_mm: null, median_mm: null, samples_valid: 0 });
      return;
    }
    // Alan-ağırlıklı yüz seçimi: kümülatif dağılım üzerinden.
    const cum = new Float64Array(f.area.length);
    let acc = 0;
    for (let t = 0; t < f.area.length; t++) { acc += f.area[t]; cum[t] = acc; }
    let seed = 42 + i; // deterministik LCG (araçtaki gibi sabit tohum)
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const geometry = part.geometry;
    let boundsTree = false;
    try {
      (geometry as THREE.BufferGeometry & { computeBoundsTree?: () => void }).computeBoundsTree?.();
      boundsTree = true;
    } catch { /* BVH yoksa düz raycast devam eder */ }
    const mesh = new THREE.Mesh(
      geometry,
      // İçeriden atış: çıkış yüzü arka yüzdür; DoubleSide olmadan hit gelmez.
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );

    const thicknesses: number[] = [];
    const origins: number[] = [];
    const bbox = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const diag = size.length();

    for (let s = 0; s < n; s++) {
      const r = rand() * acc;
      let t = 0;
      while (t < cum.length - 1 && cum[t] < r) t++;
      const ox = f.centroid[t * 3], oy = f.centroid[t * 3 + 1], oz = f.centroid[t * 3 + 2];
      const nx = f.normal[t * 3], ny = f.normal[t * 3 + 1], nz = f.normal[t * 3 + 2];
      const dir = new THREE.Vector3(-nx, -ny, -nz);
      const origin = new THREE.Vector3(ox + dir.x * 1e-4, oy + dir.y * 1e-4, oz + dir.z * 1e-4);
      raycaster.set(origin, dir);
      const hits = raycaster.intersectObject(mesh, false);
      if (hits.length === 0) continue;
      const d = hits[0].distance;
      if (d > 1e-3 && d < diag) {
        thicknesses.push(d);
        origins.push(ox, oy, oz);
      }
    }

    if (boundsTree) {
      (geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
    }

    if (thicknesses.length === 0) {
      perBody.push({ body: i, min_mm: null, p05_mm: null, median_mm: null, samples_valid: 0 });
      return;
    }
    const sorted = [...thicknesses].sort((a, b) => a - b);
    perBody.push({
      body: i,
      min_mm: round(sorted[0], 3),
      p05_mm: round(percentile(sorted, 0.05), 3),
      median_mm: round(percentile(sorted, 0.5), 3),
      samples_valid: thicknesses.length
    });
    pooled.push(...thicknesses);
    pooledOrigins.push(...origins);
  });

  if (pooled.length === 0) {
    return { body_count: parts.length, per_body: perBody, error: 'Geçerli kalınlık örneği yok.' };
  }
  const sorted = [...pooled].sort((a, b) => a - b);
  const thinIdx: number[] = [];
  for (let k = 0; k < pooled.length && thinIdx.length < 8; k++) {
    let best = -1;
    for (let j = 0; j < pooled.length; j++) {
      if (thinIdx.includes(j)) continue;
      if (best === -1 || pooled[j] < pooled[best]) best = j;
    }
    if (best >= 0) thinIdx.push(best);
  }

  return {
    body_count: parts.length,
    samples_valid: pooled.length,
    min_mm: round(sorted[0], 3),
    p05_mm: round(percentile(sorted, 0.05), 3),
    p25_mm: round(percentile(sorted, 0.25), 3),
    median_mm: round(percentile(sorted, 0.5), 3),
    max_mm: round(sorted[sorted.length - 1], 3),
    per_body: perBody,
    thinnest_samples: thinIdx.map((j) => ({
      location_xyz: [round(pooledOrigins[j * 3], 2), round(pooledOrigins[j * 3 + 1], 2), round(pooledOrigins[j * 3 + 2], 2)],
      thickness_mm: round(pooled[j], 3)
    }))
  };
}

/** Prizma üst sınırı: destek gerektiren yüzlerin ağırlık merkezinden tablaya. */
export function supportVolume(parts: ExecutedPart[], angleLimit: number): SupportFacts {
  let minY = Infinity;
  const faces = parts.map((p) => extractFaces(p.geometry));
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) minY = Math.min(minY, part.geometry.boundingBox.min.y);
  }
  if (!Number.isFinite(minY)) minY = 0;

  let supportVol = 0;
  for (const f of faces) {
    for (let t = 0; t < f.area.length; t++) {
      const ny = f.normal[t * 3 + 1];
      if (ny >= -1e-6) continue;
      const cy = f.centroid[t * 3 + 1];
      if (cy < minY + 0.1) continue;
      const surfaceAngle = 90 - (Math.asin(Math.min(1, Math.max(0, -ny))) * 180) / Math.PI;
      if (surfaceAngle >= angleLimit) continue;
      supportVol += f.area[t] * Math.abs(ny) * (cy - minY);
    }
  }
  let partVol = 0;
  for (const part of parts) partVol += Math.abs(meshVolume(part.geometry));
  if (partVol <= 0) {
    // Araçtaki convex hull yedeği yerine sınırlayıcı kutu hacmi.
    const box = new THREE.Box3();
    for (const part of parts) {
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    partVol = size.x * size.y * size.z;
  }
  return {
    angle_limit_used_deg: angleLimit,
    estimated_support_volume_mm3: round(supportVol, 1),
    part_volume_mm3: round(partVol, 1),
    support_to_part_ratio_pct: partVol > 0 ? round((100 * supportVol) / partVol, 1) : 0,
    method: 'yüz ağırlık merkezinden tablaya prizma; kaba üst sınır'
  };
}

/** 6 eksen hizalı kurulum yönü adayı. */
export function orientationFacts(parts: ExecutedPart[], angleLimit: number): OrientationCandidate[] {
  const rotations: Array<{ name: string; m: THREE.Matrix4 }> = [
    { name: 'mevcut (+Y)', m: new THREE.Matrix4() },
    { name: 'çevir 180° (X)', m: new THREE.Matrix4().makeRotationX(Math.PI) },
    { name: 'döndür +90° (X)', m: new THREE.Matrix4().makeRotationX(Math.PI / 2) },
    { name: 'döndür -90° (X)', m: new THREE.Matrix4().makeRotationX(-Math.PI / 2) },
    { name: 'döndür +90° (Y)', m: new THREE.Matrix4().makeRotationY(Math.PI / 2) },
    { name: 'döndür -90° (Y)', m: new THREE.Matrix4().makeRotationY(-Math.PI / 2) }
  ];
  const out: OrientationCandidate[] = [];
  for (const { name, m } of rotations) {
    const rotated = parts.map((p) => ({ ...p, geometry: p.geometry.clone().applyMatrix4(m) }));
    const ov = overhangFacts(rotated, angleLimit);
    const box = new THREE.Box3();
    for (const part of rotated) {
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    out.push({
      orientation: name,
      support_area_mm2: ov.down_facing_area_below_limit_mm2,
      support_area_pct: ov.down_facing_area_below_limit_pct,
      build_height_mm: round(size.y, 2)
    });
  }
  return out;
}

/* ---------------- Karşılaştırma katmanı (SKILL.md) ---------------- */

export type FindingStatus = 'pass' | 'fail' | 'info';

export interface DfamFinding {
  id: string;
  status: FindingStatus;
  /** 0 en kritik: kapalılık -> duvar -> aşırı açı -> yön/maliyet */
  severity: number;
  title: string;
  detail: string;
  measured?: string;
  limit?: string;
  source: string;
  redesign?: string;
}

export interface DfamReport {
  process: ProcessId;
  angle_limit_used_deg: number;
  partial: boolean;
  partial_sections: string[];
  findings: DfamFinding[];
  facts: {
    mesh: MeshFacts;
    scale: ScaleHint;
    overhangs: OverhangFacts;
    wall_thickness: WallFacts;
    support_volume: SupportFacts;
    orientations: OrientationCandidate[];
  };
  summary: string;
  fail_count: number;
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function fmt(v: number, digits = 1): string {
  return v.toLocaleString('tr-TR', { maximumFractionDigits: digits });
}

export function analyzeDfam(parts: ExecutedPart[], processId: ProcessId, options: { samples?: number } = {}): DfamReport {
  const limits = PROCESS_LIMITS[processId];
  const angleLimit = limits.selfSupportAngle ?? 45;
  const findings: DfamFinding[] = [];
  const partialSections: string[] = [];

  // Aileler ayrı ayrı düşer (araçtaki _safe deseni); rapor kalan gerçekleri yitirmez.
  let mesh: MeshFacts;
  try { mesh = meshFacts(parts); } catch (e) { mesh = { bbox_mm: [0, 0, 0], volume_mm3: 0, surface_area_mm2: 0, triangle_count: 0, watertight: false, body_count: 0, open_edges: 0, uncovered_edges: 0, t_seams: false }; partialSections.push('mesh'); void e; }
  let scale: ScaleHint;
  try { scale = scaleHint(parts); } catch { scale = { bbox_diagonal_mm: 0, units_suspect: false, note: '' }; partialSections.push('scale'); }
  let over = overhangFacts(parts, angleLimit);
  let wall = wallThickness(parts, options.samples ?? 1500);
  if (wall.error) partialSections.push('wall_thickness');
  let support = supportVolume(parts, angleLimit);
  let orientations = orientationFacts(parts, angleLimit);

  /* 1. Kapalılık: her süreç için dilimlemeyi engeller. */
  if (mesh.triangle_count > 0) {
    findings.push(mesh.watertight
      ? {
          id: 'watertight', status: 'pass', severity: 0,
          title: 'Ağ su geçirmez',
          detail: mesh.t_seams
            ? `Yüzey geometrik olarak mühürlü: ${mesh.open_edges} kenar T-tepe noktalı dikişten açık kalıyor ama hepsi çakışık komşu kenarlarla örtülü (boolean CSG dikişlerinin normali; hacim ve alan tutarlı).`
            : 'Her kenar tam iki üçgen tarafından paylaşılıyor; dilimleme için engel yok.',
          source: 'T-eksem farkındalıklı kenar testi (dfam.ts)'
        }
      : {
          id: 'watertight', status: 'fail', severity: 0,
          title: 'Ağ su geçirmez değil',
          detail: `${mesh.uncovered_edges} kenarın çakışık komşusu yok (gerçek boşluk); her süreçte dilimlemeyi engeller.`,
          measured: `örtülemeyen kenar = ${mesh.uncovered_edges}`, limit: 'örtülemeyen kenar = 0',
          source: 'ISO/ASTM 52910 §6 (dfam.ts kenar testi)',
          redesign: 'Modeli kapalı katı gövdeler olarak yeniden kur (delikleri tam geçiren difference ile aç, birleşimlerde iç yüz bırakma).'
        });
  }

  /* 2. Birim ölçeği şüphesi. */
  if (scale.units_suspect) {
    findings.push({
      id: 'scale', status: 'info', severity: 0,
      title: 'Birimler mm olmayabilir',
      detail: scale.note,
      measured: `çapraz kutu ${fmt(scale.bbox_diagonal_mm, 4)} mm`,
      source: 'dfam.ts ölçek ipucu'
    });
  }

  /* 3. Duvar kalınlığı: p05, desteksiz duvar limitinin altındaysa ihlal. */
  if (!wall.error && wall.p05_mm !== undefined) {
    const limit = limits.minUnsupportedWall;
    const p05 = wall.p05_mm;
    const thinnest = wall.thinnest_samples?.[0];
    if (p05 < limit) {
      findings.push({
        id: 'wall', status: 'fail', severity: 1,
        title: 'Duvar kalınlığı limitin altında',
        detail: `Örneklemelerin %5'i ${fmt(p05, 2)} mm'nin altında${thinnest ? `; en ince nokta [${thinnest.location_xyz.map((v) => fmt(v)).join(', ')}] civarında ${fmt(thinnest.thickness_mm, 2)} mm` : ''}. ${limits.label} için desteksiz duvar limiti ${fmt(limit, 1)} mm (destekli ${fmt(limits.minSupportedWall, 1)} mm).`,
        measured: `p05 = ${fmt(p05, 2)} mm, min = ${fmt(wall.min_mm ?? p05, 2)} mm`,
        limit: `≥ ${fmt(limit, 1)} mm (desteksiz)`,
        source: `${limits.label} tasarım kılavuzu (text-to-cad process-limits)`,
        redesign: thinnest
          ? `Duvarı [${thinnest.location_xyz.map((v) => fmt(v)).join(', ')}] civarında ${fmt(thinnest.thickness_mm, 2)} mm'den en az ${fmt(limit, 1)} mm'e kalınlaştır.`
          : `Duvarları en az ${fmt(limit, 1)} mm'e kalınlaştır.`
      });
    } else {
      findings.push({
        id: 'wall', status: 'pass', severity: 1,
        title: 'Duvar kalınlığı yeterli',
        detail: `p05 = ${fmt(p05, 2)} mm, medyan ${fmt(wall.median_mm ?? p05, 2)} mm (${wall.samples_valid} örnek, ${wall.body_count} gövde).`,
        limit: `≥ ${fmt(limit, 1)} mm`,
        source: `${limits.label} tasarım kılavuzu (text-to-cad process-limits)`
      });
    }
  } else if (wall.error) {
    findings.push({
      id: 'wall', status: 'info', severity: 1,
      title: 'Duvar kalınlığı ölçülemedi',
      detail: wall.error + ' Ölçülmemiş bir gerçek sıfır anlamına gelmez.',
      source: 'dfam.ts duvar kalınlığı'
    });
  }

  /* 4. Aşırı açı / destek: toz süreçlerine uygulanmaz. */
  if (limits.powder) {
    findings.push({
      id: 'powder', status: 'info', severity: 2,
      title: 'Toz yatağı süreci: destek açısı bulguları uygulanmaz',
      detail: `${limits.label} içinde çevre toz tüm geometriyi destekler. İlgili kontrol, kapalı hacimlerde sıkışan tozun tahliye deliğidir; bu araç onu henüz ölçmüyor.`,
      source: 'text-to-cad process-limits yorum notları'
    });
  } else if (over.down_facing_area_below_limit_mm2 > 0) {
    const worst = over.largest_faces_below_limit[0];
    findings.push({
      id: 'overhang', status: 'fail', severity: 2,
      title: 'Kendi kendini desteklemeyen aşırı açılar var',
      detail: `${fmt(over.down_facing_area_below_limit_mm2)} mm² yüzey (${fmt(over.down_facing_area_below_limit_pct)}%), ${over.face_count_below_limit} üçgen, ${fmt(angleLimit, 0)}° limitinin altında${worst ? `; en büyüğü [${worst.location_xyz.map((v) => fmt(v)).join(', ')}] civarında ${fmt(worst.surface_angle_deg)}° ve ${fmt(worst.area_mm2)} mm²` : ''}. Destek gerektirir ya da yeniden tasarım.`,
      measured: `${fmt(over.down_facing_area_below_limit_mm2)} mm² / ${fmt(over.down_facing_area_below_limit_pct)}%`,
      limit: `≥ ${fmt(angleLimit, 0)}° eğim`,
      source: `${limits.label} kendinden desteklenen açı (text-to-cad process-limits)`,
      redesign: worst
        ? `Aşırı açıyı [${worst.location_xyz.map((v) => fmt(v)).join(', ')}] civarında ${fmt(worst.surface_angle_deg)}°'den en az ${fmt(angleLimit, 0)}°'ye çıkar (pahla/kademelendir) ya da destek kullanımını kabul et.`
        : `Aşırı açıları en az ${fmt(angleLimit, 0)}° eğime çıkar (pah/kademelendirme) ya da destek kullanımını kabul et.`
    });
  } else {
    findings.push({
      id: 'overhang', status: 'pass', severity: 2,
      title: 'Aşırı açı yok',
      detail: `Tabla üstü hariç hiçbir aşağı bakan yüz ${fmt(angleLimit, 0)}° limitinin altında değil.`,
      limit: `≥ ${fmt(angleLimit, 0)}° eğim`,
      source: `${limits.label} kendinden desteklenen açı (text-to-cad process-limits)`
    });
  }

  /* 5. Destek hacmi: maliyet sinyali, sert hata değil. */
  if (!limits.powder) {
    const ratio = support.support_to_part_ratio_pct;
    const notable = ratio > 30;
    findings.push({
      id: 'support', status: 'info', severity: 3,
      title: notable ? 'Destek hacmi yüksek (maliyet sinyali)' : 'Destek hacmi tahmini',
      detail: `~${fmt(support.estimated_support_volume_mm3)} mm³ destek (parçanın %${fmt(ratio)}); prizma üst sınırı. %30 üstü genellikle yön değişikliğini hak eder.`,
      measured: `%${fmt(ratio)}`,
      source: 'dfam.ts prizma tahmini (text-to-cad yöntemi)'
    });

    /* 6. Yön önerisi: destek alanını anlamlı azaltan aday. */
    const current = orientations[0];
    const best = orientations
      .slice(1)
      .filter((o) => o.support_area_mm2 < current.support_area_mm2 * 0.7)
      .sort((a, b) => a.support_area_mm2 - b.support_area_mm2)[0];
    if (best) {
      findings.push({
        id: 'orientation', status: 'info', severity: 3,
        title: 'Daha iyi kurulum yönü var',
        detail: `"${best.orientation}" destek alanını ${fmt(current.support_area_mm2)} mm²'den ${fmt(best.support_area_mm2)} mm²'ye düşürür; kurulum yüksekliği ${fmt(best.build_height_mm)} mm.`,
        source: '6 eksen hizalı aday (dfam.ts)'
      });
    }
  }

  const failCount = findings.filter((f) => f.status === 'fail').length;
  const infoCount = findings.filter((f) => f.status === 'info').length;
  const summary =
    `DfAM (${limits.label}): ${failCount} hata · ${infoCount} not` +
    (!limits.powder ? ` · destek ${fmt(over.down_facing_area_below_limit_pct)}%` : '') +
    (wall.p05_mm !== undefined ? ` · duvar p05 ${fmt(wall.p05_mm, 2)} mm` : '') +
    (partialSections.length > 0 ? ` · kısmi (${partialSections.join(', ')})` : '');

  findings.sort((a, b) => a.severity - b.severity);

  return {
    process: processId,
    angle_limit_used_deg: angleLimit,
    partial: partialSections.length > 0,
    partial_sections: partialSections,
    findings,
    facts: { mesh, scale, overhangs: over, wall_thickness: wall, support_volume: support, orientations },
    summary,
    fail_count: failCount
  };
}

/** AI'ya gönderilecek yeniden tasarım istemi (Redesign Handoff). */
export function dfamRedesignPrompt(report: DfamReport): string | null {
  const failing = report.findings.filter((f) => f.status === 'fail');
  if (failing.length === 0) return null;
  const lines = failing.map(
    (f, i) =>
      `${i + 1}. ${f.title} — ölçülen: ${f.measured ?? '-'}, limit: ${f.limit ?? '-'}${f.redesign ? `\n   Düzeltme: ${f.redesign}` : ''}`
  );
  return (
    `Ürettiğin modelin üretilebilirlik (DfAM) denetiminde şu sorunlar çıktı:\n` +
    lines.join('\n') +
    `\nModeli aynı genel amacı ve ölçüleri koruyarak bu sorunları giderecek şekilde yeniden üret.`
  );
}
