import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages proje alt dizini: /aicadbridge-studio/
export default defineConfig({
  plugins: [react()],
  base: '/aicadbridge-studio/',
  build: {
    chunkSizeWarningLimit: 1600
  },
  test: {
    environment: 'node'
  }
} as ReturnType<typeof defineConfig>);
