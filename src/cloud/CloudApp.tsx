/* AICADBridge Cloud web uygulaması: oturum, kenar çubuğu, hash yönlendirme ve sayfalar. */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/auth-js';
import { api, ApiError, auth, authProviders, type Device, type Me, type Project, type Task } from './api';
import { Composer } from './Composer';
import { Avatar } from './ui';
import './cloud.css';

/* Ağır ekranlar ayrı parçalar: görev (3B görüntüleyici), entegrasyonlar ve hesap sayfaları ilk açılışta yüklenir. */
const TaskView = lazy(() => import('./TaskView').then((m) => ({ default: m.TaskView })));
const Integrations = lazy(() => import('./IntegrationsPage').then((m) => ({ default: m.Integrations })));
const TaskList = lazy(() => import('./pages').then((m) => ({ default: m.TaskList })));
const Projects = lazy(() => import('./pages').then((m) => ({ default: m.Projects })));
const Files = lazy(() => import('./pages').then((m) => ({ default: m.Files })));
const Billing = lazy(() => import('./pages').then((m) => ({ default: m.Billing })));
const TeamPage = lazy(() => import('./pages').then((m) => ({ default: m.TeamPage })));
const Settings = lazy(() => import('./pages').then((m) => ({ default: m.Settings })));

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

/* Eşleştirme kodu: OAuth / e-posta bağlantısı hash'i düşürür, bu yüzden girişten önce sessionStorage'da saklanır. */
const PENDING_CODE_KEY = 'aicad.pendingCode';
const stashPendingCode = () => {
  try {
    const m = window.location.hash.match(/^#\/connect\?(.*)$/);
    const c = m ? new URLSearchParams(m[1]).get('code') : null;
    if (c) sessionStorage.setItem(PENDING_CODE_KEY, c);
  } catch { /* depolama kapalı olabilir */ }
};
const takePendingCode = (): string | null => {
  try { const c = sessionStorage.getItem(PENDING_CODE_KEY); if (c) sessionStorage.removeItem(PENDING_CODE_KEY); return c; } catch { return null; }
};

/* ------------------------------------------------------------------ giriş */
function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = window.location.origin + window.location.pathname;
  const [providers, setProviders] = useState<{ google: boolean; email: boolean } | null>(null);
  useEffect(() => { authProviders().then(setProviders); stashPendingCode(); }, []);
  const googleOff = providers !== null && !providers.google;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = mode === 'in'
      ? await auth!.signInWithPassword({ email, password: pw })
      : await auth!.signUp({ email, password: pw, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up' && !r.data.session) setMsg('Doğrulama bağlantısı e-postana gönderildi.');
  };
  const magic = async () => {
    if (!email) { setMsg('Önce e-posta adresini yaz.'); return; }
    const r = await auth!.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setMsg(r.error ? r.error.message : 'Giriş bağlantısı e-postana gönderildi.');
  };
  const google = async () => {
    const r = await auth!.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
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
        <button className="c-btn wide outline" onClick={google} disabled={googleOff}>Google ile devam et</button>
        {googleOff && <p className="c-fine">Google girişi bu sunucuda henüz yapılandırılıyor.</p>}
        <div className="c-or"><span>veya</span></div>
        <form onSubmit={submit}>
          <input type="email" name="email" id="login-email" required placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input type="password" name="password" id="login-password" required minLength={6} placeholder="Şifre" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
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
    auth!.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth!.onAuthStateChange((_e, s) => setSession(s));
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
    const pendingCode = takePendingCode();
    if (pendingCode && !window.location.hash.startsWith('#/connect')) go(`/connect?code=${encodeURIComponent(pendingCode)}`);
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
        <Suspense fallback={<div className="c-boot"><span className="c-spin" /></div>}>
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
        </Suspense>
      </main>
    </div>
  );
}
