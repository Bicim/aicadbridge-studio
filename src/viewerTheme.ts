/* 3B görüntüleyici renkleri tasarım token'larından (--viewer-*) okunur; sistem teması değişince yeniden uygulanır. */
export interface ViewerTheme { bg: string; grid: string; grid2: string }

export function readViewerTheme(el: Element): ViewerTheme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { bg: v('--viewer-bg', '#111113'), grid: v('--viewer-grid', '#2e2e33'), grid2: v('--viewer-grid-2', '#1c1c20') };
}

export function onSchemeChange(cb: () => void): () => void {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;
  if (!mq) return () => undefined;
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
