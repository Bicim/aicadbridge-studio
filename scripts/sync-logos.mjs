#!/usr/bin/env node
/* Uygulama logolarını ortak paketten alır (kaynak/lisans: paketteki manifest.json + SOURCES.md).
   Kullanım:  node scripts/sync-logos.mjs [paket-klasörü]   (varsayılan: ../../assets/logos)
   - Yalnız katalog kimlikleri (src/cloud/integrations.ts) için <kimlik>.svg dosyalarını public/logos/ içine kopyalar.
   - SOURCES.md'yi public/logos/ içine kopyalar.
   - src/cloud/logos.ts dosyasını üretir: dosyası olan kimlikler ve biçimleri (eksik dosya hiç istenmez). */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pack = resolve(process.argv[2] ?? join(root, '..', '..', 'assets', 'logos'));
const outDir = join(root, 'public', 'logos');
const outTs = join(root, 'src', 'cloud', 'logos.ts');
const OWN_ICONS = new Set(['mcp', 'apikeys']); // kendi simgelerimiz, logo değil
// Kendi opak karosuyla gelen üretici simgeleri: karonun tamamını kaplar (paket notu).
const OWN_TILE = new Set(['onshape', 'kicad', 'mcmaster', 'typeform', 'calcom']);

const catalogSrc = readFileSync(join(root, 'src', 'cloud', 'integrations.ts'), 'utf8');
const ids = new Set([...catalogSrc.matchAll(/\bid: '([a-z0-9_]+)', name:|\b(?:folder|soon)\('([a-z0-9_]+)'/g)].map((m) => m[1] ?? m[2]));
for (const id of OWN_ICONS) ids.delete(id);

const manifestPath = join(pack, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
if (!manifest) console.warn(`manifest.json yok: ${manifestPath} — tüm girdiler harf simgesine düşer.`);
const entries = Array.isArray(manifest) ? Object.fromEntries(manifest.map((e) => [e.key ?? e.id, e])) : (manifest ?? {});

/** Tek renkli vektör işaretin tonu: 'light' = hep beyaza yakın (açık temada ters çevrilir), 'dark' = hep siyaha yakın. */
function tone(svg) {
  if (/<image\b/i.test(svg)) return null; // gömülü bitmap: tonu yok
  const hex = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*"?\s*(#[0-9a-f]{3,6}|white|black)\b/gi)].map((m) => m[1].toLowerCase());
  // Dolgusu belirtilmemiş şekil, kökte ya da grupta dolgu yoksa siyah çizilir.
  const bare = [...svg.matchAll(/<(?:path|rect|circle|ellipse|polygon|polyline)\b([^>]*)>/gi)].some((m) => !/\bfill\s*[=:]/i.test(m[1]));
  if (bare && !/<(?:svg|g)\b[^>]*\bfill\s*=/i.test(svg)) hex.push('#000000');
  if (!hex.length) return null;
  const rgb = hex.map((h) => h === 'white' ? [255, 255, 255] : h === 'black' ? [0, 0, 0]
    : (h.length === 4 ? [...h.slice(1)].map((c) => parseInt(c + c, 16)) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))));
  if (rgb.every((c) => Math.min(...c) >= 0xd0)) return 'light';
  if (rgb.every((c) => Math.max(...c) <= 0x40)) return 'dark';
  return null;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const logos = {};
for (const id of [...ids].sort()) {
  const e = entries[id];
  const file = e ? join(pack, e.file ?? `${id}.svg`) : null;
  if (!e || !file || !existsSync(file)) continue;
  const svg = readFileSync(file, 'utf8');
  if (/<script|\son\w+\s*=|<foreignObject|(?:xlink:)?href\s*=\s*"(?!data:image\/(?:png|jpeg|webp);base64,|#)/i.test(svg)) {
    console.warn(`atlandı (güvensiz içerik): ${id}`);
    continue;
  }
  copyFileSync(file, join(outDir, `${id}.svg`));
  const meta = { shape: e.shape === 'wordmark' ? 'wordmark' : 'icon' };
  if (/^#[0-9a-f]{6}$/i.test(e.color ?? '')) meta.color = e.color.toLowerCase();
  const t = tone(svg);
  if (t) meta.tone = t;
  if (OWN_TILE.has(id)) meta.fill = true;
  logos[id] = meta;
}
if (existsSync(join(pack, 'SOURCES.md'))) copyFileSync(join(pack, 'SOURCES.md'), join(outDir, 'SOURCES.md'));

const missing = [...ids].filter((id) => !logos[id]).sort();
const body = Object.entries(logos).map(([id, m]) => `  ${id}: ${JSON.stringify(m)},`).join('\n');
writeFileSync(outTs, `/* scripts/sync-logos.mjs tarafından üretildi; elle düzenleme. Kaynak/lisans: public/logos/SOURCES.md */
export interface LogoMeta {
  /** icon: karoda gösterilir; wordmark: küçük karoda okunmaz, yalnız büyük yerde (ayrıntı penceresi) gösterilir. */
  shape: 'icon' | 'wordmark';
  /** Koyu arayüzde okunur marka rengi (harf simgesini renklendirir). */
  color?: string;
  /** Tek renkli işaret: 'light' açık temada, 'dark' koyu temada ters çevrilir. */
  tone?: 'light' | 'dark';
  /** Kendi opak karosuyla gelen simge: karonun tamamını kaplar. */
  fill?: boolean;
}
/** public/logos/ içinde SVG'si olan katalog kimlikleri; listede olmayanlar harf simgesine düşer (eksik dosya istenmez). */
export const LOGOS: Readonly<Record<string, LogoMeta>> = {
${body}
};
`);
console.log(`${Object.keys(logos).length} logo kopyalandı → public/logos/ (${readdirSync(outDir).length} dosya).`);
if (missing.length) console.log(`Harf simgesine düşenler (${missing.length}): ${missing.join(', ')}`);
