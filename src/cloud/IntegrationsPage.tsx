/* Entegrasyonlar: eşleştirme onayı, kurulum programı, bağlı programlar, aranabilir katalog, ayrıntı penceresi, MCP.
   Veri: integrations.ts. Logolar: LogoTile (dosyası yoksa harf simgesi). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cable, Download, FolderDown, KeyRound, Search, Trash2, X } from 'lucide-react';
import { api, ApiError, type Device, type Me } from './api';
import { hostLabel, isOnline } from './hosts';
import { CATALOG, SETUP_URL, STATUS_LABEL, matches, type Entry, type Status } from './integrations';
import { LogoTile } from './LogoTile';
import { McpSetup } from './McpSetup';
import { OnshapeConnect, useOnshapeLink, type OnshapeLink } from './OnshapePanel';
import { SITE_URL } from './Login';
import { Empty, PageHeader } from './ui';
import './integrations.css';

type ConnectInfo = { host: string; name: string; expires_at: string };
type Votes = { mine: string[]; counts: Record<string, number> };

const TRADEMARK = 'Ürün adları ve logolar sahiplerinin ticari markalarıdır; yalnızca uyumluluğu belirtmek için kullanılır, ortaklık veya onay anlamına gelmez.';

/** "2 sa önce" biçimi (Intl.RelativeTimeFormat, Türkçe). */
const rtf = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'always', style: 'narrow' });
function ago(iso: string): string {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  if (Math.abs(m) < 1440) return rtf.format(Math.round(m / 60), 'hour');
  return rtf.format(Math.round(m / 1440), 'day');
}

/** Katalog girdisinin karosu: özel bağlantılarda kendi simgemiz, diğerlerinde uygulama logosu. */
function EntryTile({ entry, size = 40 }: { entry: Entry; size?: 40 | 48 }) {
  const icon = entry.special === 'mcp' ? <Cable /> : entry.special === 'apikeys' ? <KeyRound /> : undefined;
  return <LogoTile id={entry.id} name={entry.name} size={size} icon={icon} />;
}

function ConnectConfirm({ code, onDone }: { code: string; onDone: () => void }) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'busy' | 'done' | 'cancelled'>('loading');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<ConnectInfo>(`/v1/connect/info?code=${encodeURIComponent(code)}`)
      .then((i) => { if (live) { setInfo(i); setState('ready'); } })
      .catch((e: ApiError) => {
        if (!live) return;
        setErr(e.status === 404 ? "Kod bulunamadı veya süresi doldu, kurulum programından tekrar Bağla'ya bas."
          : e.status === 409 ? 'Bu kod zaten kullanıldı.' : e.message);
        setState('ready');
      });
    return () => { live = false; };
  }, [code]);
  const approve = async () => {
    setState('busy'); setErr(null);
    try { await api('/v1/connect/approve', { method: 'POST', json: { user_code: code } }); setState('done'); onDone(); }
    catch (e) { setErr((e as Error).message); setState('ready'); }
  };
  const open = state === 'ready' || state === 'busy';
  return (
    <section className="c-card hl c-confirm" aria-live="polite">
      {state === 'loading' && <p className="c-muted">Kod doğrulanıyor…</p>}
      {state === 'done' && <div className="c-note ok">Bağlandı. Programına dönebilirsin.</div>}
      {state === 'cancelled' && <p className="c-muted">Bağlantı iptal edildi. Hiçbir şey bağlanmadı.</p>}
      {open && info && !err && (
        <>
          <div className="c-confirm-app">
            <LogoTile id={info.host} name={hostLabel(info.host)} size={48} icon={info.host === 'other' ? <FolderDown /> : undefined} />
            <div>
              <h2>Bu bilgisayar hesabına bağlansın mı?</h2>
              <p className="c-muted">{hostLabel(info.host)} · <b>{info.name}</b></p>
            </div>
          </div>
          <div className="c-pair-code" aria-label="Eşleştirme kodu">{code}</div>
          <p className="c-fine">Kodun programdaki kodla aynı olduğundan emin ol. Yalnızca kendi kurduğun programı bağla.</p>
          <div className="c-inline">
            <button type="button" className="c-btn primary" disabled={state === 'busy'} onClick={approve}>Onayla</button>
            <button type="button" className="c-btn ghost" disabled={state === 'busy'} onClick={() => setState('cancelled')}>Vazgeç</button>
          </div>
        </>
      )}
      {open && err && <div className="c-error" role="alert">{err}</div>}
    </section>
  );
}

interface ModalProps {
  entry: Entry;
  devices: Device[];
  votes: Votes | null;
  onshape: OnshapeLink | null;
  onOnshapeChanged: () => void;
  onVote: (key: string) => Promise<void>;
  onClose: () => void;
}

function EntryModal({ entry, devices, votes, onshape, onOnshapeChanged, onVote, onClose }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);

  const mine = votes?.mine.includes(entry.id) ?? false;
  const total = votes?.counts[entry.id] ?? 0;
  const linked = entry.host ? devices.filter((d) => d.host === entry.host) : [];
  const online = linked.some(isOnline);
  const vote = async () => {
    setBusy(true); setErr(null);
    try { await onVote(entry.id); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const installer = (
    <a className="c-btn primary" href={SETUP_URL}><Download aria-hidden="true" />Windows kurulum programını indir</a>
  );

  return (
    <div className="c-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="c-dialog" role="dialog" aria-modal="true" aria-labelledby="c-modal-title" ref={ref}>
        <div className="c-dialog-head">
          <EntryTile entry={entry} size={48} />
          <div>
            <h2 id="c-modal-title">{entry.name}</h2>
            <span className={`c-pill ${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
          </div>
          <button ref={closeRef} type="button" className="c-icon-btn" aria-label="Kapat" onClick={onClose}><X /></button>
        </div>
        <div className="c-dialog-body">
        <p>{entry.desc}</p>

        {entry.host && (
          <p className="c-status">
            <i className={`c-dot${online ? ' on' : ''}`} />
            {linked.length ? (online ? 'Bağlı' : 'Bağlı, çevrimdışı') : 'Bağlı değil'}
          </p>
        )}

        {entry.cloud === 'onshape' && (
          <>
            <div className="c-note">Beta: bulut bağlantısı yeni; büyük modellerde Onshape'ın STEP çevirisi zaman alabilir.</div>
            <OnshapeConnect link={onshape} onChanged={onOnshapeChanged} />
          </>
        )}

        {entry.status === 'beta' && !entry.cloud && (
          <div className="c-note">Beta: bu programda henüz geniş test edilmedi; sorun olursa model STEP klasörüne düşer.</div>
        )}

        {entry.host && entry.status !== 'folder' && (
          <>
            <ol className="c-howto">
              <li>Kurulum programını indir.</li>
              <li>Programını seç ({entry.name}), Kur'a bas.</li>
              <li>Bağla'ya bas, tarayıcıda onayla.</li>
            </ol>
            <div>{installer}</div>
          </>
        )}

        {entry.status === 'folder' && (
          <>
            <p className="c-muted">
              {entry.name} için doğrudan bir eklenti yok. AICADBridge modeli STEP dosyası olarak bir klasöre bırakır; sen de programında içe aktarırsın.
            </p>
            <ol className="c-howto">
              <li>Kurulum programını indir.</li>
              <li>Kur ekranında <b>STEP klasörü</b> seçeneğini seç.</li>
              <li>Bağla'ya bas, tarayıcıda onayla.</li>
              <li>Gönderdiğin model klasöre düşer; {entry.name}'da İçe aktar ile aç.</li>
            </ol>
            <div>{installer}</div>
          </>
        )}

        {entry.id === 'fusion' && (
          <details className="c-details">
            <summary>Bulamıyor musun?</summary>
            <p className="c-muted">Fusion'da Shift+S → Eklentiler → AICADBridgeLink → Çalıştır.</p>
          </details>
        )}

        {entry.manual && (
          <details className="c-details">
            <summary>Elle kurulum</summary>
            <p className="c-muted">{entry.manual.how}</p>
            <div><a className="c-btn sm" href={`${SITE_URL}/downloads/${entry.manual.file}`}><Download aria-hidden="true" />Zip'i indir</a></div>
          </details>
        )}

        {entry.status === 'soon' && (
          <div className="c-stack">
            <p className="c-muted">Bu bağlantı henüz hazır değil. İstiyorsan haber ver, sırayı buna göre belirleyelim.</p>
            <div className="c-inline">
              {mine
                ? <span className="c-pill ready" role="status">Talebin alındı</span>
                : <button type="button" className="c-btn primary" disabled={busy || !votes} onClick={vote}>İstiyorum</button>}
              {total > 0 && <span className="c-fine" role="status">{total} kişi istiyor</span>}
            </div>
            {!votes && !mine && <p className="c-fine">Talep servisine şu an ulaşılamıyor.</p>}
            {err && <div className="c-error" role="alert">{err}</div>}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export function Integrations({ devices, me, query, anchor, onChanged }: {
  devices: Device[]; me: Me | null; query: URLSearchParams; anchor: string | null; onChanged: () => void;
}) {
  const urlCode = query.get('code') ?? '';
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Exclude<Status, 'soon'>>('all');
  const [codeOpen, setCodeOpen] = useState(false);
  const [open, setOpen] = useState<Entry | null>(null);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [hasKeys, setHasKeys] = useState(false);
  const { link: onshape, refresh: refreshOnshape } = useOnshapeLink();

  // Cihaz durumu yalnız bu sayfa açıkken ve sekme görünürken 20 sn'de bir yenilenir; sekmeye dönünce hemen yenilenir.
  useEffect(() => {
    let t: number | undefined;
    const start = () => { if (t === undefined) t = window.setInterval(onChanged, 20_000); };
    const stop = () => { window.clearInterval(t); t = undefined; };
    const onVis = () => { if (document.hidden) stop(); else { onChanged(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [onChanged]);
  useEffect(() => {
    api<Votes>('/v1/integrations/requests').then(setVotes).catch(() => setVotes(null));
    api<unknown[]>('/v1/api-keys').then((k) => setHasKeys(k.length > 0)).catch(() => undefined);
  }, []);

  const scrollToMcp = useCallback(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('mcp')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }, []);
  useEffect(() => { if (anchor === 'mcp') scrollToMcp(); }, [anchor, scrollToMcp]);

  const approve = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api<{ device: Device }>('/v1/connect/approve', { method: 'POST', json: { user_code: code } });
      setMsg(`Bağlandı: ${r.device.name}. Programına dönebilirsin.`); setCode(''); onChanged();
    } catch (err) { setMsg((err as Error).message); }
  };
  const vote = useCallback(async (key: string) => {
    const r = await api<Votes>('/v1/integrations/requests', { method: 'POST', json: { key } });
    setVotes(r);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  const hostState = useCallback((e: Entry) => {
    const ds = e.host ? devices.filter((d) => d.host === e.host) : [];
    return { connected: ds.length > 0, online: ds.some(isOnline) };
  }, [devices]);
  const isConnected = useCallback(
    (e: Entry) => (e.cloud === 'onshape' ? !!onshape?.connected : e.special ? hasKeys : hostState(e).connected),
    [hasKeys, hostState, onshape],
  );

  const pick = (e: Entry) => { if (e.special) scrollToMcp(); else setOpen(e); };

  const sections = useMemo(() => CATALOG
    .map((c) => ({ ...c, entries: c.entries.filter((e) => matches(e, c.title, q) && (filter === 'all' || e.status === filter)) }))
    .filter((c) => c.entries.length), [q, filter]);

  return (
    <div className="c-page">
      <PageHeader title="Entegrasyonlar"
        desc="Program bu hesaba yalnız dışarı doğru HTTPS ile bağlanır; bilgisayarında port açılmaz. Gönderdiğin model programda yeni parça olarak açılır." />

      {urlCode && <ConnectConfirm key={urlCode} code={urlCode} onDone={onChanged} />}

      <section className="c-card hl c-installer" aria-labelledby="c-installer-h">
        <div className="c-installer-text">
          <h2 id="c-installer-h">Windows kurulum programı</h2>
          <p>Tek programla CAD programlarını seç, kur ve bağla; zip açmana gerek yok.</p>
          <div className="c-installer-actions">
            <a className="c-btn primary" href={SETUP_URL}><Download aria-hidden="true" />Kurulum programını indir</a>
            {!urlCode && <button type="button" className="c-btn" aria-expanded={codeOpen} onClick={() => setCodeOpen(!codeOpen)}>Kodu elle gir</button>}
          </div>
          {codeOpen && !urlCode && (
            <div className="c-installer-code c-stack">
              <form className="c-inline" onSubmit={approve}>
                <input className="c-code-input" name="pair-code" aria-label="Eşleştirme kodu" placeholder="ABCD-1234" value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} autoComplete="off" spellCheck={false} />
                <button className="c-btn primary" disabled={code.replace('-', '').length < 8}>Bağla</button>
              </form>
              {msg && <div className="c-note" role="status">{msg}</div>}
            </div>
          )}
        </div>
        <div className="c-installer-tiles" aria-hidden="true">
          <LogoTile id="fusion" name="Autodesk Fusion" size={48} />
          <LogoTile id="blender" name="Blender" size={48} />
          <LogoTile id="onshape" name="Onshape" size={48} />
        </div>
      </section>

      <section className="c-section" aria-labelledby="c-linked-h">
        <div className="c-section-head">
          <h2 id="c-linked-h" className="c-h2">Bağlı programlar</h2>
          {me?.plan === 'free' && <span className="c-fine">Ücretsiz planda 1 program bağlanabilir.</span>}
        </div>
        <div className="c-card flush c-devices">
          <ul className="c-rows">
            {devices.map((d) => {
              const on = isOnline(d);
              return (
                <li key={d.id} className="c-row">
                  <LogoTile id={d.host} name={hostLabel(d.host)} size={32} icon={d.host === 'other' ? <FolderDown /> : undefined} />
                  <span className="c-row-main">
                    <span className="c-row-title">{d.name}</span>
                    <span className="c-row-sub c-status-line">
                      {on ? <span className="c-pill on"><i className="c-dot on" />Çevrimiçi</span> : null}
                      <span>{hostLabel(d.host)}{on ? '' : d.last_seen ? ` · Son görülme ${ago(d.last_seen)}` : ' · henüz bağlanmadı'}</span>
                    </span>
                  </span>
                  <button type="button" className="c-icon-btn danger" title="Bağlantıyı kaldır" aria-label={`${d.name} bağlantısını kaldır`}
                    onClick={async () => { await api(`/v1/devices/${d.id}`, { method: 'DELETE' }); onChanged(); }}><Trash2 /></button>
                </li>
              );
            })}
            {!devices.length && <li className="c-row-empty">Henüz bağlı program yok. Kurulum programıyla ya da aşağıdan bir program seçerek bağla.</li>}
          </ul>
        </div>
      </section>

      <div className="c-toolbar">
        <label className="c-search">
          <Search aria-hidden="true" />
          <input type="search" name="integration-search" aria-label="Entegrasyon ara" placeholder="Program veya hizmet ara" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="c-seg" role="group" aria-label="Filtre">
          {([['all', 'Tümü'], ['ready', 'Hazır'], ['beta', 'Beta'], ['folder', 'STEP']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {sections.map((c) => (
        <section key={c.id} className="c-cat" aria-labelledby={`c-cat-${c.id}`}>
          <h2 id={`c-cat-${c.id}`} className="c-cat-title">{c.title}</h2>
          <div className="c-int-grid">
            {c.entries.map((e) => {
              const linked = isConnected(e);
              const on = e.special || e.cloud ? true : hostState(e).online;
              return (
                <button key={e.id} type="button" className="c-int" aria-haspopup={e.special ? undefined : 'dialog'} onClick={() => pick(e)}>
                  <span className="c-int-top">
                    <EntryTile entry={e} />
                    <span className="c-int-name">{e.name}</span>
                    {linked
                      ? <span className="c-pill on"><i className={`c-dot${on ? ' on' : ''}`} />Bağlı</span>
                      : <span className={`c-pill ${e.status}`}>{STATUS_LABEL[e.status]}</span>}
                  </span>
                  <span className="c-int-desc" title={e.desc}>{e.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!sections.length && (
        <div className="c-card">
          <Empty icon={<Search />} title="Eşleşen entegrasyon yok" text="Aramayı ya da süzgeci değiştir."
            action={<button type="button" className="c-btn" onClick={() => { setFilter('all'); setQ(''); }}>Tümünü göster</button>} />
        </div>
      )}

      <McpSetup />

      <p className="c-tm">{TRADEMARK}</p>

      {open && <EntryModal entry={open} devices={devices} votes={votes} onshape={onshape} onOnshapeChanged={refreshOnshape} onVote={vote} onClose={close} />}
    </div>
  );
}
