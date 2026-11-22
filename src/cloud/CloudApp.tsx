/* AICADBridge Cloud web uygulaması: oturum, kenar çubuğu, hash yönlendirme ve sayfalar. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { api, ApiError, loadByok, saveByok, supabase, type AuditRow, type ByokSettings, type Device, type FileRow, type Me, type Plan, type Project, type Task, type Team } from './api';
import { McpSetup } from './McpSetup';
import { Composer, TaskView } from './TaskView';
import './cloud.css';

const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:8124').replace(/\/$/, '');

function useHashRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path, query: new URLSearchParams(qs ?? '') };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
const go = (p: string) => { window.location.hash = p; };

/* ------------------------------------------------------------------ giriş */
function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = window.location.origin + window.location.pathname;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = mode === 'in'
      ? await supabase!.auth.signInWithPassword({ email, password: pw })
      : await supabase!.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up' && !r.data.session) setMsg('Doğrulama bağlantısı e-postana gönderildi.');
  };
  const magic = async () => {
    if (!email) { setMsg('Önce e-posta adresini yaz.'); return; }
    const r = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setMsg(r.error ? r.error.message : 'Giriş bağlantısı e-postana gönderildi.');
  };
  const google = async () => {
    const r = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (r.error) setMsg('Google girişi bu sunucuda henüz açık değil: ' + r.error.message);
  };

  return (
    <div className="c-login">
      <section className="c-login-art">
        <a className="c-brand" href={SITE_URL}><span className="c-logo" />AICADBridge</a>
        <h1>Anlat, ölçülendir,<br />programına gönder.</h1>
        <p>Doğal dille parametrik CAD modeli üret. STEP olarak indir ya da Fusion 360, Blender ve SolidWorks'e tek tıkla aktar.</p>
        <div className="c-login-fig" aria-hidden>
          <svg viewBox="0 0 320 220"><g fill="none" stroke="currentColor" strokeWidth="1.2">
            <ellipse cx="160" cy="60" rx="90" ry="26" /><path d="M70 60v26c0 14 40 26 90 26s90-12 90-26V60" />
            <ellipse cx="160" cy="60" rx="30" ry="9" />{[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return <ellipse key={i} cx={160 + Math.cos(a) * 62} cy={60 + Math.sin(a) * 18} rx="7" ry="2.4" />; })}
            <path d="M160 112v40" strokeDasharray="3 4" /><rect x="120" y="152" width="80" height="40" rx="3" /><path d="M120 162h80M138 152v40M182 152v40" opacity=".5" />
          </g></svg>
          <span className="c-mono">FIG. 01 · FLANŞ · 1:2</span>
        </div>
      </section>
      <section className="c-login-form">
        <h2>{mode === 'in' ? 'Tekrar hoş geldin' : 'Hesap oluştur'}</h2>
        <p className="c-dim">{mode === 'in' ? 'Hesabına giriş yap.' : 'Ücretsiz planla başla, kart gerekmez.'}</p>
        <button className="c-btn wide outline" onClick={google}>Google ile devam et</button>
        <div className="c-or"><span>veya</span></div>
        <form onSubmit={submit}>
          <input type="email" required placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input type="password" required minLength={6} placeholder="Şifre" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          <button className="c-btn wide primary" disabled={busy}>{mode === 'in' ? 'Giriş yap' : 'Kaydol'}</button>
        </form>
        {mode === 'in' && <button className="c-link" onClick={magic}>Şifresiz giriş bağlantısı gönder</button>}
        {msg && <div className="c-note">{msg}</div>}
        <p className="c-dim">
          {mode === 'in' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
          <button className="c-link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Kaydol' : 'Giriş yap'}</button>
        </p>
        <p className="c-fine">Devam ederek <a href={SITE_URL + '/#sss'}>kullanım koşullarını</a> kabul edersin. <a href="#/local">Hesapsız yerel mod →</a></p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ sayfalar */
const EXAMPLES = ['40×30×20 mm kutu, kenarlar 2 mm yuvarlatılmış', 'Ø100 mm, 10 mm kalın, 6 cıvata delikli flanş', 'Ø25 × 60 mm boru, et kalınlığı 3 mm'];

function Home({ me, onStart }: { me: Me | null; onStart: (p: string) => void }) {
  const [pick, setPick] = useState('');
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const name = me?.name?.split(' ')[0] || me?.email?.split('@')[0] || '';
  return (
    <div className="c-home">
      <div className="c-plan-pill">
        <span>{me?.plan === 'free' ? 'Ücretsiz plan' : me?.plan === 'pro' ? 'Pro' : me?.plan === 'team' ? 'Takım' : '…'}</span>
        {me?.plan === 'free' && <a href="#/billing">Pro'ya geç</a>}
      </div>
      <h1><span className="c-logo big" />{greet}{name ? `, ${name}` : ''}</h1>
      <Composer me={me} busy={false} onSend={onStart} placeholder="Ne tasarlayalım? Ölçüleri ve amacı yaz…" initial={pick} />
      <div className="c-examples">
        {EXAMPLES.map((e) => <button key={e} className="c-chip" onClick={() => setPick(e)}>{e}</button>)}
      </div>
    </div>
  );
}

function TaskList({ tasks, projects, onChanged }: { tasks: Task[]; projects: Project[]; onChanged: () => void }) {
  const [q, setQ] = useState('');
  const shown = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.name;
  return (
    <div className="c-page">
      <h1>Görevler</h1>
      <input className="c-search" placeholder="Görevlerde ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="c-list">
        {shown.map((t) => (
          <li key={t.id}>
            <a href={`#/t/${t.id}`}>{t.title}</a>
            {t.mine === false && <span className="c-host">ORTAK</span>}
            <span className="c-dim c-mono">{pname(t.project_id) ? `${pname(t.project_id)} · ` : ''}{new Date(t.updated_at).toLocaleString('tr-TR')}</span>
            {t.mine !== false && <>
              <select value={t.project_id ?? ''} onChange={async (e) => { await api(`/v1/tasks/${t.id}`, { method: 'PATCH', json: { project_id: e.target.value || null } }); onChanged(); }} aria-label="Proje">
                <option value="">Projesiz</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.team_id ? '⧉ ' : ''}{p.name}</option>)}
              </select>
              <button className="c-x" title="Sil" onClick={async () => { if (confirm(`"${t.title}" silinsin mi?`)) { await api(`/v1/tasks/${t.id}`, { method: 'DELETE' }); onChanged(); } }}>×</button>
            </>}
          </li>
        ))}
        {!shown.length && <li className="c-dim">Görev yok.</li>}
      </ul>
    </div>
  );
}

function Projects({ projects, tasks, me, onChanged }: { projects: Project[]; tasks: Task[]; me: Me | null; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="c-page">
      <h1>Projeler</h1>
      <form className="c-inline" onSubmit={async (e) => {
        e.preventDefault(); if (!name.trim()) return; setErr(null);
        try { await api('/v1/projects', { method: 'POST', json: { name, shared } }); setName(''); onChanged(); } catch (x) { setErr((x as Error).message); }
      }}>
        <input placeholder="Yeni proje adı" value={name} onChange={(e) => setName(e.target.value)} />
        {me?.team && <label className="c-check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {me.team.name} ile paylaş</label>}
        <button className="c-btn primary">Oluştur</button>
      </form>
      {err && <div className="c-error">{err}</div>}
      {projects.map((p) => {
        const ts = tasks.filter((t) => t.project_id === p.id);
        return (
          <section key={p.id} className="c-proj">
            <h3>{p.name} {p.team_id && <span className="c-host">ORTAK</span>} <span className="c-dim c-mono">{ts.length} görev</span>
              {p.user_id === me?.id && <button className="c-x" title="Projeyi sil" onClick={async () => { if (confirm('Proje silinsin mi? Görevler silinmez.')) { await api(`/v1/projects/${p.id}`, { method: 'DELETE' }); onChanged(); } }}>×</button>}</h3>
            <ul className="c-list">{ts.map((t) => <li key={t.id}><a href={`#/t/${t.id}`}>{t.title}</a></li>)}</ul>
          </section>
        );
      })}
      {!projects.length && <p className="c-dim">Görevlerini gruplamak için bir proje oluştur. Görevler sayfasından projeye atayabilirsin.</p>}
    </div>
  );
}

function Files() {
  const [rows, setRows] = useState<FileRow[] | null>(null);
  useEffect(() => { api<FileRow[]>('/v1/files').then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="c-page">
      <h1>Dosyalar</h1>
      {!rows ? <p className="c-dim">Yükleniyor…</p> : !rows.length ? <p className="c-dim">Henüz model yok.</p> : (
        <table className="c-table">
          <thead><tr><th>Model</th><th>Görev</th><th>Tarih</th><th>İndir</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.message_id}>
              <td>{r.title}</td><td><a href={`#/t/${r.task_id}`}>{r.task_title}</a></td>
              <td className="c-mono c-dim">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
              <td className="c-dl">{Object.entries(r.files).map(([f, u]) => <a key={f} className="c-chip" href={u} download={`${r.title}.${f}`}>{f.toUpperCase()}</a>)}</td>
            </tr>))}</tbody>
        </table>
      )}
    </div>
  );
}

const PLUGINS = [
  { host: 'fusion', name: 'Fusion 360', file: 'AICADBridgeLink-fusion.zip', how: 'Zip\'i aç, klasörü Fusion\'da Yardımcı Programlar → Eklentiler → + ile ekle ve çalıştır. Araç çubuğundaki "AICADBridge Bağlan" düğmesi bir kod gösterir.' },
  { host: 'blender', name: 'Blender 4.2+', file: 'aicadbridge_link-blender.zip', how: 'Düzen → Tercihler → Eklentiler → Diskten yükle ile zip\'i seç. Görünüm penceresinde N paneli → AICADBridge → Bağlan.' },
  { host: 'solidworks', name: 'SolidWorks 2021+', file: 'AICADBridgeLink-solidworks.zip', how: 'Zip\'i aç ve run.bat\'ı çalıştır (Python 3 gerekir; pywin32\'yi kendisi kurar). Ekranda çıkan kodu burada onayla. SolidWorks yoksa STEP dosyalarını ~/AICADBridge/inbox klasörüne kaydeder.' },
];

function Integrations({ devices, me, query, onChanged }: { devices: Device[]; me: Me | null; query: URLSearchParams; onChanged: () => void }) {
  const [code, setCode] = useState(query.get('code') ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const approve = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api<{ device: Device }>('/v1/connect/approve', { method: 'POST', json: { user_code: code } });
      setMsg(`Bağlandı: ${r.device.name}. Eklentiye dönebilirsin.`); setCode(''); onChanged();
    } catch (err) { setMsg((err as Error).message); }
  };
  return (
    <div className="c-page">
      <h1>Entegrasyonlar</h1>
      <p className="c-dim">Eklenti, bu hesaba yalnızca dışarı doğru HTTPS ile bağlanır. Bilgisayarında port açılmaz. Gönderdiğin model programda yeni bir bileşen olarak açılır.</p>
      <section className="c-box">
        <h3>Eşleştirme kodu</h3>
        <form className="c-inline" onSubmit={approve}>
          <input className="c-mono code" placeholder="ABCD-1234" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} />
          <button className="c-btn primary" disabled={code.replace('-', '').length < 8}>Bağla</button>
        </form>
        {msg && <div className="c-note">{msg}</div>}
        {me?.plan === 'free' && <p className="c-fine">Ücretsiz planda 1 eklenti bağlanabilir.</p>}
      </section>
      <section className="c-box">
        <h3>Bağlı programlar</h3>
        <ul className="c-list">
          {devices.map((d) => (
            <li key={d.id}>
              <span className={`c-host ${d.host}`}>{PLUGINS.find((p) => p.host === d.host)?.name ?? d.host}</span>
              <span>{d.name}</span>
              <span className="c-dim c-mono">{d.last_seen ? `son görülme ${new Date(d.last_seen).toLocaleString('tr-TR')}` : 'henüz bağlanmadı'}</span>
              <button className="c-x" title="Bağlantıyı kaldır" onClick={async () => { await api(`/v1/devices/${d.id}`, { method: 'DELETE' }); onChanged(); }}>×</button>
            </li>
          ))}
          {!devices.length && <li className="c-dim">Bağlı program yok.</li>}
        </ul>
      </section>
      <div className="c-grid3">
        {PLUGINS.map((p) => (
          <section key={p.host} className="c-box">
            <h3><span className={`c-host ${p.host}`}>{p.name}</span></h3>
            <p className="c-dim">{p.how}</p>
            <a className="c-btn" href={`${SITE_URL}/downloads/${p.file}`}>İndir</a>
          </section>
        ))}
      </div>
      <McpSetup />
    </div>
  );
}

function Billing({ me, query }: { me: Me | null; query: URLSearchParams }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<string | null>(query.get('ok') ? 'Ödeme alındı, planın birkaç saniye içinde güncellenir.' : null);
  useEffect(() => { api<Plan[]>('/v1/plans', { anon: true }).then(setPlans).catch(() => undefined); }, []);
  const buy = async (plan: string) => {
    try { const r = await api<{ url: string }>('/v1/billing/checkout', { method: 'POST', json: { plan } }); window.location.href = r.url; }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="c-page">
      <h1>Plan ve kredi</h1>
      {me && <p>Şu anki plan: <b>{plans.find((p) => p.id === me.plan)?.name ?? me.plan}</b> · <span className="c-mono">{me.credits}</span> kredi ({me.credits_period === 'day' ? 'günlük' : 'aylık'} yenilenir)</p>}
      <p className="c-fine">Her model üretimi ya da düzeltme turu 1 kredi harcar. Parametre kaydırıcılarıyla yeniden kurma ücretsizdir.</p>
      <div className="c-grid3">
        {plans.map((p) => (
          <section key={p.id} className={`c-box plan ${me?.plan === p.id ? 'current' : ''}`}>
            <h3>{p.name}</h3>
            <div className="c-price">${p.price_usd}<span className="c-dim">/{p.period}</span></div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {me?.plan === p.id ? <span className="c-chip">Mevcut plan</span>
              : p.id !== 'free' && <button className="c-btn primary" onClick={() => buy(p.id)}>{p.name}'ya geç</button>}
          </section>
        ))}
      </div>
      {msg && <div className="c-note">{msg}</div>}
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  'team.create': 'takımı kurdu', 'team.invite': 'davet etti', 'team.join': 'takıma katıldı', 'team.remove': 'üyeyi çıkardı',
  'team.leave': 'takımdan ayrıldı', 'project.create': 'proje oluşturdu', 'project.delete': 'projeyi sildi',
  'task.create': 'görev oluşturdu', 'task.delete': 'görevi sildi', 'task.move': 'görevi taşıdı', 'model.generate': 'model üretti',
  'model.send': 'modeli programa gönderdi', 'device.connect': 'eklenti bağladı', 'device.revoke': 'eklentiyi kaldırdı',
};

function TeamPage({ me, refreshMe, onChanged }: { me: Me | null; refreshMe: () => void; onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [log, setLog] = useState<AuditRow[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const t = await api<Team | null>('/v1/team');
    setTeam(t);
    if (t?.role === 'owner') setLog(await api<AuditRow[]>('/v1/team/audit?limit=100'));
  }, []);
  useEffect(() => { load().catch((e) => setMsg((e as Error).message)); }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try { await fn(); await load(); refreshMe(); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };

  if (team === undefined) return <div className="c-page"><h1>Takım</h1><p className="c-dim">Yükleniyor…</p></div>;
  if (!team) return (
    <div className="c-page">
      <h1>Takım</h1>
      <p className="c-dim">Takım kurunca üyelerinle ortak projeler açabilir, birbirinizin modellerini görüp düzenleyebilir ve kim ne yaptı denetim kaydından izleyebilirsin. Her üye kendi kredisini kullanır.</p>
      {me?.plan === 'team' ? (
        <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api('/v1/team', { method: 'POST', json: { name } })); }}>
          <input placeholder="Takım adı" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="c-btn primary">Takımı kur</button>
        </form>
      ) : <p>Takım kurmak <a href="#/billing">Takım planı</a> gerektirir. Bir takıma davet edildiysen, davet edilen e-postayla giriş yapman yeterli.</p>}
      {msg && <div className="c-error">{msg}</div>}
    </div>
  );

  const owner = team.role === 'owner';
  return (
    <div className="c-page">
      <h1>{team.name} <span className="c-host">{owner ? 'SAHİP' : 'ÜYE'}</span></h1>
      {owner && (
        <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (email.trim()) act(async () => { await api('/v1/team/invite', { method: 'POST', json: { email } }); setEmail(''); }); }}>
          <input type="email" placeholder="ekip.arkadasi@firma.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="c-btn primary">Davet et</button>
        </form>
      )}
      {msg && <div className="c-error">{msg}</div>}
      <section className="c-box">
        <h3>Üyeler ({team.members.length})</h3>
        <ul className="c-list">
          {team.members.map((m) => (
            <li key={m.user_id}>
              <span>{m.name || m.email}</span>
              <span className="c-dim c-mono">{m.role === 'owner' ? 'sahip' : 'üye'} · {new Date(m.joined_at).toLocaleDateString('tr-TR')}</span>
              {owner && m.role !== 'owner' && <button className="c-x" title="Takımdan çıkar" onClick={() => confirm(`${m.email} çıkarılsın mı?`) && act(() => api(`/v1/team/members/${m.user_id}`, { method: 'DELETE' }))}>×</button>}
            </li>
          ))}
          {team.invites.map((i) => (
            <li key={i.email}>
              <span>{i.email}</span><span className="c-dim c-mono">davet bekliyor</span>
              <button className="c-x" title="Daveti iptal et" onClick={() => act(() => api(`/v1/team/invites/${encodeURIComponent(i.email)}`, { method: 'DELETE' }))}>×</button>
            </li>
          ))}
        </ul>
        {!owner && <button className="c-btn" onClick={() => confirm('Takımdan ayrılmak istiyor musun?') && act(() => api('/v1/team/leave', { method: 'POST' }))}>Takımdan ayrıl</button>}
      </section>
      {owner && (
        <section className="c-box">
          <h3>Denetim kaydı</h3>
          <table className="c-table">
            <thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th></tr></thead>
            <tbody>{log.map((r) => (
              <tr key={r.id}>
                <td className="c-mono c-dim">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                <td>{r.email ?? '–'}</td>
                <td>{ACTIONS[r.action] ?? r.action}{r.meta && typeof r.meta.name === 'string' ? `: ${r.meta.name}` : ''}{r.meta && typeof r.meta.host === 'string' ? ` (${r.meta.host})` : ''}</td>
              </tr>))}
              {!log.length && <tr><td colSpan={3} className="c-dim">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Settings({ me }: { me: Me | null }) {
  const [s, setS] = useState<ByokSettings>(loadByok);
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<ByokSettings>) => { setS({ ...s, ...p }); setSaved(false); };
  return (
    <div className="c-page">
      <h1>Ayarlar</h1>
      <section className="c-box">
        <h3>Model</h3>
        <p className="c-dim">Varsayılan: <span className="c-mono">{me?.llm.model}</span> (sunucu, kredi harcar).</p>
        <label className="c-check"><input type="checkbox" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Kendi API anahtarımı kullan (Pro/Takım, kredi harcamaz)</label>
        <div className="c-form">
          <label>Sağlayıcı<select value={s.provider} onChange={(e) => set({ provider: e.target.value })}>
            <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google Gemini</option>
            <option value="openrouter">OpenRouter</option><option value="custom">OpenAI uyumlu (özel URL)</option></select></label>
          <label>Model<input className="c-mono" value={s.model} onChange={(e) => set({ model: e.target.value })} /></label>
          <label>API anahtarı<input type="password" className="c-mono" value={s.api_key} onChange={(e) => set({ api_key: e.target.value })} placeholder="yalnızca bu tarayıcıda saklanır" /></label>
          {s.provider === 'custom' && <label>Base URL<input className="c-mono" value={s.base_url} onChange={(e) => set({ base_url: e.target.value })} /></label>}
        </div>
        <button className="c-btn primary" onClick={() => { saveByok(s); setSaved(true); }}>Kaydet</button> {saved && <span className="c-dim">Kaydedildi</span>}
      </section>
      <section className="c-box">
        <h3>Hesap</h3>
        <div className="c-profile">
          <Avatar me={me} />
          <div>
            <b>{me?.name || me?.email?.split('@')[0]}</b>
            <p className="c-dim">{me?.email}</p>
            <p className="c-fine">Giriş yöntemi: {me?.provider === 'google' ? 'Google' : me?.provider === 'email' ? 'E-posta' : me?.provider ?? '-'} · Plan: {me?.plan === 'free' ? 'Ücretsiz' : me?.plan === 'pro' ? 'Pro' : 'Takım'}</p>
          </div>
        </div>
        <p className="c-fine">Görevlerin, modellerin ve dosyaların AICADBridge sunucusunda hesabına bağlı saklanır; başka kullanıcılar göremez.</p>
        <button className="c-btn" onClick={() => supabase!.auth.signOut()}>Çıkış yap</button>
      </section>
    </div>
  );
}

function Avatar({ me }: { me: Me | null }) {
  const [broken, setBroken] = useState(false);
  if (me?.avatar_url && !broken) {
    return <img className="c-avatar-s" src={me.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="c-avatar-s">{(me?.name || me?.email || '?').slice(0, 2).toUpperCase()}</span>;
}

/* ------------------------------------------------------------------ kabuk */
export function CloudApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const route = useHashRoute();

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshMe = useCallback(() => { api<Me>('/v1/me').then((m) => { setMe(m); setApiErr(null); }).catch((e: ApiError) => setApiErr(e.message)); }, []);
  const refreshTasks = useCallback(() => {
    api<Task[]>('/v1/tasks').then(setTasks).catch(() => undefined);
    api<Project[]>('/v1/projects').then(setProjects).catch(() => undefined);
  }, []);
  const refreshDevices = useCallback(() => { api<Device[]>('/v1/devices').then(setDevices).catch(() => undefined); }, []);

  useEffect(() => {
    if (!session) return;
    refreshMe(); refreshTasks(); refreshDevices();
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (prompt: string) => {
    try {
      const t = await api<Task>('/v1/tasks', { method: 'POST', json: {} });
      setPending(prompt); setTasks((ts) => [t, ...ts]); go(`/t/${t.id}`);
    } catch (e) { setApiErr((e as Error).message); }
  };

  const taskId = route.path.startsWith('/t/') ? route.path.slice(3) : null;
  const nav = useMemo(() => [
    ['/', '＋', 'Yeni görev'], ['/tasks', '☰', 'Görevler'], ['/projects', '▤', 'Projeler'],
    ['/files', '⇩', 'Dosyalar'], ['/team', '◎', 'Takım'], ['/integrations', '⧉', 'Entegrasyonlar'], ['/billing', '◈', 'Plan ve kredi'], ['/settings', '⚙', 'Ayarlar'],
  ], []);

  if (session === undefined) return <div className="c-boot"><span className="c-spin" /></div>;
  if (!session) return <Login />;

  return (
    <div className={`c-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="c-side">
        <div className="c-side-top">
          <a className="c-brand" href="#/"><span className="c-logo" />{!collapsed && 'AICADBridge'}</a>
          <button className="c-icon" onClick={() => setCollapsed(!collapsed)} aria-label="Kenar çubuğunu daralt">▮▯</button>
        </div>
        <nav>
          {nav.map(([p, icon, label]) => (
            <a key={p} href={`#${p}`} className={route.path === p ? 'active' : ''} title={label}><span className="c-ico">{icon}</span>{!collapsed && label}</a>
          ))}
        </nav>
        {!collapsed && (
          <div className="c-recent">
            <div className="c-dim c-mono">SON GÖREVLER</div>
            {tasks.slice(0, 12).map((t) => <a key={t.id} href={`#/t/${t.id}`} className={taskId === t.id ? 'active' : ''}>{t.title}</a>)}
          </div>
        )}
        <div className="c-side-foot">
          {!collapsed && me && <a className="c-credits" href="#/billing"><span className="c-mono">{me.credits}</span> kredi · {me.plan === 'free' ? 'Ücretsiz' : me.plan === 'pro' ? 'Pro' : 'Takım'}</a>}
          <a className="c-user" href="#/settings">
            <Avatar me={me} />
            {!collapsed && <span><b>{me?.name || me?.email?.split('@')[0]}</b><small>{me?.email}</small></span>}
          </a>
        </div>
      </aside>
      <main className="c-main">
        {apiErr && <div className="c-error top">{apiErr}</div>}
        {taskId ? (
          <TaskView key={taskId} taskId={taskId} me={me} devices={devices} initialPrompt={pending}
            onConsumedPrompt={() => setPending(null)} onChanged={refreshTasks} refreshMe={refreshMe} />
        ) : route.path === '/tasks' ? <TaskList tasks={tasks} projects={projects} onChanged={refreshTasks} />
          : route.path === '/projects' ? <Projects projects={projects} tasks={tasks} me={me} onChanged={refreshTasks} />
          : route.path === '/team' ? <TeamPage me={me} refreshMe={refreshMe} onChanged={refreshTasks} />
          : route.path === '/files' ? <Files />
          : route.path === '/integrations' || route.path === '/connect' ? <Integrations devices={devices} me={me} query={route.query} onChanged={refreshDevices} />
          : route.path === '/billing' ? <Billing me={me} query={route.query} />
          : route.path === '/settings' ? <Settings me={me} />
          : <Home me={me} onStart={start} />}
      </main>
    </div>
  );
}
