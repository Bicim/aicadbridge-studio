import { describe, expect, it } from 'vitest';
import type { Msg } from '../src/cloud/api';
import { activePath, deepestLeaf, isModelMsg, modelSummary, pathModels, pickModel, resolveSelected } from '../src/cloud/workbench';

function msg(id: string, parent: string | null, role: Msg['role'], model = role === 'assistant', extra: Partial<Msg> = {}): Msg {
  return {
    id, task_id: 't', parent_id: parent, role, content: id, ir: model ? { meta: { title: `M-${id}` }, features: [] } : null,
    report: null, steps: [], files: model ? { glb: `${id}.glb`, step: `${id}.step` } : {}, params: null, status: 'done', created_at: '', ...extra,
  };
}

// u1 → a1 → u2 → a2 ; u2 düzenlendi → u2b → a2b (dal)
const tree = [
  msg('u1', null, 'user'), msg('a1', 'u1', 'assistant'),
  msg('u2', 'a1', 'user'), msg('a2', 'u2', 'assistant'),
  msg('u2b', 'a1', 'user'), msg('a2b', 'u2b', 'assistant'),
];

describe('activePath / deepestLeaf', () => {
  it('yaprak verilmezse son mesaja giden yolu verir', () => {
    expect(activePath(tree, null).map((m) => m.id)).toEqual(['u1', 'a1', 'u2b', 'a2b']);
  });
  it('verilen yaprağa giden yolu verir', () => {
    expect(activePath(tree, 'a2').map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });
  it('boş liste', () => { expect(activePath([], null)).toEqual([]); });
  it('dalın en derin yaprağını bulur', () => {
    expect(deepestLeaf(tree, 'u2')).toBe('a2');
    expect(deepestLeaf(tree, 'a1')).toBe('a2b');
  });
});

describe('isModelMsg / pathModels', () => {
  it('yalnız IR ve dosyası olan asistan mesajları model sayılır', () => {
    expect(isModelMsg(msg('a', null, 'assistant'))).toBe(true);
    expect(isModelMsg(msg('a', null, 'assistant', false))).toBe(false);
    expect(isModelMsg(msg('a', null, 'assistant', true, { files: {} }))).toBe(false);
    expect(isModelMsg(msg('u', null, 'user'))).toBe(false);
  });
  it('yoldaki modeller eskiden yeniye', () => {
    expect(pathModels(activePath(tree, 'a2')).map((m) => m.id)).toEqual(['a1', 'a2']);
  });
});

describe('resolveSelected', () => {
  const models = pathModels(activePath(tree, 'a2'));
  it('seçim yoksa en son model', () => {
    expect(resolveSelected(models, null)?.id).toBe('a2');
  });
  it('model yoksa null', () => {
    expect(resolveSelected([], null)).toBeNull();
    expect(resolveSelected([], { id: 'a1', latestAt: 'a2' })).toBeNull();
  });
  it('eski modele tıklanınca o seçilir', () => {
    expect(resolveSelected(models, pickModel(models, 'a1'))?.id).toBe('a1');
  });
  it('yeni model gelince seçim en son modele döner', () => {
    const pick = pickModel(models, 'a1');
    const after = [...models, msg('a3', 'u3', 'assistant')];
    expect(resolveSelected(after, pick)?.id).toBe('a3');
  });
  it('dal değişince (en son model başka) seçim bayatlar', () => {
    const pick = pickModel(models, 'a1');
    const other = pathModels(activePath(tree, 'a2b'));
    expect(resolveSelected(other, pick)?.id).toBe('a2b');
  });
  it('parametre değişikliği (aynı id, yeni içerik) seçimi korur ve güncel mesajı verir', () => {
    const pick = pickModel(models, 'a1');
    const rebuilt = models.map((m) => (m.id === 'a1' ? { ...m, files: { glb: 'a1-v2.glb' } } : m));
    expect(resolveSelected(rebuilt, pick)?.files.glb).toBe('a1-v2.glb');
  });
  it('seçilen model artık yolda yoksa en son model', () => {
    expect(resolveSelected(models, { id: 'yok', latestAt: 'a2' })?.id).toBe('a2');
  });
});

describe('modelSummary', () => {
  it('başlık, ölçü, hacim ve uyarılar', () => {
    const m = msg('a', null, 'assistant', true, {
      report: {
        bodies: [{ name: 'b', volume: 66900, bbox: { size: [100, 100, 10] } }],
        features: [{ id: 'f1', status: 'failed', error: 'kesişim yok' }, { id: 'f2', status: 'ok' }],
        expect: { passed: false, issues: ['delik sayısı 5'] },
      },
    });
    const s = modelSummary(m);
    expect(s.title).toBe('M-a');
    expect(s.size).toBe('100 × 100 × 10 mm');
    expect(s.volume).toBe('66,9 cm³');
    expect(s.dims).toBe('100 × 100 × 10 mm · 66,9 cm³');
    expect(s.issues).toEqual(['f1: kesişim yok', 'delik sayısı 5']);
  });
  it('başlıksız model "Model" olur', () => {
    expect(modelSummary(msg('a', null, 'assistant', true, { ir: { features: [] } })).title).toBe('Model');
  });
});
