/* ============================================================
   vision.test.ts - görsel doğrulama testleri
   Görünüm geometrisi (saf matematik), denetim promptları,
   sağlayıcı başına çok modlu mesaj gövdeleri (fetch alaylanır)
   ve yapılandırılmış karar çözümlemesi.
   ============================================================ */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSPECTION_VIEWS, frameView } from '../src/core/snapshot';
import { buildVisionUserPrompt, VISION_SYSTEM } from '../src/ai/prompts';
import { chat, type AiConfig, type ChatOptions } from '../src/ai/providers';
import { parseVisionReport } from '../src/ai/vision';

describe('denetim görünümleri', () => {
  it('6 görünüm: benzersiz adlar, normalize edilebilir yönler', () => {
    expect(INSPECTION_VIEWS).toHaveLength(6);
    const names = INSPECTION_VIEWS.map((v) => v.name);
    expect(new Set(names).size).toBe(6);
    for (const v of INSPECTION_VIEWS) {
      const len = Math.hypot(...v.direction);
      expect(len).toBeGreaterThan(0.01);
      expect(len).toBeLessThan(2.0);
    }
  });

  it('frameView: kamera merkezden yönde, uzaklık yarıçapa bağlı, hedef merkez', () => {
    const center: [number, number, number] = [10, 20, 5];
    const radius = 30;
    const framed = frameView(center, radius, [0, 0, 1], 'ön');
    expect(framed.target).toEqual(center);
    expect(framed.position[0]).toBeCloseTo(10);
    expect(framed.position[1]).toBeCloseTo(20);
    expect(framed.position[2]).toBeGreaterThan(center[2] + radius); // dışarıda
    expect(framed.up).toEqual([0, 1, 0]);
    expect(framed.near).toBeGreaterThan(0);
    expect(framed.far).toBeGreaterThan(framed.position[2] - center[2]);
  });

  it('frameView: dikey bakışta up +Z olur; izometrik eğik kalır', () => {
    const top = frameView([0, 0, 0], 10, [0.001, 1, 0.001], 'üst');
    expect(top.up).toEqual([0, 0, 1]);
    expect(top.position[1]).toBeGreaterThan(10);
    const iso = frameView([0, 0, 0], 10, [1, 0.75, 1], 'izometrik');
    expect(iso.up).toEqual([0, 1, 0]);
    expect(iso.position[0]).toBeCloseTo(iso.position[2], 5);
  });

  it('frameView: sıfır yön ve sıfır yarıçap hata fırlatır', () => {
    expect(() => frameView([0, 0, 0], 10, [0, 0, 0])).toThrow();
    expect(() => frameView([0, 0, 0], 0, [0, 0, 1])).toThrow();
  });
});

describe('görsel denetim promptları', () => {
  it('sistem promptu JSON şeması ister, dikiş/üçgenleme pürüzünü dışlar', () => {
    expect(VISION_SYSTEM).toContain('"ok"');
    expect(VISION_SYSTEM).toContain('"issues"');
    expect(VISION_SYSTEM).toContain('dikiş');
    expect(VISION_SYSTEM).toContain('Yalnızca JSON');
  });

  it('kullanıcı promptu istek ve plan adını taşır, görünüm sırasını sayar', () => {
    const p = buildVisionUserPrompt('40mm küp, üstünde delik', 'kup_delikli', ['gövde', 'delik']);
    expect(p).toContain('40mm küp, üstünde delik');
    expect(p).toContain('kup_delikli');
    expect(p).toContain('izometrik, ön, arka, sağ, sol, üst');
  });
});

describe('karar çözümlemesi (parseVisionReport)', () => {
  it(' uygun: ok true + boş issues', () => {
    const r = parseVisionReport({ ok: true, issues: [] });
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('sorunlu: ok false + sayılı sorun listesi', () => {
    const r = parseVisionReport({ ok: false, issues: ['delik eksik', 'simetri bozuk', 'x'] });
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(3);
  });

  it('ok true ama issues dolu: tutarsızlık güvenli tarafa gider', () => {
    expect(parseVisionReport({ ok: true, issues: ['bir sorun'] }).ok).toBe(false);
  });

  it('sorun olmayan ve boş dizge girdiler süzülür, en fazla 5 kalır', () => {
    const r = parseVisionReport({ ok: false, issues: [1, '', '  ', 'gerçek', null, 'a', 'b', 'c', 'd', 'e', 'f'] });
    expect(r.issues.every((i) => typeof i === 'string' && i.trim().length > 0)).toBe(true);
    expect(r.issues.length).toBeLessThanOrEqual(5);
  });

  it('nesne olmayan yanıt hata fırlatır', () => {
    expect(() => parseVisionReport('metin')).toThrow();
    expect(() => parseVisionReport(null)).toThrow();
  });
});

/* ---------------- çok modlu mesaj gövdeleri ---------------- */

const PNG = 'data:image/png;base64,aVBORw0KGgo=';

function mockFetch(response: unknown): string[] {
  const bodies: string[] = [];
  const fn = async (_url: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body ?? ''));
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  vi.stubGlobal('fetch', vi.fn(fn));
  return bodies;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseCfg: AiConfig = { provider: 'openai', apiKey: 'k', model: 'm' };

const opts = (provider: AiConfig['provider']): { cfg: AiConfig; opts: ChatOptions } => ({
  cfg: { ...baseCfg, provider },
  opts: {
    system: 'denetçi',
    messages: [{ role: 'user', content: 'denetle', images: [PNG] }],
    maxTokens: 100
  }
});

describe('çok modlu mesaj gövdeleri (sağlayıcı başına)', () => {
  it('OpenAI-uyumlu: image_url blokları', async () => {
    const bodies = mockFetch({ choices: [{ message: { content: 'tamam' } }] });
    const { cfg, opts: o } = opts('openai');
    await expect(chat(cfg, o)).resolves.toBe('tamam');
    const body = JSON.parse(bodies[0]);
    const msg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(Array.isArray(msg.content)).toBe(true);
    expect(msg.content[0]).toEqual({ type: 'text', text: 'denetle' });
    expect(msg.content[1]).toEqual({ type: 'image_url', image_url: { url: PNG } });
  });

  it('Anthropic: base64 image blokları, metin sonda', async () => {
    const bodies = mockFetch({ content: [{ type: 'text', text: 'tamam' }] });
    const { cfg, opts: o } = opts('anthropic');
    await expect(chat(cfg, o)).resolves.toBe('tamam');
    const body = JSON.parse(bodies[0]);
    const msg = body.messages[0];
    expect(msg.content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aVBORw0KGgo=' }
    });
    expect(msg.content[1]).toEqual({ type: 'text', text: 'denetle' });
  });

  it('Google: inline_data parçaları', async () => {
    const bodies = mockFetch({ candidates: [{ content: { parts: [{ text: 'tamam' }] } }] });
    const { cfg, opts: o } = opts('google');
    await expect(chat(cfg, o)).resolves.toBe('tamam');
    const body = JSON.parse(bodies[0]);
    const parts = body.contents[0].parts;
    expect(parts[0]).toEqual({ inline_data: { mime_type: 'image/png', data: 'aVBORw0KGgo=' } });
    expect(parts[1]).toEqual({ text: 'denetle' });
  });

  it('görselsiz mesaj eskisi gibi düz metin kalır', async () => {
    const bodies = mockFetch({ choices: [{ message: { content: 'tamam' } }] });
    await chat(baseCfg, {
      system: 's',
      messages: [{ role: 'user', content: 'düz' }],
      maxTokens: 10
    });
    const body = JSON.parse(bodies[0]);
    expect(body.messages.find((m: { role: string }) => m.role === 'user').content).toBe('düz');
  });

  it('bozuk data URL hata fırlatır (Anthropic yolu çözümleme yapar)', async () => {
    mockFetch({});
    await expect(chat({ ...baseCfg, provider: 'anthropic' }, {
      system: 's',
      messages: [{ role: 'user', content: 'x', images: ['http://ornek.com/a.png'] }],
      maxTokens: 10
    })).rejects.toThrow('data:image/png');
  });
});
