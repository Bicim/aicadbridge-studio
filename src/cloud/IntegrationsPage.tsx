/* Entegrasyonlar: eşleştirme onayı, bağlı programlar, aranabilir katalog ve ayrıntı penceresi. Veri: integrations.ts */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type Device, type Me } from './api';
import {
  ALL_ENTRIES, CATALOG, HOST_LABEL, SETUP_URL, STATUS_LABEL, matches, monoHue, monogram,
  type Entry,
} from './integrations';
import { McpSetup } from './McpSetup';

const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:8124').replace(/\/$/, '');
const ONLINE_MS = 90_000;
const isOnline = (d: Device) => d.online ?? (d.last_seen ? Date.now() - new Date(d.last_seen).getTime() < ONLINE_MS : false);

type ConnectInfo = { host: string; name: string; expires_at: string };
type Votes = { mine: string[]; counts: Record<string, number> };

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
  const label = info ? (HOST_LABEL[info.host as keyof typeof HOST_LABEL] ?? info.host) : '';
  const open = state === 'ready' || state === 'busy';
  return (
    <section className="c-box c-confirm">
      {state === 'loading' && <p className="c-dim">Kod doğrulanıyor…</p>}
      {state === 'done' && <div className="c-note ok">Bağlandı ✓ — programına dönebilirsin.</div>}
      {state === 'cancelled' && <p className="c-dim">Bağlantı iptal edildi. Hiçbir şey bağlanmadı.</p>}
      {open && info && !err && (
        <>
          <div className="c-confirm-app">
            <span className={`c-host ${info.host}`}>{label}</span>
            <b>{info.name}</b>
          </div>
          <h3>Bu bilgisayar hesabına bağlansın mı?</h3>
          <p className="c-fine">Kod <span className="c-mono">{code}</span>. Yalnızca kendi kurduğun programı bağla.</p>
          <div className="c-inline">
            <button className="c-btn primary" disabled={state === 'busy'} onClick={approve}>Bağla</button>
            <button className="c-btn" disabled={state === 'busy'} onClick={() => setState('cancelled')}>İptal</button>
          </div>
        </>
      )}
      {open && err && <div className="c-note">{err}</div>}
    </section>
  );
}

function Tile({ entry, size = 40 }: { entry: Entry; size?: number }) {
  const h = monoHue(entry.id);
  return (
    <span
      className="c-tile" aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 45% 22%)`, color: `hsl(${h} 80% 78%)`, borderColor: `hsl(${h} 40% 34%)` }}
    >{monogram(entry.name)}</span>
  );
}

const Dot = ({ on }: { on: boolean }) => <i className={`c-dot${on ? ' on' : ''}`} />;

interface ModalProps {
  entry: Entry;
  devices: Device[];
  votes: Votes | null;
  onVote: (key: string) => Promise<void>;
  onClose: () => void;
}

function EntryModal({ entry, devices, votes, onVote, onClose }: ModalProps) {
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
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary, [tabindex="0"]'));
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

  return (
    <div className="c-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="c-modal" role="dialog" aria-modal="true" aria-labelledby="c-modal-title" ref={ref}>
        <button ref={closeRef} className="c-x c-modal-x" aria-label="Kapat" onClick={onClose}>×</button>
        <div className="c-modal-head">
          <Tile entry={entry} size={48} />
          <div>
            <h2 id="c-modal-title">{entry.name}</h2>
            <span className={`c-st ${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
          </div>
        </div>
        <p className="c-modal-desc">{entry.desc}</p>

        {entry.host && (
          <p className="c-status c-modal-conn">
            Bağlantı: <Dot on={online} />
            <b>{linked.length ? (online ? 'Bağlı' : 'Bağlı, çevrimdışı') : 'Bağlı değil'}</b>
          </p>
        )}

        {entry.status === 'beta' && (
          <div className="c-note">Beta: bu programda henüz geniş test edilmedi; sorun olursa model STEP klasörüne düşer.</div>
        )}

        {entry.host && entry.status !== 'folder' && (
          <>
            <ol className="c-steps">
              <li>Kurulum programını indir</li>
              <li>Programını seç ({entry.name}), Kur'a bas</li>
              <li>Bağla'ya bas, tarayıcıda onayla</li>
            </ol>
            <a className="c-btn primary c-big" href={SETUP_URL}>Windows kurulum programını indir</a>
          </>
        )}

        {entry.status === 'folder' && (
          <>
            <p className="c-modal-sub">
              {entry.name} için doğrudan bir eklenti yok. AICADBridge modeli STEP dosyası olarak bir klasöre bırakır; sen de programında içe aktarırsın.
            </p>
            <ol className="c-steps">
              <li>Kurulum programını indir</li>
              <li>Kur ekranında <b>STEP klasörü</b> seçeneğini seç</li>
              <li>Bağla'ya bas, tarayıcıda onayla</li>
              <li>Gönderdiğin model klasöre düşer; {entry.name}'da İçe aktar ile aç</li>
            </ol>
            <a className="c-btn primary c-big" href={SETUP_URL}>Windows kurulum programını indir</a>
          </>
        )}

        {entry.id === 'fusion' && (
          <details className="c-manual">
            <summary>Bulamıyor musun?</summary>
            <p className="c-dim">Fusion'da Shift+S → Eklentiler → AICADBridgeLink → Çalıştır.</p>
          </details>
        )}

        {entry.manual && (
          <details className="c-manual">
            <summary>Elle kurulum</summary>
            <p className="c-dim">{entry.manual.how}</p>
            <a className="c-btn" href={`${SITE_URL}/downloads/${entry.manual.file}`}>Zip'i indir</a>
          </details>
        )}

        {entry.status === 'soon' && (
          <div className="c-vote">
            <p className="c-dim">Bu bağlantı henüz hazır değil. İstiyorsan haber ver, sırayı buna göre belirleyelim.</p>
            {mine
              ? <div className="c-note ok" role="status">Talebin alındı ✓</div>
              : <button className="c-btn primary" disabled={busy || !votes} onClick={vote}>İstiyorum</button>}
            {total > 0 && <p className="c-fine" role="status">{total} kişi istiyor</p>}
            {!votes && !mine && <p className="c-fine">Talep servisine şu an ulaşılamıyor.</p>}
            {err && <div className="c-error">{err}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Integrations({ devices, me, query, onChanged }: { devices: Device[]; me: Me | null; query: URLSearchParams; onChanged: () => void }) {
  const urlCode = query.get('code') ?? '';
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'connected'>('all');
  const [open, setOpen] = useState<Entry | null>(null);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    const t = window.setInterval(onChanged, 20_000);
    return () => window.clearInterval(t);
  }, [onChanged]);
  useEffect(() => {
    api<Votes>('/v1/integrations/requests').then(setVotes).catch(() => setVotes(null));
    api<unknown[]>('/v1/api-keys').then((k) => setHasKeys(k.length > 0)).catch(() => undefined);
  }, []);

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
  const isConnected = useCallback((e: Entry) => (e.special ? hasKeys : hostState(e).connected), [hasKeys, hostState]);

  const pick = (e: Entry) => {
    if (e.special) {
      document.getElementById('mcp')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    setOpen(e);
  };

  const sections = useMemo(() => CATALOG
    .map((c) => ({ ...c, entries: c.entries.filter((e) => matches(e, c.title, q) && (filter === 'all' || isConnected(e))) }))
    .filter((c) => c.entries.length), [q, filter, isConnected]);
  const connectedCount = ALL_ENTRIES.filter(isConnected).length;

  return (
    <div className="c-page">
      <h1>Entegrasyonlar</h1>
      <p className="c-dim">Program, bu hesaba yalnızca dışarı doğru HTTPS ile bağlanır; bilgisayarında port açılmaz. Gönderdiğin model programda yeni bir parça olarak açılır.</p>

      {urlCode && <ConnectConfirm key={urlCode} code={urlCode} onDone={onChanged} />}

      <section className="c-banner">
        <div>
          <h3>Windows kurulum programı</h3>
          <p>Tek programı indir, bilgisayarındaki CAD programlarını seç, Kur'a ve ardından Bağla'ya bas. Elle zip açmana gerek kalmaz.</p>
        </div>
        <a className="c-btn primary c-big" href={SETUP_URL}>İndir (.exe)</a>
      </section>

      <section className="c-box" aria-labelledby="c-linked-h">
        <h3 id="c-linked-h">Bağlı programlar</h3>
        <ul className="c-list">
          {devices.map((d) => {
            const on = isOnline(d);
            return (
              <li key={d.id}>
                <span className={`c-host ${d.host}`}>{HOST_LABEL[d.host] ?? d.host}</span>
                <span>{d.name}</span>
                <span className="c-dim c-mono c-status"><Dot on={on} />{on ? 'Bağlı' : `Çevrimdışı · ${d.last_seen ? `son görülme ${new Date(d.last_seen).toLocaleString('tr-TR')}` : 'henüz bağlanmadı'}`}</span>
                <button className="c-x" title="Bağlantıyı kaldır" aria-label={`${d.name} bağlantısını kaldır`} onClick={async () => { await api(`/v1/devices/${d.id}`, { method: 'DELETE' }); onChanged(); }}>×</button>
              </li>
            );
          })}
          {!devices.length && <li className="c-dim">Bağlı program yok.</li>}
        </ul>
        {!urlCode && (
          <details className="c-manual">
            <summary>Eşleştirme kodunu elle gir</summary>
            <form className="c-inline" onSubmit={approve}>
              <input className="c-mono code" aria-label="Eşleştirme kodu" placeholder="ABCD-1234" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} />
              <button className="c-btn primary" disabled={code.replace('-', '').length < 8}>Bağla</button>
            </form>
            {msg && <div className="c-note">{msg}</div>}
          </details>
        )}
        {me?.plan === 'free' && <p className="c-fine">Ücretsiz planda 1 program bağlanabilir.</p>}
      </section>

      <div className="c-toolbar">
        <input className="c-search" type="search" aria-label="Entegrasyon ara" placeholder="Program veya hizmet ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="c-seg" role="group" aria-label="Filtre">
          <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
          <button type="button" aria-pressed={filter === 'connected'} className={filter === 'connected' ? 'active' : ''} onClick={() => setFilter('connected')}>Bağlı{connectedCount ? ` (${connectedCount})` : ''}</button>
        </div>
      </div>

      {sections.map((c) => (
        <section key={c.id} className="c-cat" aria-labelledby={`c-cat-${c.id}`}>
          <h2 id={`c-cat-${c.id}`}>{c.title}</h2>
          <div className="c-int-grid">
            {c.entries.map((e) => {
              const st = hostState(e);
              const linked = e.special ? hasKeys : st.connected;
              return (
                <button key={e.id} type="button" className="c-int-card" aria-haspopup={e.special ? undefined : 'dialog'} onClick={() => pick(e)}>
                  <Tile entry={e} />
                  <span className="c-int-body">
                    <span className="c-int-name">{e.name}</span>
                    <span className="c-int-desc">{e.desc}</span>
                    <span className="c-int-badges">
                      <span className={`c-st ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                      {linked && <span className="c-st on"><Dot on={e.special ? true : st.online} />Bağlı</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!sections.length && (
        <p className="c-dim c-empty">
          {filter === 'connected' && !q ? 'Henüz bağlı program yok. "Tümü"nden birini seçip kur.' : 'Eşleşen entegrasyon yok.'}
        </p>
      )}

      <McpSetup />

      {open && <EntryModal entry={open} devices={devices} votes={votes} onVote={vote} onClose={close} />}
    </div>
  );
}
