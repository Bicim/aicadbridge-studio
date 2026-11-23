import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Seyrek değişen kütüphaneler kendi parçalarında: uygulama kodu her yayında değişse de
   tarayıcı önbelleğindeki react / auth / three dosyaları geçerli kalır. */
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
  if (/node_modules[\\/](@supabase|tslib)[\\/]/.test(id)) return 'auth';
  if (/node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons';
  // three çekirdeği + OrbitControls: bulut görüntüleyici ve yerel mod ortak kullanır.
  if (/node_modules[\\/]three[\\/](build[\\/]|examples[\\/]jsm[\\/]controls[\\/]OrbitControls)/.test(id)) return 'three';
  return undefined;
}

// GitHub Pages proje alt dizini: /aicadbridge-studio/
export default defineConfig({
  plugins: [react()],
  base: '/aicadbridge-studio/',
  build: {
    rollupOptions: { output: { manualChunks: vendorChunk } },
    // Tek büyük parça three.js çekirdeği (~575 kB, gzip ~145 kB); yalnız 3B görüntüleyici / yerel mod açılınca yüklenir.
    chunkSizeWarningLimit: 600
  },
  test: {
    environment: 'node'
  }
} as ReturnType<typeof defineConfig>);
