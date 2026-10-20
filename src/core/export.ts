/* ============================================================
   export.ts - tarayıcıda dışa aktarma: STL, GLTF, ModelIR JSON
   ============================================================ */

import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { ExecutedPart, ModelIR } from './types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function partsToGroup(parts: ExecutedPart[]): THREE.Group {
  const group = new THREE.Group();
  for (const part of parts) {
    const mesh = new THREE.Mesh(
      part.geometry,
      new THREE.MeshStandardMaterial({ color: part.color ?? '#00b8d4' })
    );
    group.add(mesh);
  }
  return group;
}

export function exportSTL(parts: ExecutedPart[], name: string) {
  const exporter = new STLExporter();
  const binary = exporter.parse(partsToGroup(parts), { binary: true }) as unknown as DataView;
  download(new Blob([binary.buffer as ArrayBuffer], { type: 'model/stl' }), `${name}.stl`);
}

export function exportGLTF(parts: ExecutedPart[], name: string) {
  const exporter = new GLTFExporter();
  exporter.parse(
    partsToGroup(parts),
    (result) => {
      download(new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }), `${name}.gltf`);
    },
    () => { throw new Error('GLTF dışa aktarma başarısız.'); }
  );
}

export function exportIR(ir: ModelIR) {
  download(new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' }), `${ir.name || 'model'}.ir.json`);
}
