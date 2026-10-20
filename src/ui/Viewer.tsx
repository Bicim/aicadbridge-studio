/* ============================================================
   Viewer.tsx - three.js sahnesi
   Parçalar değişince grup yeniden kurulur; kamera otomatik
   çerçeveler. OrbitControls: sürükle-döndür, tekerlek-zoom.
   ============================================================ */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ExecutedPart } from '../core/types';

interface Props {
  parts: ExecutedPart[];
  /** İlk kurulumdan sonra kamerayı yeniden çerçeveler */
  frameKey: string;
}

export function Viewer({ parts, frameKey }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    modelGroup: THREE.Group;
    parts: ExecutedPart[];
  } | null>(null);

  /* Sahneyi bir kez kur */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0d0c');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    camera.position.set(140, 110, 140);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight('#cfe9ef', '#141414', 1.1));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(200, 320, 160);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#7fd6e8', 0.5);
    fill.position.set(-220, 120, -180);
    scene.add(fill);

    const grid = new THREE.GridHelper(400, 40, 0x2a2a28, 0x1a1a19);
    grid.position.y = -0.01;
    scene.add(grid);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    sceneRef.current = { scene, camera, renderer, controls, modelGroup, parts: [] };

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  /* Parçalar değişince grubu yeniden kur */
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    // Eski kaynakları temizle
    for (const child of [...ctx.modelGroup.children]) {
      ctx.modelGroup.remove(child);
      const mesh = child as THREE.Mesh;
      if (mesh.material) (mesh.material as THREE.Material).dispose();
      // Geometrilerin sahibi execution sonucudur; yalnız doku/material bizim
    }

    for (const part of parts) {
      const material = new THREE.MeshStandardMaterial({
        color: part.color ?? '#00b8d4',
        metalness: 0.15,
        roughness: 0.45
      });
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.castShadow = false;
      ctx.modelGroup.add(mesh);
    }
    ctx.parts = parts;
  }, [parts]);

  /* Yeni model geldiğinde kamerayı çerçeveler */
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || ctx.parts.length === 0) return;
    const box = new THREE.Box3().setFromObject(ctx.modelGroup);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.6 + 1;
    ctx.controls.target.copy(center);
    ctx.camera.position.set(
      center.x + radius * 1.6,
      center.y + radius * 1.25,
      center.z + radius * 1.6
    );
    ctx.camera.near = Math.max(radius / 100, 0.05);
    ctx.camera.far = radius * 100;
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();
  }, [frameKey]);

  return <div className="viewer" ref={mountRef} />;
}
