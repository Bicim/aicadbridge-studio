/* ============================================================
   executor.ts - ModelIR -> three.js geometrisi
   Boolean işlemler three-bvh-csg ile. Tüm düğümler parametre
   sözlüğü üzerinden değerlendirilir; slider değişince aynı
   fonksiyon saniyenin kesrinde tekrar koşar (canlı parametrik).
   Hatalar açıklayıcı metinle fırlatılır: Self-Healing bu
   metinleri modele geri verir (Fusion tarafındaki ast.parse +
   onarım döngüsünün web karşılığı).
   ============================================================ */

import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import type {
  CircPatternNode, ExecutedPart, ExecutionResult, IrNode, ModelIR,
  RectPatternNode, RotateNode, TranslateNode
} from './types';
import { resolve, resolveVec3 } from './expr';
import { meshVolume } from './volume';

const evaluator = new Evaluator();
evaluator.useGroups = false;

const DEG = Math.PI / 180;

function requireChildren(node: IrNode, children: IrNode[]): IrNode[] {
  if (!Array.isArray(children) || children.length === 0) {
    throw new Error(`"${node.op}" düğümü en az bir çocuk istiyor (children boş).`);
  }
  return children;
}

/** Üçgen sarımını ters çevirir (ayna sonrası normaller için). */
function flipWinding(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.index) {
    const idx = geometry.index.array as Uint32Array | Uint16Array;
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    geometry.index.needsUpdate = true;
    return geometry;
  }
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name] as THREE.BufferAttribute;
    const itemSize = attr.itemSize;
    const arr = attr.array as Float32Array;
    const tmp = new Float32Array(itemSize);
    for (let i = 0; i + 2 * itemSize < arr.length; i += 3 * itemSize) {
      const b = i + itemSize, c = i + 2 * itemSize;
      tmp.set(arr.subarray(b, b + itemSize));
      arr.copyWithin(b, c, c + itemSize);
      arr.set(tmp, c);
    }
    attr.needsUpdate = true;
  }
  return geometry;
}

function foldBoolean(children: THREE.BufferGeometry[], op: 'union' | 'difference' | 'intersection'): THREE.BufferGeometry {
  if (children.length === 1) return children[0];
  const csgOp = op === 'union' ? ADDITION : op === 'difference' ? SUBTRACTION : INTERSECTION;
  let acc = new Brush(children[0]);
  for (let i = 1; i < children.length; i++) {
    const result = evaluator.evaluate(acc, new Brush(children[i]), csgOp);
    acc = result;
  }
  return acc.geometry.clone();
}

export function evaluateNode(node: IrNode, vars: Record<string, number>): THREE.BufferGeometry {
  switch (node.op) {
    case 'box': {
      const [w, h, d] = resolveVec3(node.size, vars);
      if (w <= 0 || h <= 0 || d <= 0) throw new Error(`box boyutları pozitif olmalı: [${w}, ${h}, ${d}]`);
      return new THREE.BoxGeometry(w, h, d);
    }
    case 'cylinder': {
      const r = resolve(node.radius, vars);
      const h = resolve(node.height, vars);
      if (r <= 0 || h <= 0) throw new Error(`cylinder yarıçap/yükseklik pozitif olmalı: r=${r}, h=${h}`);
      return new THREE.CylinderGeometry(r, r, h, node.segments ?? 48, 1);
    }
    case 'sphere': {
      const r = resolve(node.radius, vars);
      if (r <= 0) throw new Error(`sphere yarıçapı pozitif olmalı: r=${r}`);
      const s = node.segments ?? 32;
      return new THREE.SphereGeometry(r, s, Math.max(8, Math.round(s / 2)));
    }
    case 'cone': {
      const rb = resolve(node.radiusBottom, vars);
      const rt = resolve(node.radiusTop, vars);
      const h = resolve(node.height, vars);
      if (h <= 0) throw new Error(`cone yüksekliği pozitif olmalı: h=${h}`);
      return new THREE.CylinderGeometry(rt, rb, h, node.segments ?? 48, 1);
    }
    case 'torus': {
      const r = resolve(node.radius, vars);
      const t = resolve(node.tube, vars);
      if (r <= 0 || t <= 0 || t >= r) throw new Error(`torus için 0 < tube < radius olmalı: r=${r}, tube=${t}`);
      return new THREE.TorusGeometry(r, t, node.radialSegments ?? 24, node.segments ?? 64);
    }
    case 'translate': {
      const n = node as TranslateNode;
      const children = requireChildren(n, n.children);
      const geom = foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
      const [x, y, z] = resolveVec3(n.offset, vars);
      return geom.clone().applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z));
    }
    case 'rotate': {
      const n = node as RotateNode;
      const children = requireChildren(n, n.children);
      const geom = foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
      const [rx, ry, rz] = resolveVec3(n.euler, vars);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, 'XYZ'));
      return geom.clone().applyMatrix4(m);
    }
    case 'mirror': {
      const children = requireChildren(node, node.children);
      const geom = foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
      const s = new THREE.Vector3(
        node.axis === 'x' ? -1 : 1,
        node.axis === 'y' ? -1 : 1,
        node.axis === 'z' ? -1 : 1
      );
      return flipWinding(geom.clone().applyMatrix4(new THREE.Matrix4().makeScale(s.x, s.y, s.z)));
    }
    case 'union':
    case 'difference':
    case 'intersection': {
      const children = requireChildren(node, node.children);
      return foldBoolean(children.map((c) => evaluateNode(c, vars)), node.op);
    }
    case 'pattern_rect': {
      const n = node as RectPatternNode;
      const children = requireChildren(n, n.children);
      const count = Math.round(resolve(n.count, vars));
      if (count < 1 || count > 500) throw new Error(`pattern_rect adedi 1..500 arası olmalı: ${count}`);
      const [dx, dy, dz] = resolveVec3(n.step, vars);
      const base = foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
      const copies: THREE.BufferGeometry[] = [];
      for (let i = 0; i < count; i++) {
        copies.push(base.clone().applyMatrix4(new THREE.Matrix4().makeTranslation(i * dx, i * dy, i * dz)));
      }
      return foldBoolean(copies, 'union');
    }
    case 'pattern_circular': {
      const n = node as CircPatternNode;
      const children = requireChildren(n, n.children);
      const count = Math.round(resolve(n.count, vars));
      if (count < 2 || count > 360) throw new Error(`pattern_circular adedi 2..360 arası olmalı: ${count}`);
      const radius = resolve(n.radius, vars);
      if (radius < 0) throw new Error(`pattern_circular yarıçapı negatif olamaz: ${radius}`);
      const start = resolve(n.startAngle ?? 0, vars) * DEG;
      const axis = n.axis ?? 'y';
      const base = foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
      const copies: THREE.BufferGeometry[] = [];
      for (let i = 0; i < count; i++) {
        const angle = start + (i * 2 * Math.PI) / count;
        const pos =
          axis === 'y' ? new THREE.Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle))
            : axis === 'x' ? new THREE.Vector3(0, radius * Math.cos(angle), radius * Math.sin(angle))
              : new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
        copies.push(base.clone().applyMatrix4(new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z)));
      }
      return foldBoolean(copies, 'union');
    }
    case 'color': {
      // Renk yalnızca kökte ayrı parça yaratır; içerde passthrough.
      const children = requireChildren(node, node.children);
      return foldBoolean(children.map((c) => evaluateNode(c, vars)), 'union');
    }
    default:
      throw new Error(`Bilinmeyen düğüm türü: "${(node as { op: string }).op}"`);
  }
}

export interface ExecuteOptions {
  /** Parametre varsayılanları yerine kullanıcı değerleri */
  overrides?: Record<string, number>;
}

/** ModelIR'ı çalıştırır: parça geometrileri + istatistikler. */
export function executeIR(ir: ModelIR, options: ExecuteOptions = {}): ExecutionResult {
  if (!ir || typeof ir !== 'object') throw new Error('ModelIR boş ya da geçersiz.');
  if (!Array.isArray(ir.body) || ir.body.length === 0) throw new Error('ModelIR.body en az bir düğüm istiyor.');
  if (!ir.parameters || typeof ir.parameters !== 'object') throw new Error('ModelIR.parameters eksik (boş sözlük de olur: {}).');

  const vars: Record<string, number> = {};
  for (const [name, def] of Object.entries(ir.parameters)) {
    if (!def || typeof def.value !== 'number' || !Number.isFinite(def.value)) {
      throw new Error(`"${name}" parametresi sayısal bir "value" istiyor.`);
    }
    vars[name] = def.value;
  }
  for (const [name, v] of Object.entries(options.overrides ?? {})) {
    if (name in vars && typeof v === 'number' && Number.isFinite(v)) vars[name] = v;
  }

  const parts: ExecutedPart[] = [];
  for (const rootItem of ir.body) {
    let color: string | undefined;
    let node: IrNode = rootItem;
    if (rootItem.op === 'color') {
      color = rootItem.color;
      const inner = requireChildren(rootItem, rootItem.children);
      node = inner[0];
      if (inner.length > 1) {
        node = { op: 'union', children: inner };
      }
    }
    const geometry = evaluateNode(node, vars);
    if (!geometry || !geometry.attributes.position || geometry.attributes.position.count < 3) {
      throw new Error('Bir parça boş geometri üretti (üçgen yok). Boyutları ve boolean sırasını kontrol et.');
    }
    parts.push({ geometry, color });
  }

  // İstatistikler
  const box = new THREE.Box3();
  let volume = 0;
  let triangles = 0;
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
    volume += Math.abs(meshVolume(part.geometry));
    triangles += (part.geometry.index ? part.geometry.index.count : part.geometry.attributes.position.count) / 3;
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.x) || size.x === 0) throw new Error('Model sonsuz ya da sıfır boyutlu görünüyor.');

  return {
    parts,
    stats: {
      bbox: [size.x, size.y, size.z],
      volume: Math.round(volume * 100) / 100,
      triangles: Math.round(triangles),
      parts: parts.length
    }
  };
}
