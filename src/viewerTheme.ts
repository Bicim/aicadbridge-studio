/* 3B görüntüleyici renkleri tasarım token'larından (--viewer-*) okunur; sistem teması ya da <html data-theme> değişince yeniden uygulanır. */
export interface ViewerTheme { bg: string; bg2: string; grid: string; grid2: string; model: string; edge: string; accent: string; dim: string }

export function readViewerTheme(el: Element): ViewerTheme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--viewer-bg', '#0a0d11'), bg2: v('--viewer-bg-2', '#121722'),
    grid: v('--viewer-grid', '#232b36'), grid2: v('--viewer-grid-2', '#151a22'),
    model: v('--viewer-model', '#a9b6c6'), edge: v('--viewer-edge', '#0b0f14'),
    accent: v('--accent', '#00b8d4'), dim: v('--dim', '#ff7a45'),
  };
}

export function onSchemeChange(cb: () => void): () => void {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;
  mq?.addEventListener('change', cb);
  // Ayarlar > Görünüm <html data-theme> özniteliğini değiştirir; stil hesabı güncellendikten sonra çalışsın.
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(cb) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => { mq?.removeEventListener('change', cb); mo?.disconnect(); };
}
