/* Görünüm tercihi: Sistem / Koyu / Açık. localStorage['aicb-theme'] + <html data-theme> (ön-boyama betiği index.html'de). */
export type ThemeChoice = 'system' | 'dark' | 'light';
const KEY = 'aicb-theme';

export function getTheme(): ThemeChoice {
  try { const t = localStorage.getItem(KEY); return t === 'dark' || t === 'light' ? t : 'system'; } catch { return 'system'; }
}

export function setTheme(t: ThemeChoice): void {
  const el = document.documentElement;
  if (t === 'system') delete el.dataset.theme; else el.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* gizli pencere */ }
}
