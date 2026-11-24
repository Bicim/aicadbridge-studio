/* Bulut çekirdeğin ürettiği GLB önizlemesi: yörünge kamera, kenar çizgileri, otomatik çerçeveleme.
   İsteğe bağlı çizim: kare yalnız kamera hareket ederken, model yüklenince ve boyut değişince çizilir;
   boştayken GPU/CPU harcamaz. */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { onSchemeChange, readViewerTheme } from '../viewerTheme';

export function ModelViewer({ url, height = 320 }: { url: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setErr(null);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0); // zemin gradyanı CSS'ten (.c-viewer)
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100000);
    scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x1a1c20, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let raf = 0;
    const frame = () => { raf = 0; controls.update(); renderer.render(scene, camera); };
    // controls.update() kamera değiştikçe 'change' yayar; sönümleme bitince döngü kendiliğinden durur.
    const invalidate = () => { if (!raf) raf = requestAnimationFrame(frame); };
    controls.addEventListener('change', invalidate);

    const resize = () => {
      const w = el.clientWidth || 1;
      renderer.setSize(w, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      invalidate();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let disposed = false;
    let grid: THREE.GridHelper | null = null;
    let buildGrid = () => undefined as void;
    const t0 = readViewerTheme(el);
    const material = new THREE.MeshStandardMaterial({ color: t0.model, metalness: 0.35, roughness: 0.42 });
    const edgeMat = new THREE.LineBasicMaterial({ color: t0.edge, transparent: true, opacity: 0.6 });
    // Tema (sistem ya da Ayarlar > Görünüm) değişince model, kenar ve ızgara renkleri token'lardan yeniden okunur.
    const offScheme = onSchemeChange(() => {
      const t = readViewerTheme(el);
      material.color.set(t.model); edgeMat.color.set(t.edge);
      buildGrid(); invalidate();
    });
    new GLTFLoader().load(url, (gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      root.scale.setScalar(1000); // glTF metre → sahne milimetre (ızgara ve kamera mm ölçeğinde)
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = material;
          m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), edgeMat));
        }
      });
      scene.add(root);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const r = Math.max(size.length() / 2, 0.5);
      buildGrid = () => {
        const t = readViewerTheme(el);
        if (grid) { scene.remove(grid); grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); }
        grid = new THREE.GridHelper(r * 6, 24, t.grid, t.grid2);
        grid.position.set(center.x, box.min.y, center.z);
        scene.add(grid);
      };
      buildGrid();
      controls.target.copy(center);
      camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1.2).normalize().multiplyScalar(r * 3.2));
      camera.near = r / 100; camera.far = r * 100;
      camera.updateProjectionMatrix();
      invalidate();
    }, undefined, () => !disposed && setErr('Önizleme yüklenemedi'));

    return () => {
      disposed = true;
      offScheme();
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
      material.dispose(); edgeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, height]);

  return (
    <div className="c-viewer" ref={host} style={{ height }}>
      {err && <div className="c-viewer-err">{err}</div>}
    </div>
  );
}
