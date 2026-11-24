/* Görev ekranının saf mantığı: mesaj ağacında etkin yol, yoldaki modeller ve tezgâhta gösterilecek model seçimi.
   React'ten bağımsız; tests/workbench.test.ts sınar. */
import type { Msg } from './api';

/** En son oluşturulan yaprağa giden yol (kök → yaprak). */
export function activePath(msgs: Msg[], leafId: string | null): Msg[] {
  if (!msgs.length) return [];
  const byId = new Map(msgs.map((m) => [m.id, m]));
  let cur = leafId ? byId.get(leafId) : msgs[msgs.length - 1];
  const out: Msg[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.push(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  return out.reverse();
}

export function deepestLeaf(msgs: Msg[], fromId: string): string {
  let cur = fromId;
  for (;;) {
    const kids = msgs.filter((m) => m.parent_id === cur);
    if (!kids.length) return cur;
    cur = kids[kids.length - 1].id;
  }
}

/** Model kartı gösteren asistan mesajı mı (IR + en az bir dosya). */
export function isModelMsg(m: Msg): boolean {
  return m.role === 'assistant' && !!m.ir && Object.keys(m.files ?? {}).length > 0;
}

/** Etkin yoldaki modeller, eskiden yeniye ("Sürüm 1 … n"). */
export function pathModels(path: Msg[]): Msg[] {
  return path.filter(isModelMsg);
}

/** Kullanıcının seçimi + seçildiği anda en son model. En son model değişirse (yeni üretim, dal değişimi) seçim bayatlar. */
export interface ModelPick { id: string; latestAt: string | null }

export function pickModel(models: Msg[], id: string): ModelPick {
  return { id, latestAt: models.length ? models[models.length - 1].id : null };
}

/** Tezgâhta gösterilecek model: varsayılan en son model; geçerli bir seçim varsa o. */
export function resolveSelected(models: Msg[], pick: ModelPick | null): Msg | null {
  const latest = models.length ? models[models.length - 1] : null;
  if (!pick || !latest || pick.latestAt !== latest.id) return latest;
  return models.find((m) => m.id === pick.id) ?? latest;
}

function fmt(n: number | undefined, d = 1) {
  return n === undefined ? '–' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: d });
}

/** Kart / tezgâh başlığı, ölçü satırı ve uyarılar. */
export function modelSummary(msg: Msg): { title: string; size: string; volume: string; dims: string; issues: string[] } {
  const body = msg.report?.bodies?.[0];
  const s = body?.bbox?.size;
  const size = s ? `${fmt(s[0])} × ${fmt(s[1])} × ${fmt(s[2])} mm` : '';
  const volume = body?.volume !== undefined ? `${fmt(body.volume / 1000, 2)} cm³` : '';
  const bodies = msg.report?.bodies && msg.report.bodies.length > 1 ? `${msg.report.bodies.length} gövde` : '';
  const issues = [
    ...(msg.report?.features ?? []).filter((f) => f.status === 'failed' || f.status === 'skipped').map((f) => `${f.id}: ${f.error}`),
    ...(msg.report?.expect && !msg.report.expect.passed ? msg.report.expect.issues : []),
  ];
  return { title: msg.ir?.meta?.title || 'Model', size, volume, dims: [size, volume, bodies].filter(Boolean).join(' · '), issues };
}

/** Görev ekranının iki sütunlu "tezgâh" düzenine geçtiği genişlik. */
export const SPLIT_QUERY = '(min-width: 1200px)';
