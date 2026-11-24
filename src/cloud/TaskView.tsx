/* Görev ekranı: dallanan mesaj ağacının etkin yolu, canlı adımlar, model kartı, parametreler, programa gönderme.
   ≥1200px "tezgâh" düzeni: solda konuşma (modeller kompakt satır), sağda seçili modelin görüntüleyicisi + parametre dok'u.
   <1200px tek sütun; model kartı konuşmanın içinde tam hâliyle. */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import {
  Box, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileBox, FolderDown, Pencil, Plug, Plus, Scan, Send,
  SlidersHorizontal, SquareDashed, TriangleAlert, X,
} from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { api, ApiError, generate, loadByok, type Device, type IRParam, type Me, type Msg } from './api';
import { Composer } from './Composer';
import { hostLabel, isOnline } from './hosts';
import { LogoTile } from './LogoTile';
import { OnshapeSend, useOnshapeLink, type OnshapeLink } from './OnshapePanel';
import { Menu } from './ui';
import {
  activePath, deepestLeaf, isModelMsg, modelSummary, pathModels, pickModel, resolveSelected, SPLIT_QUERY, type ModelPick,
} from './workbench';
import './task.css';

/* three.js yalnız bir model görünür olduğunda yüklenir. */
const ModelViewer = lazy(() => import('./ModelViewer').then((m) => ({ default: m.ModelViewer })));

const startedTasks = new Set<string>();

function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mq = window.matchMedia(q);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches),
    () => false,
  );
}

const skeleton = <div className="c-viewer fill c-viewer-skel" aria-hidden="true"><span className="c-spin" /></div>;

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
  return (
    <div ref={ref} className="c-viewer-box">
      {near ? <Suspense fallback={skeleton}><ModelViewer url={url} /></Suspense> : skeleton}
    </div>
  );
}

const FORMATS = [
  { id: 'step', hint: 'CAD programları için' },
  { id: 'stl', hint: '3B baskı için' },
  { id: 'glb', hint: 'Görüntüleme ve web' },
] as const;

/** Bir modelin düzenlenebilir durumu: parametre değerleri (set_parameters → /rebuild), gönderme işi ve durum notu. */
function useModelState(msg: Msg, onUpdated: (m: Msg) => void) {
  const params: IRParam[] = (msg.ir?.parameters ?? []).filter((p) => typeof p.value === 'number' || p.min !== undefined);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [rebuilding, setRebuilding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showOnshape, setShowOnshape] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current); }; }, []);

  useEffect(() => { setVals({ ...(msg.report?.parameters ?? {}), ...(msg.params ?? {}) }); }, [msg.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rebuild = (next: Record<string, number>) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setRebuilding(true); setNote(null);
      try {
        const r = await api<{ ok: boolean; issues: string[]; message?: Msg }>(`/v1/messages/${msg.id}/rebuild`, { method: 'POST', json: { params: next } });
        if (!alive.current) return;
        if (r.message) onUpdated(r.message);
        if (r.issues.length) setNote(r.issues.slice(0, 3).join(' · '));
      } catch (e) { if (alive.current) setNote((e as Error).message); }
      if (alive.current) setRebuilding(false);
    }, 450);
  };
  const setParam = (name: string, value: number) => { const next = { ...vals, [name]: value }; setVals(next); rebuild(next); };

  const sendTo = async (d: Device) => {
    const name = hostLabel(d.host);
    setShowOnshape(false);
    setNote(`${name}: gönderiliyor…`);
    try {
      const { job_id } = await api<{ job_id: string }>(`/v1/messages/${msg.id}/send`, { method: 'POST', json: { device_id: d.id } });
      setNote(`${name} kuyruğunda, eklentinin almasını bekliyor…`);
      for (let i = 0; i < 60 && alive.current; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!alive.current) return;
        const j = await api<{ status: string; result?: { message?: string } }>(`/v1/jobs/${job_id}`);
        if (j.status === 'done') { setNote(`${name}: ${j.result?.message || 'içe aktarıldı'}`); return; }
        if (j.status === 'failed') { setNote(`${name} hatası: ${j.result?.message ?? ''}`); return; }
        if (j.status === 'delivered') setNote(`${name} modeli aldı, içe aktarıyor…`);
      }
      if (alive.current) setNote('Eklenti yanıt vermedi. Programın açık ve bağlı olduğundan emin ol.');
    } catch (e) { if (alive.current) setNote((e as Error).message); }
  };

  return { params, vals, setParam, rebuilding, note, setNote, showOnshape, setShowOnshape, sendTo };
}
type ModelState = ReturnType<typeof useModelState>;

function ParamList({ msg, st }: { msg: Msg; st: ModelState }) {
  return (
    <>
      {st.params.map((p) => {
        const v = st.vals[p.name] ?? (typeof p.value === 'number' ? p.value : 0);
        const min = p.min ?? 0, max = p.max ?? Math.max(1, v * 3), step = p.step ?? (p.unit === 'count' ? 1 : 0.5);
        const label = p.label || p.name;
        const rid = `r-${msg.id}-${p.name}`;
        return (
          <div key={p.name} className="c-param">
            <label htmlFor={rid}>{label}</label>
            <input id={rid} type="range" min={min} max={max} step={step} value={v} style={{ '--p': `${max > min ? ((v - min) / (max - min)) * 100 : 0}%` } as CSSProperties} onChange={(e) => st.setParam(p.name, Number(e.target.value))} />
            <span className="c-param-num">
              <input type="number" aria-label={`${label} değeri`} min={min} max={max} step={step} value={v}
                onChange={(e) => st.setParam(p.name, Number(e.target.value))} />
              <span>{p.unit === 'count' ? 'adet' : p.unit ?? 'mm'}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

function ModelActions({ msg, st, devices, onshape, onMenuOpen, primary }: {
  msg: Msg; st: ModelState; devices: Device[]; onshape: OnshapeLink | null; onMenuOpen: () => void; primary?: boolean;
}) {
  const { title } = modelSummary(msg);
  const formats = FORMATS.filter((f) => msg.files[f.id]);
  const onshapeOk = !!onshape?.connected && !!msg.files.step;
  const canSend = devices.length > 0 || onshapeOk;
  return (
    <>
      {formats.length > 0 && (
        <Menu className="c-btn sm" trigger={<><Download aria-hidden="true" />İndir<ChevronDown aria-hidden="true" /></>}>
          {formats.map((f) => (
            <a key={f.id} role="menuitem" className="c-menu-item" href={msg.files[f.id]} download={`${title}.${f.id}`}>
              <FileBox /><span className="c-grow">{f.id.toUpperCase()}<small>{f.hint}</small></span>
            </a>
          ))}
        </Menu>
      )}
      {canSend ? (
        <Menu className={`c-btn sm${primary ? ' primary' : ''}`} onOpen={onMenuOpen} trigger={<><Send aria-hidden="true" />Gönder<ChevronDown aria-hidden="true" /></>}>
          <div className="c-menu-label">Programa gönder</div>
          {devices.map((d) => {
            const on = isOnline(d);
            return (
              <button key={d.id} type="button" role="menuitem" className="c-menu-item" onClick={() => { void st.sendTo(d); }}>
                <LogoTile id={d.host} name={hostLabel(d.host)} size={32} icon={d.host === 'other' ? <FolderDown /> : undefined} />
                <span className="c-grow">{hostLabel(d.host)}<small>{d.name}</small></span>
                <i className={`c-dot${on ? ' on' : ''}`} title={on ? 'Çevrimiçi' : 'Çevrimdışı'} />
              </button>
            );
          })}
          {onshapeOk && (
            <button type="button" role="menuitem" className="c-menu-item" onClick={() => { st.setNote(null); st.setShowOnshape(true); }}>
              <LogoTile id="onshape" name="Onshape" size={32} />
              <span className="c-grow">Onshape<small>Belgeye parça olarak</small></span>
            </button>
          )}
          <div className="c-menu-sep" role="separator" />
          <a role="menuitem" className="c-menu-item" href="#/integrations"><Plus />Program bağla</a>
        </Menu>
      ) : (
        <a className={`c-btn sm${primary ? ' primary' : ''}`} href="#/integrations"><Plug aria-hidden="true" />Program bağla</a>
      )}
    </>
  );
}

function OnshapeRow({ msg, st, onshape }: { msg: Msg; st: ModelState; onshape: OnshapeLink | null }) {
  if (!st.showOnshape || !onshape?.connected) return null;
  return (
    <div className="c-model-row">
      <OnshapeSend messageId={msg.id} link={onshape} />
      <button type="button" className="c-icon-btn" aria-label="Kapat" onClick={() => st.setShowOnshape(false)}><X /></button>
    </div>
  );
}

function Warn({ issues }: { issues: string[] }) {
  if (!issues.length) return null;
  return <div className="c-model-warn"><TriangleAlert aria-hidden="true" /><span>{issues.slice(0, 4).join(' · ')}</span></div>;
}

/** <1200px: konuşmanın içindeki tam model kartı. */
function ModelCard({ msg, devices, onshape, onUpdated, onMenuOpen }: {
  msg: Msg; devices: Device[]; onshape: OnshapeLink | null; onUpdated: (m: Msg) => void; onMenuOpen: () => void;
}) {
  const st = useModelState(msg, onUpdated);
  const [showParams, setShowParams] = useState(false);
  const { title, dims, issues } = modelSummary(msg);

  return (
    <div className="c-model">
      {msg.files.glb ? <LazyViewer key={msg.files.glb} url={msg.files.glb} /> : <div className="c-viewer c-viewer-empty">Önizleme yok</div>}
      <div className="c-model-foot">
        <div className="c-model-info">
          <div className="c-model-title">{title}{st.rebuilding && <span className="c-spin" role="status" aria-label="Yeniden kuruluyor" />}</div>
          {dims && <div className="c-model-dims">{dims}</div>}
        </div>
        <div className="c-model-actions">
          {st.params.length > 0 && (
            <button type="button" className={`c-btn sm${showParams ? ' on' : ''}`} aria-expanded={showParams} aria-controls={`params-${msg.id}`} onClick={() => setShowParams(!showParams)}>
              <SlidersHorizontal aria-hidden="true" />Parametreler<span className="c-count">{st.params.length}</span>
            </button>
          )}
          <ModelActions msg={msg} st={st} devices={devices} onshape={onshape} onMenuOpen={onMenuOpen} />
        </div>
      </div>
      <Warn issues={issues} />
      {showParams && <div className="c-params" id={`params-${msg.id}`}><ParamList msg={msg} st={st} /></div>}
      <OnshapeRow msg={msg} st={st} onshape={onshape} />
      {st.note && <div className="c-model-note" role="status">{st.note}</div>}
    </div>
  );
}

/** ≥1200px: konuşmadaki modelin seçilebilir kompakt satırı. */
function ModelRow({ msg, selected, onSelect }: { msg: Msg; selected: boolean; onSelect: () => void }) {
  const { title, size } = modelSummary(msg);
  return (
    <button type="button" className={`c-model compact${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
      <span className="c-model-tile" aria-hidden="true"><Box /></span>
      <span className="c-model-info">
        <span className="c-model-title">{title}</span>
        {size && <span className="c-model-dims">{size}</span>}
      </span>
      <span className="c-btn ghost sm" aria-hidden="true">{selected ? 'Görüntüleniyor' : 'Görüntüle'}</span>
    </button>
  );
}

/** ≥1200px sağ sütun: seçili modelin kalıcı görüntüleyicisi + parametre dok'u. Model değişince yeniden kurulur (key). */
function Bench({ msg, models, onPick, devices, onshape, onUpdated, onMenuOpen }: {
  msg: Msg; models: Msg[]; onPick: (id: string) => void;
  devices: Device[]; onshape: OnshapeLink | null; onUpdated: (m: Msg) => void; onMenuOpen: () => void;
}) {
  const st = useModelState(msg, onUpdated);
  const [fit, setFit] = useState(0);
  const [edges, setEdges] = useState(true);
  const { title, size, volume, issues } = modelSummary(msg);
  const idx = models.findIndex((m) => m.id === msg.id);

  return (
    <section className="c-bench" aria-label="Model tezgâhı">
      <div className="c-bench-stage">
        {msg.files.glb
          ? <Suspense fallback={skeleton}><ModelViewer key={msg.files.glb} url={msg.files.glb} fit={fit} edges={edges} /></Suspense>
          : <div className="c-viewer fill c-viewer-empty">Önizleme yok</div>}
        <div className="c-bench-tl">
          <span className="c-bench-title" title={title}>{title}</span>
          {st.rebuilding && <span className="c-spin" role="status" aria-label="Yeniden kuruluyor" />}
          {models.length > 1 && (
            <select className="sm" aria-label="Model sürümü" value={msg.id} onChange={(e) => onPick(e.target.value)}>
              {models.map((m, i) => <option key={m.id} value={m.id}>Sürüm {i + 1} / {models.length}</option>)}
            </select>
          )}
          {models.length <= 1 && idx >= 0 && <span className="c-bench-ver">Sürüm 1 / 1</span>}
        </div>
        {msg.files.glb && (
          <div className="c-bench-tr c-tool-group">
            <button type="button" className="c-icon-btn" aria-label="Sığdır" title="Sığdır" onClick={() => setFit((n) => n + 1)}><Scan /></button>
            <button type="button" className={`c-icon-btn${edges ? ' on' : ''}`} aria-label="Kenarları göster" title="Kenarları göster" aria-pressed={edges} onClick={() => setEdges(!edges)}><SquareDashed /></button>
          </div>
        )}
        {(size || volume) && (
          <div className="c-bench-bl">
            {size && <span className="c-dim">{size}</span>}
            {volume && <span className="c-dim">{volume}</span>}
          </div>
        )}
      </div>
      <div className="c-bench-dock">
        <div className="c-bench-dock-head">
          <h2>Parametreler{st.params.length > 0 && <span className="c-badge">{st.params.length}</span>}</h2>
          <div className="c-model-actions">
            <ModelActions msg={msg} st={st} devices={devices} onshape={onshape} onMenuOpen={onMenuOpen} primary />
          </div>
        </div>
        <div className="c-bench-dock-body">
          <Warn issues={issues} />
          <OnshapeRow msg={msg} st={st} onshape={onshape} />
          {st.note && <div className="c-model-note" role="status">{st.note}</div>}
          {st.params.length > 0
            ? <div className="c-params"><ParamList msg={msg} st={st} /></div>
            : <p className="c-bench-none">Bu modelde ayarlanabilir parametre yok.</p>}
        </div>
      </div>
    </section>
  );
}

function BenchEmpty({ busy }: { busy: boolean }) {
  return (
    <section className="c-bench" aria-label="Model tezgâhı">
      <div className="c-bench-stage">
        <div className={`c-viewer fill c-bench-empty${busy ? ' c-viewer-skel' : ''}`}>
          {busy ? <span className="c-bench-wait"><span className="c-spin" />Model hazırlanıyor…</span> : <span>Model burada görünecek.</span>}
        </div>
      </div>
    </section>
  );
}

function Steps({ steps, live }: { steps: { text: string; detail?: string[] }[]; live?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!steps.length && !live) return null;
  const list = (
    <ol className="c-steps-list">
      {steps.map((s, i) => (
        <li key={i}>{s.text}{s.detail && <ul>{s.detail.map((d, j) => <li key={j}>{d}</li>)}</ul>}</li>
      ))}
    </ol>
  );
  if (live) {
    return (
      <div className="c-steps">
        <div className="c-steps-head" role="status"><span className="c-spin" />{(steps[steps.length - 1]?.text ?? 'Başlıyor')}…</div>
        {steps.length > 0 && list}
      </div>
    );
  }
  return (
    <div className="c-steps">
      <button type="button" className="c-steps-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Check aria-hidden="true" />{steps.length} adım<ChevronDown aria-hidden="true" className={open ? 'flip' : undefined} />
      </button>
      {open && list}
    </div>
  );
}

export function TaskView({ taskId, me, devices, initialPrompt, onConsumedPrompt, onChanged, refreshMe, refreshDevices }: {
  taskId: string; me: Me | null; devices: Device[]; initialPrompt: string | null;
  onConsumedPrompt: () => void; onChanged: () => void; refreshMe: () => void; refreshDevices: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [title, setTitle] = useState('');
  const [leaf, setLeaf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ prompt: string; steps: { text: string; detail?: string[] }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ parent: string | null; text: string } | null>(null);
  const [pick, setPick] = useState<ModelPick | null>(null);
  const split = useMediaQuery(SPLIT_QUERY);
  const { link: onshape } = useOnshapeLink();
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await api<{ task: { title: string }; messages: Msg[] }>(`/v1/tasks/${taskId}`);
    setMsgs(r.messages); setTitle(r.task.title); setLeaf(r.messages.length ? r.messages[r.messages.length - 1].id : null);
  }, [taskId]);

  useEffect(() => { setErr(null); setPick(null); load().catch((e) => setErr((e as Error).message)); }, [load]);

  const path = useMemo(() => activePath(msgs, leaf), [msgs, leaf]);
  const models = useMemo(() => pathModels(path), [path]);
  const selected = resolveSelected(models, pick);
  const choose = (id: string) => setPick(pickModel(models, id));

  useEffect(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    end.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, [path.length, live?.steps.length]);

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
    <div className={`c-task${split ? ' split' : ''}`}>
      <header className="c-task-head">
        <h1 title={title}>{title || 'Yeni görev'}</h1>
      </header>
      <div className="c-thread-col">
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
                      <span className="c-branch">
                        <button type="button" className="c-icon-btn" aria-label="Önceki sürüm" disabled={idx <= 0} onClick={() => setLeaf(deepestLeaf(msgs, sib[idx - 1].id))}><ChevronLeft /></button>
                        <span aria-label={`Sürüm ${idx + 1} / ${sib.length}`}>{idx + 1}/{sib.length}</span>
                        <button type="button" className="c-icon-btn" aria-label="Sonraki sürüm" disabled={idx >= sib.length - 1} onClick={() => setLeaf(deepestLeaf(msgs, sib[idx + 1].id))}><ChevronRight /></button>
                      </span>
                    )}
                    {!busy && <button type="button" className="c-btn ghost sm" onClick={() => setEdit({ parent: m.parent_id, text: m.content })}><Pencil aria-hidden="true" />Düzenle</button>}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="c-msg assistant">
                <div className="c-msg-avatar" aria-hidden="true"><BrandMark size={16} /></div>
                <div className="c-msg-body">
                  <Steps steps={m.steps ?? []} />
                  {m.status === 'running' ? <p className="c-muted">Bu yanıt yarıda kaldı.</p> : m.content && <p>{m.content}</p>}
                  {isModelMsg(m) && (split
                    ? <ModelRow msg={m} selected={selected?.id === m.id} onSelect={() => choose(m.id)} />
                    : <ModelCard msg={m} devices={devices} onshape={onshape} onUpdated={updated} onMenuOpen={refreshDevices} />)}
                </div>
              </div>
            );
          })}
          {live && (
            <div className="c-msg assistant">
              <div className="c-msg-avatar live" aria-hidden="true"><BrandMark size={16} /></div>
              <div className="c-msg-body"><Steps steps={live.steps} live /></div>
            </div>
          )}
          {err && <div className="c-error" role="alert"><span>{err}{err.includes('Kredi') && <> <a href="#/billing">Planları gör</a></>}</span></div>}
          <div ref={end} className="c-thread-end" />
        </div>
        <div className="c-task-foot">
          {edit && (
            <div className="c-edit-note">
              <span>Düzenlenen mesajdan yeni bir dal açılacak.</span>
              <button type="button" className="c-link" onClick={() => setEdit(null)}>İptal</button>
            </div>
          )}
          <Composer me={me} busy={busy} onStop={() => abort.current?.abort()} label="Değişiklik iste"
            placeholder="Değişiklik iste: 'Kenarları 2 mm yuvarlat', 'Delikleri 8 adet yap'…"
            initial={edit?.text ?? ''}
            onSend={(t) => (edit ? send(t, edit.parent) : send(t))} />
        </div>
      </div>
      {split && (selected
        ? <Bench key={selected.id} msg={selected} models={models} onPick={choose} devices={devices} onshape={onshape} onUpdated={updated} onMenuOpen={refreshDevices} />
        : <BenchEmpty busy={busy} />)}
    </div>
  );
}
