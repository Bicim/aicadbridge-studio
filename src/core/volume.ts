/* ============================================================
   volume.ts - kapalı üçgen ağı için işaretli hacim (divergence)
   mm^3 cinsinden. Doğrulamada (verify) kullanılır: delik açılınca
   hacim düşmeli, gövde birleşince artmalı.
   ============================================================ */

import type * as THREE from 'three';

export function meshVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  if (!pos) return 0;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  let volume = 0;
  const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }, c = { x: 0, y: 0, z: 0 };
  const read = (i: number, target: { x: number; y: number; z: number }) => {
    target.x = pos.getX(i);
    target.y = pos.getY(i);
    target.z = pos.getZ(i);
  };
  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    read(i0, a);
    read(i1, b);
    read(i2, c);
    volume +=
      (a.x * (b.y * c.z - c.y * b.z) -
        b.x * (a.y * c.z - c.y * a.z) +
        c.x * (a.y * b.z - b.y * a.z)) / 6;
  }
  return volume;
}
