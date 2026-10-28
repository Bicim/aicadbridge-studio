/* ============================================================
   snapshot.ts - çok görünümlü denetim sayfası (CADAM P1 kavramı)
   ------------------------------------------------------------
   Modeli 6 yönden offscreen render eder: izometrik, ön, arka,
   sağ, sol, üst. Görünüm geometrisi (frameView) saf matematik
   ve Node'da test edilir; renderInspectionSheet yalnız
   tarayıcıda çalışır (WebGL). Açık zemin + standart malzeme,
   görsel modeller için temiz kontrast.
   ============================================================ */

import * as THREE from 'three';
import type { ExecutedPart } from './types';

export interface ViewSpec {
  name: string;
  /** hedeften kameraya doğru birim-olmayan yön vektörü */
  direction: [number, number, number];
}

/** Denetim görünümleri: sıra, görüntü modeline veriliş sırasıdır. */
export const INSPECTION_VIEWS: ViewSpec[] = [
  { name: 'izometrik', direction: [1, 0.75, 1] },
  { name: 'ön', direction: [0, 0, 1] },
  { name: 'arka', direction: [0, 0, -1] },
  { name: 'sağ', direction: [1, 0, 0] },
  { name: 'sol', direction: [-1, 0, 0] },
  // tam dikey bakışta gimbal kilidini önlemek için hafif eğim
  { name: 'üst', direction: [0.001, 1, 0.001] }
];

export interface FramedView {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  near: number;
  far: number;
}

const FOV_DEG = 40;

/**
 * Bir görünümün kamera yerleşimini hesaplar (saf işlev).
 * Kamera, merkezden yön boyunca öyle bir uzaklığa konur ki model
 * (yarıçapı çapraz kutunun yarısı) görüş açısına güvenle sığar.
 */
export function frameView(
  center: [number, number, number],
  radius: number,
  direction: [number, number, number],
  name = ''
): FramedView {
  const len = Math.hypot(direction[0], direction[1], direction[2]);
  if (!Number.isFinite(len) || len < 1e-9) throw new Error('Görünüm yönü sıfır ya da geçersiz.');
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Görünüm yarıçapı pozitif olmalı.');
  const u: [number, number, number] = [direction[0] / len, direction[1] / len, direction[2] / len];
  const distance = (radius / Math.sin((FOV_DEG * Math.PI) / 360)) * 1.12;
  // Dikey bakışta varsayılan up (0,1,0) bakışla paralel kalır; +Z'ye çevir.
  const vertical = Math.abs(u[1]) > 0.99;
  const up: [number, number, number] = vertical ? [0, 0, 1] : [0, 1, 0];
  return {
    name,
    position: [center[0] + u[0] * distance, center[1] + u[1] * distance, center[2] + u[2] * distance],
    target: [center[0], center[1], center[2]],
    up,
    near: Math.max(radius / 100, 0.05),
    far: distance + radius * 10
  };
}

export interface InspectionView {
  name: string;
  /** PNG data URL */
  dataUrl: string;
}

/**
 * Modelin 6 görünümlü denetim sayfasını üretir (yalnız tarayıcı).
 * Her görünüm ayrı bir PNG data URL'si olarak döner.
 */
export function renderInspectionSheet(parts: ExecutedPart[], size = 512): InspectionView[] {
  if (parts.length === 0) throw new Error('Denetim sayfası için parça yok.');

  const box = new THREE.Box3();
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
  }
  if (box.isEmpty()) throw new Error('Denetim sayfası için geometri boş.');
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const radius = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, sizeVec.length()) * 0.62;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f2f1ee');
    scene.add(new THREE.HemisphereLight('#ffffff', '#b8b8b2', 1.0));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(center.x + radius * 2, center.y + radius * 3, center.z + radius * 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#cfe9ef', 0.5);
    fill.position.set(center.x - radius * 2, center.y + radius, center.z - radius * 2);
    scene.add(fill);

    for (const part of parts) {
      const mesh = new THREE.Mesh(
        part.geometry,
        new THREE.MeshStandardMaterial({
          color: part.color ?? '#00b8d4',
          metalness: 0.1,
          roughness: 0.5
        })
      );
      scene.add(mesh);
    }

    const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, radius / 100, radius * 100);
    const views: InspectionView[] = [];
    for (const spec of INSPECTION_VIEWS) {
      const framed = frameView([center.x, center.y, center.z], radius, spec.direction, spec.name);
      camera.position.set(...framed.position);
      camera.up.set(...framed.up);
      camera.lookAt(new THREE.Vector3(...framed.target));
      camera.near = framed.near;
      camera.far = framed.far;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      views.push({ name: spec.name, dataUrl: renderer.domElement.toDataURL('image/png') });
    }
    return views;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
