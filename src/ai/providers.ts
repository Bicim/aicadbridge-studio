/* ============================================================
   providers.ts - tarayıcıdan çoklu sağlayıcı
   AICADBridge Fusion paletindeki models.py/registry.py mimarisinin
   web karşılığı: kullanıcı kendi API anahtarını girer, kod
   sağlayıcıya özel uç noktaları bilir. Backend yok; CORS'u
   destekleyen sağlayıcılarla çalışır (Anthropic için resmi
   tarayıcı erişimi başlığı kullanılır).
   ============================================================ */

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';

export interface AiConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** custom için: OpenAI-uyumlu kök URL (ör. https://api.deepseek.com/v1) */
  baseUrl?: string;
  /** Görsel doğrulama (6 görünümlü denetim sayfası) açık mı; yoksa true sayılır */
  vision?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** PNG data URL'leri; yalnız user mesajlarında, görsel destekli modellerde */
  images?: string[];
}

export interface ChatOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

export const PROVIDERS: Record<ProviderId, { label: string; needsBaseUrl: boolean; defaultBaseUrl?: string; keyHint: string }> = {
  openai: { label: 'OpenAI', needsBaseUrl: false, keyHint: 'sk-...' },
  anthropic: { label: 'Anthropic (Claude)', needsBaseUrl: false, keyHint: 'sk-ant-...' },
  google: { label: 'Google (Gemini)', needsBaseUrl: false, keyHint: 'AIza...' },
  openrouter: { label: 'OpenRouter', needsBaseUrl: false, keyHint: 'sk-or-...' },
  custom: {
    label: 'OpenAI-uyumlu (DeepSeek, Ollama, LM Studio...)',
    needsBaseUrl: true,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'sağlayıcıya göre'
  }
};

function openAiBase(cfg: AiConfig): string {
  if (cfg.provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (cfg.provider === 'custom') return (cfg.baseUrl || PROVIDERS.custom.defaultBaseUrl!).replace(/\/$/, '');
  return 'https://api.openai.com/v1';
}

async function readError(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = await res.text();
    detail = body.slice(0, 400);
  } catch { /* gövde okunamadı */ }
  return `HTTP ${res.status} ${res.statusText}${detail ? ' · ' + detail : ''}`;
}

/** data URL'ini mime + base64 parçalarına ayırır. */
function dataUrlParts(url: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(url.trim());
  if (!m) throw new Error('Görsel beklenen biçimde değil (data:image/png;base64,... gerekiyor).');
  return { mime: m[1], base64: m[2] };
}

/* ---------------- modelleri listele ---------------- */

export async function listModels(cfg: AiConfig): Promise<string[]> {
  if (!cfg.apiKey && cfg.provider !== 'custom') throw new Error('Önce API anahtarını gir.');
  if (cfg.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => m.id);
  }
  if (cfg.provider === 'google') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cfg.apiKey)}`);
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return (data.models ?? [])
      .map((m: { name: string }) => String(m.name).replace(/^models\//, ''))
      .filter((id: string) => !id.includes('embedding') && !id.includes('aqa'));
  }
  // OpenAI-uyumlu
  const res = await fetch(`${openAiBase(cfg)}/models`, {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const ids = (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
  if (!ids.length) throw new Error('Sağlayıcı model listesi boş döndü.');
  return ids;
}

/* ---------------- sohbet ---------------- */

export async function chat(cfg: AiConfig, opts: ChatOptions): Promise<string> {
  if (!cfg.apiKey && cfg.provider !== 'custom') throw new Error('API anahtarı eksik. Ayarlar\'dan gir.');
  if (!cfg.model) throw new Error('Model seçilmedi. Ayarlar\'dan seç veya yaz.');

  if (cfg.provider === 'anthropic') return chatAnthropic(cfg, opts);
  if (cfg.provider === 'google') return chatGoogle(cfg, opts);
  return chatOpenAiCompatible(cfg, opts);
}

async function chatAnthropic(cfg: AiConfig, opts: ChatOptions): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.images?.length
          ? [
              ...m.images.map((url) => {
                const { mime, base64 } = dataUrlParts(url);
                return { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
              }),
              { type: 'text', text: m.content }
            ]
          : m.content
      }))
    })
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  if (!text) throw new Error('Anthropic boş yanıt döndü.');
  return text;
}

async function chatGoogle(cfg: AiConfig, opts: ChatOptions): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: m.images?.length
          ? [
              ...m.images.map((url) => {
                const { mime, base64 } = dataUrlParts(url);
                return { inline_data: { mime_type: mime, data: base64 } };
              }),
              { text: m.content }
            ]
          : [{ text: m.content }]
      })),
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 8000 }
    })
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini boş yanıt döndü (model adını kontrol et).');
  return text;
}

async function chatOpenAiCompatible(cfg: AiConfig, opts: ChatOptions): Promise<string> {
  const res = await fetch(`${openAiBase(cfg)}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'content-type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 8000,
      messages: [
        { role: 'system', content: opts.system },
        ...opts.messages.map((m) => ({
          role: m.role,
          content: m.images?.length
            ? [
                { type: 'text', text: m.content },
                ...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))
              ]
            : m.content
        }))
      ]
    })
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Sağlayıcı boş yanıt döndü.');
  return typeof text === 'string' ? text : String(text);
}

/* ---------------- yardımcılar ---------------- */

/** Model yanıtından ilk JSON nesnesini çıkarır (```json bloklarına da katlanır). */
export function extractJson<T = unknown>(text: string): T {
  let src = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(src);
  if (fence) src = fence[1].trim();
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Yanıtta JSON bulunamadı. Model tam JSON döndürmedi.');
  }
  try {
    return JSON.parse(src.slice(start, end + 1)) as T;
  } catch (e) {
    throw new Error(`JSON çözümlenemedi: ${(e as Error).message}`);
  }
}
