/* ============================================================
   state.ts - ayar kalıcılığı (localStorage)
   Anahtarlar tarayıcıda kalır; hiçbir yere gönderilmez
   (sağlayıcıya doğrudan istek dışında).
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import type { AiConfig, ProviderId } from './ai/providers';

const STORAGE_KEY = 'aicad-studio-settings-v1';

export function loadSettings(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AiConfig;
      if (parsed && typeof parsed.provider === 'string') return parsed;
    }
  } catch { /* bozuk kayıt: varsayılana dön */ }
  return { provider: 'openai', apiKey: '', model: '', baseUrl: '', vision: true };
}

export function useSettings() {
  const [settings, setSettings] = useState<AiConfig>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* kota dolu olabilir */ }
  }, [settings]);

  const update = useCallback((patch: Partial<AiConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.provider && patch.provider !== prev.provider) {
        next.model = ''; // sağlayıcı değişince model sıfırla
      }
      return next;
    });
  }, []);

  return { settings, update };
}

export type { AiConfig, ProviderId };
