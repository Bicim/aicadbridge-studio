/* Görev ekranı: dallanan mesaj ağacının etkin yolu, canlı adımlar, model kartı, parametreler, eklentiye gönderme. */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, generate, loadByok, type Device, type IRParam, type Me, type Msg } from './api';
import { Composer } from './Composer';
import { HOST_LABEL } from './integrations';
import { OnshapeSend, useOnshapeLink, type OnshapeLink } from './OnshapePanel';

/* three.js yalnız bir model kartı görünür olduğunda yüklenir. */
const ModelViewer = lazy(() => import('./ModelViewer').then((m) => ({ default: m.ModelViewer })));
const VIEWER_H = 320;

/** Görüntüleyiciyi kart ekrana yaklaşınca kurar (uzun konuşmada gereksiz WebGL bağlamı ve GLB indirmesi yok). */
function LazyViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const skeleton = <div className="c-viewer c-viewer-skel" style={{ height: VIEWER_H }} aria-hidden="true" />;
  return (
    <div ref={ref}>
      {near ? <Suspense fallback={skeleton}><ModelViewer url={url} height={VIEWER_H} /></Suspense> : skeleton}
    </div>
  );
}

const startedTasks = new Set<string>();

/** En son oluşturulan yaprağa giden yol (kök → yaprak). */
function activePath(msgs: Msg[], leafId: string | null): Msg[] {
  if (!msgs.length) return [];
  const byId = new Map(msgs.map((m) => [m.id, m]));
  let cur = leafId ? byId.get(leafId) : msgs[msgs.length - 1];
  const out: Msg[] = [];
  while (cur) { out.push(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  return out.reverse();
}

function fmt(n: number | undefined, d = 1) {
  return n === undefined ? '–' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: d });
}

function ModelCard({ msg, devices, onshape, onUpdated }: { msg: Msg; devices: Device[]; onshape: OnshapeLink | null; onUpdated: (m: Msg) => void }) {
  const params: IRParam[] = (msg.ir?.parameters ?? []).filter((p) => typeof p.value === 'number' || p.min !== undefined);
  const current = msg.report?.parameters ?? {};
  const [vals, setVals] = useState<Record<string, number>>({});
  const [rebuilding, setRebuilding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);
  const [dev, setDev] = useState<string>('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { setVals({ ...current, ...(msg.params ?? {}) }); }, [msg.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!dev && devices[0]) setDev(devices[0].id); }, [devices, dev]);

  const rebuild = (next: Record<string, number>) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setRebuilding(true); setNote(null);
      try {
        const r = await api<{ ok: boolean; issues: string[]; message?: Msg }>(`/v1/messages/${msg.id}/rebuild`, { method: 'POST', json: { params: next } });
        if (r.message) onUpdated(r.message);
        if (r.issues.length) setNote(r.issues.slice(0, 3).join(' · '));
      } catch (e) { setNote((e as Error).message); }
      setRebuilding(false);
    }, 450);
  };

  const sendTo = async () => {
    if (!dev) return;
    setNote('Gönderiliyor…');
    try {
      const { job_id } = await api<{ job_id: string }>(`/v1/messages/${msg.id}/send`, { method: 'POST', json: { device_id: dev } });
      const name = HOST_LABEL[devices.find((d) => d.id === dev)?.host ?? 'other'];
      setNote(`${name} kuyruğunda, eklentinin almasını bekliyor…`);
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const j = await api<{ status: string; result?: { message?: string } }>(`/v1/jobs/${job_id}`);
        if (j.status === 'done') { setNote(`${name}: ${j.result?.message || 'içe aktarıldı'}`); return; }
        if (j.status === 'failed') { setNote(`${name} hatası: ${j.result?.message ?? ''}`); return; }
        if (j.status === 'delivered') setNote(`${name} modeli aldı, içe aktarıyor…`);
      }
      setNote('Eklenti yanıt vermedi. Programın açık ve bağlı olduğundan emin olun.');
    } catch (e) { setNote((e as Error).message); }
  };

  const body = msg.report?.bodies?.[0];
  const size = body?.bbox?.size;
  const title = msg.ir?.meta?.title || 'Model';
  const issues = [
    ...(msg.report?.features ?? []).filter((f) => f.status === 'failed' || f.status === 'skipped').map((f) => `${f.id}: ${f.error}`),
    ...(msg.report?.expect && !msg.report.expect.passed ? msg.report.expect.issues : []),
  ];

  return (
    <div className="c-card">
      {msg.files.glb ? <LazyViewer key={msg.files.glb} url={msg.files.glb} /> : <div className="c-viewer c-viewer-err">Önizleme yok</div>}
      <div className="c-card-meta">
        <div>
          <div className="c-card-title">{title}{rebuilding && <span className="c-spin" />}</div>
          <div className="c-mono c-dim">
            {size ? `${fmt(size[0])} × ${fmt(size[1])} × ${fmt(size[2])} mm` : ''}
            {body?.volume !== undefined ? ` · ${fmt(body.volume / 1000, 2)} cm³` : ''}
            {msg.report?.bodies && msg.report.bodies.length > 1 ? ` · ${msg.report.bodies.length} gövde` : ''}
          </div>
        </div>
        <div className="c-dl">
          {(['step', 'stl', 'glb'] as const).filter((f) => msg.files[f]).map((f) => (
            <a key={f} className="c-chip" href={msg.files[f]} download={`${title}.${f}`}>{f.toUpperCase()} ↓</a>
          ))}
        </div>
      </div>
      {issues.length > 0 && <div className="c-warn">⚠ {issues.slice(0, 4).join(' · ')}</div>}
      <div className="c-card-actions">
        {params.length > 0 && <button className="c-btn ghost" onClick={() => setShowParams(!showParams)}>Parametreler ({params.length})</button>}
        {devices.length > 0 ? (
          <span className="c-send-to">
            <select value={dev} onChange={(e) => setDev(e.target.value)} aria-label="Hedef program">
              {devices.map((d) => <option key={d.id} value={d.id}>{HOST_LABEL[d.host]} · {d.name}</option>)}
            </select>
            <button className="c-btn" onClick={sendTo}>Programa gönder</button>
          </span>
        ) : !onshape?.connected && <a className="c-btn ghost" href="#/integrations">Fusion / Blender / SolidWorks / Onshape bağla</a>}
        {onshape?.connected && msg.files.step && <OnshapeSend messageId={msg.id} link={onshape} />}
      </div>
      {showParams && (
        <div className="c-params">
          {params.map((p) => {
            const v = vals[p.name] ?? (typeof p.value === 'number' ? p.value : 0);
            const min = p.min ?? 0, max = p.max ?? Math.max(1, v * 3), step = p.step ?? (p.unit === 'count' ? 1 : 0.5);
            return (
              <label key={p.name} className="c-param">
                <span>{p.label || p.name}</span>
                <input type="range" min={min} max={max} step={step} value={v}
                  onChange={(e) => { const next = { ...vals, [p.name]: Number(e.target.value) }; setVals(next); rebuild(next); }} />
                <input type="number" className="c-mono" min={min} max={max} step={step} value={v}
                  onChange={(e) => { const next = { ...vals, [p.name]: Number(e.target.value) }; setVals(next); rebuild(next); }} />
                <span className="c-dim c-mono">{p.unit === 'count' ? 'adet' : p.unit ?? 'mm'}</span>
              </label>
            );
          })}
        </div>
      )}
      {note && <div className="c-note">{note}</div>}
    </div>
  );
}

function Steps({ steps, live }: { steps: { text: string; detail?: string[] }[]; live?: boolean }) {
  const [open, setOpen] = useState(!!live);
  if (!steps.length && !live) return null;
  return (
    <div className="c-steps">
      <button className="c-steps-head" onClick={() => setOpen(!open)}>
        {live ? <span className="c-spin" /> : '✓'} {live ? (steps[steps.length - 1]?.text ?? 'Başlıyor') + '…' : `${steps.length} adım`} <span className="c-dim">{open ? '▴' : '▾'}</span>
      </button>
      {(open || live) && (
        <ul>
          {steps.map((s, i) => (
            <li key={i}>{s.text}{s.detail && <ul className="c-dim">{s.detail.map((d, j) => <li key={j}>{d}</li>)}</ul>}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaskView({ taskId, me, devices, initialPrompt, onConsumedPrompt, onChanged, refreshMe }: {
  taskId: string; me: Me | null; devices: Device[]; initialPrompt: string | null;
  onConsumedPrompt: () => void; onChanged: () => void; refreshMe: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [title, setTitle] = useState('');
  const [leaf, setLeaf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ prompt: string; steps: { text: string; detail?: string[] }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ parent: string | null; text: string } | null>(null);
  const { link: onshape } = useOnshapeLink();
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await api<{ task: { title: string }; messages: Msg[] }>(`/v1/tasks/${taskId}`);
    setMsgs(r.messages); setTitle(r.task.title); setLeaf(r.messages.length ? r.messages[r.messages.length - 1].id : null);
  }, [taskId]);

  useEffect(() => { setErr(null); load().catch((e) => setErr((e as Error).message)); }, [load]);

  const path = useMemo(() => activePath(msgs, leaf), [msgs, leaf]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [path.length, live?.steps.length]);

  const send = useCallback(async (prompt: string, parentId?: string | null) => {
    setBusy(true); setErr(null); setEdit(null);
    setLive({ prompt, steps: [] });
    const ctl = new AbortController(); abort.current = ctl;
    const byok = loadByok();
    const llm = byok.enabled && byok.api_key ? { provider: byok.provider, model: byok.model, api_key: byok.api_key, base_url: byok.base_url } : undefined;
    try {
      await generate(taskId, { prompt, parent_id: parentId === undefined ? leaf : parentId, llm }, (ev) => {
        if (ev.type === 'start') setMsgs((m) => [...m, ev.user_message]);
        if (ev.type === 'step') setLive((l) => l && { ...l, steps: [...l.steps, { text: ev.text, detail: ev.detail }] });
        if (ev.type === 'done') {
          setMsgs((m) => [...m, ev.message]); setLeaf(ev.message.id);
          if (ev.task_title) setTitle(ev.task_title);
        }
        if (ev.type === 'error') setErr(ev.message);
      }, ctl.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(e instanceof ApiError && e.status === 402 ? e.message : (e as Error).message);
      await load().catch(() => undefined);
    }
    setLive(null); setBusy(false); abort.current = null;
    onChanged(); refreshMe();
  }, [taskId, leaf, load, onChanged, refreshMe]);

  useEffect(() => {
    // StrictMode efektleri iki kez çalıştırır; ilk istem görev başına yalnız bir kez gönderilir.
    if (!initialPrompt || startedTasks.has(taskId)) return;
    startedTasks.add(taskId);
    onConsumedPrompt();
    void send(initialPrompt, null);
  }, [initialPrompt, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updated = (m: Msg) => setMsgs((all) => all.map((x) => (x.id === m.id ? m : x)));
  const siblings = (m: Msg) => msgs.filter((x) => x.parent_id === m.parent_id && x.role === m.role);

  return (
    <div className="c-task">
      <header className="c-task-head">
        <h1>{title || '…'}</h1>
      </header>
      <div className="c-thread">
        {path.map((m) => {
          if (m.role === 'user') {
            const sib = siblings(m);
            const idx = sib.findIndex((s) => s.id === m.id);
            return (
              <div key={m.id} className="c-msg user">
                <div className="c-bubble">{m.content}</div>
                <div className="c-msg-tools">
                  {sib.length > 1 && (
                    <span className="c-mono c-dim">
                      <button disabled={idx <= 0} onClick={() => setLeaf(deepestLeaf(msgs, sib[idx - 1].id))}>‹</button>
                      {idx + 1}/{sib.length}
                      <button disabled={idx >= sib.length - 1} onClick={() => setLeaf(deepestLeaf(msgs, sib[idx + 1].id))}>›</button>
                    </span>
                  )}
                  {!busy && <button onClick={() => setEdit({ parent: m.parent_id, text: m.content })}>Düzenle</button>}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="c-msg assistant">
              <div className="c-avatar" aria-hidden>◎</div>
              <div className="c-msg-body">
                <Steps steps={m.steps ?? []} />
                {m.status === 'running' ? <p className="c-dim">Bu yanıt yarıda kaldı.</p> : <p>{m.content}</p>}
                {m.ir && Object.keys(m.files).length > 0 && <ModelCard msg={m} devices={devices} onshape={onshape} onUpdated={updated} />}
              </div>
            </div>
          );
        })}
        {live && (
          <div className="c-msg assistant">
            <div className="c-avatar pulse" aria-hidden>◎</div>
            <div className="c-msg-body"><Steps steps={live.steps} live /></div>
          </div>
        )}
        {err && <div className="c-error">{err}{err.includes('Kredi') && <a href="#/billing"> Planları gör →</a>}</div>}
        <div ref={end} />
      </div>
      <div className="c-task-foot">
        {edit && <div className="c-edit-note">Düzenlenen mesajdan yeni bir dal açılacak. <button onClick={() => setEdit(null)}>İptal</button></div>}
        <Composer me={me} busy={busy} onStop={() => abort.current?.abort()}
          placeholder="Değişiklik iste: 'Kenarları 2 mm yuvarlat', 'Delikleri 8 adet yap'…"
          initial={edit?.text ?? ''}
          onSend={(t) => (edit ? send(t, edit.parent) : send(t))} />
      </div>
    </div>
  );
}

function deepestLeaf(msgs: Msg[], fromId: string): string {
  let cur = fromId;
  for (;;) {
    const kids = msgs.filter((m) => m.parent_id === cur);
    if (!kids.length) return cur;
    cur = kids[kids.length - 1].id;
  }
}
