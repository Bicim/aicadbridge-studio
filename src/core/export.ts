/* ============================================================
   export.ts - tarayıcıda dışa aktarma: STL, 3MF, GLTF, GLB,
   ModelIR JSON
   ------------------------------------------------------------
   Dışa aktarma seti earthtojake/text-to-cad (MIT) projesinden
   esinlenmiştir: STEP/GLB/STL/3MF setinin tarayıcıda üretile-
   bilen üyeleri. STL ve 3MF, dilimleyicilerin beklediği
   Z-yukarı düzenine çevrilerek yazılır (studio Y-yukarı üretir;
   glTF standardı Y-yukarıdır, o olduğu gibi kalır). 3MF bir
   OPC/ZIP paketidir: [Content_Types].xml + _rels/.rels +
   3D/3dmodel.model; parça başına renkli nesne.
   ============================================================ */

import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { ExecutedPart, ModelIR } from './types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Y-yukarı (studio) -> Z-yukarı (dilimleyici / 3MF) dönüşümü. */
const Y_UP_TO_Z_UP = new THREE.Matrix4().makeRotationX(Math.PI / 2);

function partsToGroup(parts: ExecutedPart[], zUp = false): THREE.Group {
  const group = new THREE.Group();
  for (const part of parts) {
    const geometry = zUp ? part.geometry.clone().applyMatrix4(Y_UP_TO_Z_UP) : part.geometry;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: part.color ?? '#00b8d4' })
    );
    group.add(mesh);
  }
  return group;
}

/* ---------------- STL ---------------- */

export function exportSTL(parts: ExecutedPart[], name: string) {
  const exporter = new STLExporter();
  const binary = exporter.parse(partsToGroup(parts, true), { binary: true }) as unknown as DataView;
  download(new Blob([binary.buffer as ArrayBuffer], { type: 'model/stl' }), `${name}.stl`);
}

/* ---------------- glTF / GLB ---------------- */

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

export function exportGLB(parts: ExecutedPart[], name: string) {
  const exporter = new GLTFExporter();
  exporter.parse(
    partsToGroup(parts),
    (result) => {
      download(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }), `${name}.glb`);
    },
    () => { throw new Error('GLB dışa aktarma başarısız.'); },
    { binary: true }
  );
}

/* ---------------- 3MF ---------------- */

export interface ThreemfDocuments {
  '[Content_Types].xml': string;
  '_rels/.rels': string;
  '3D/3dmodel.model': string;
}

function num(v: number): string {
  const r = Math.round(v * 10000) / 10000;
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** 3MF belge üçlüsünü kurur (saf işlev; test edilir). */
export function build3mfDocuments(parts: ExecutedPart[]): ThreemfDocuments {
  const materials: string[] = [];
  const objects: string[] = [];
  parts.forEach((part, i) => {
    const geom = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const verts: string[] = [];
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      // Y-yukarı -> Z-yukarı: (x, y, z) -> (x, -z, y)
      verts.push(`<vertex x="${num(x)}" y="${num(-z)}" z="${num(y)}"/>`);
    }
    const tris: string[] = [];
    for (let t = 0; t + 2 < pos.count; t += 3) {
      tris.push(`<triangle v1="${t}" v2="${t + 1}" v3="${t + 2}"/>`);
    }
    const color = (part.color ?? '#00b8d4').replace('#', '').toUpperCase();
    materials.push(`<base name="malzeme${i + 1}" displaycolor="#${color}FF"/>`);
    objects.push(
      `<object id="${i + 1}" type="model" pid="1" pindex="${i}">` +
      `<mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh>` +
      `</object>`
    );
  });

  const model =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    `<resources><basematerials id="1">${materials.join('')}</basematerials>${objects.join('')}</resources>` +
    `<build>${parts.map((_, i) => `<item objectid="${i + 1}"/>`).join('')}</build>` +
    '</model>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    '</Relationships>';

  return {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rels,
    '3D/3dmodel.model': model
  };
}

export function export3MF(parts: ExecutedPart[], name: string) {
  const docs = build3mfDocuments(parts);
  const zipped = zipSync({
    '[Content_Types].xml': strToU8(docs['[Content_Types].xml']),
    '_rels/.rels': strToU8(docs['_rels/.rels']),
    '3D/3dmodel.model': strToU8(docs['3D/3dmodel.model'])
  });
  download(new Blob([zipped as BlobPart], { type: 'model/3mf' }), `${name}.3mf`);
}

/* ---------------- ModelIR ---------------- */

export function exportIR(ir: ModelIR) {
  download(new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' }), `${ir.name || 'model'}.ir.json`);
}
