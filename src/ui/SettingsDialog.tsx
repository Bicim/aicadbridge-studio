/* ============================================================
   SettingsDialog.tsx - sağlayıcı / anahtar / model ayarları
   Fusion paletindeki Ayarlar sekmesinin karşılığı: sağlayıcı
   seç, anahtarını gir, "Modelleri Listele" ile güncel listeyi
   çek ya da adı elle yaz. Her şey localStorage'da kalır.
   ============================================================ */

import { useEffect, useState } from 'react';
import { PROVIDERS, listModels, type AiConfig, type ProviderId } from '../ai/providers';

interface Props {
  settings: AiConfig;
  onClose: () => void;
  onSave: (patch: Partial<AiConfig>) => void;
}

export function SettingsDialog({ settings, onClose, onSave }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setModels([]);
    setListError(null);
  }, [settings.provider]);

  const providerMeta = PROVIDERS[settings.provider];

  const handleList = async () => {
    setListing(true);
    setListError(null);
    try {
      const ids = await listModels(settings);
      setModels(ids.slice(0, 300));
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ayarlar">
        <h2>Ayarlar</h2>

        <label className="field">
          <span>Sağlayıcı</span>
          <select
            value={settings.provider}
            onChange={(e) => onSave({ provider: e.target.value as ProviderId })}
          >
            {Object.entries(PROVIDERS).map(([id, meta]) => (
              <option key={id} value={id}>{meta.label}</option>
            ))}
          </select>
        </label>

        {providerMeta.needsBaseUrl ? (
          <label className="field">
            <span>Temel URL (OpenAI-uyumlu)</span>
            <input
              type="text"
              value={settings.baseUrl ?? ''}
              placeholder={providerMeta.defaultBaseUrl}
              onChange={(e) => onSave({ baseUrl: e.target.value.trim() })}
            />
            <small>DeepSeek: https://api.deepseek.com/v1 · Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1</small>
          </label>
        ) : null}

        <label className="field">
          <span>API Anahtarı</span>
          <input
            type="password"
            value={settings.apiKey}
            placeholder={providerMeta.keyHint}
            onChange={(e) => onSave({ apiKey: e.target.value.trim() })}
          />
          <small>Anahtar yalnızca bu tarayıcıda saklanır; seçtiğin sağlayıcı dışına gönderilmez.</small>
        </label>

        <label className="field">
          <span>Model</span>
          <input
            type="text"
            value={settings.model}
            placeholder="ör. gpt-4o / claude-sonnet-4-5 / gemini-2.0-flash"
            onChange={(e) => onSave({ model: e.target.value.trim() })}
            list="model-list"
          />
          <datalist id="model-list">
            {models.map((id) => <option key={id} value={id} />)}
          </datalist>
        </label>

        <div className="modal__row">
          <button className="btn btn--ghost" onClick={handleList} disabled={listing}>
            {listing ? 'Listeleniyor...' : 'Modelleri Listele'}
          </button>
          {listError ? <span className="field-error">{listError}</span> : null}
        </div>

        {models.length > 0 ? (
          <div className="model-list">
            {models.slice(0, 40).map((id) => (
              <button
                key={id}
                className={'model-chip' + (settings.model === id ? ' model-chip--active' : '')}
                onClick={() => onSave({ model: id })}
              >
                {id}
              </button>
            ))}
            {models.length > 40 ? <small>+{models.length - 40} model daha (yukarıya yazabilirsin)</small> : null}
          </div>
        ) : null}

        <label className="field field--check">
          <input
            type="checkbox"
            checked={settings.vision !== false}
            onChange={(e) => onSave({ vision: e.target.checked })}
          />
          <span>
            Görsel doğrulama
            <small>Üretim sonrası modeli 6 yönden fotoğraflayıp görüntü destekli modele denetletir (CADAM denetim sayfası). Görsel destekleyen bir model gerekir; kapatınca yalnızca sayısal doğrulama yapılır.</small>
          </span>
        </label>

        <div className="modal__row modal__row--end">
          <button className="btn btn--primary" onClick={onClose}>Tamam</button>
        </div>
      </div>
    </div>
  );
}
