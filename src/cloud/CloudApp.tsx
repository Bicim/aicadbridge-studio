/* AICADBridge Cloud web uygulaması: oturum kapısı, veri yükleme ve hash yönlendirme.
   Ağır ekranlar (görev + 3B görüntüleyici, entegrasyonlar, hesap sayfaları) ilk ziyarette ayrı parça olarak yüklenir. */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/auth-js';
import { LucideProvider } from 'lucide-react';
import { api, ApiError, auth, type Device, type Me, type Project, type Task } from './api';
import { Home } from './Home';
import { Login, takePendingCode } from './Login';
import { Shell } from './Shell';
import { PageSkeleton } from './ui';
import './cloud.css';

const TaskView = lazy(() => import('./TaskView').then((m) => ({ default: m.TaskView })));
const Integrations = lazy(() => import('./IntegrationsPage').then((m) => ({ default: m.Integrations })));
const pages = () => import('./pages');
const TaskList = lazy(() => pages().then((m) => ({ default: m.TaskList })));
const Projects = lazy(() => pages().then((m) => ({ default: m.Projects })));
const Files = lazy(() => pages().then((m) => ({ default: m.Files })));
const Billing = lazy(() => pages().then((m) => ({ default: m.Billing })));
const TeamPage = lazy(() => pages().then((m) => ({ default: m.TeamPage })));
const Settings = lazy(() => pages().then((m) => ({ default: m.Settings })));

interface Route { path: string; query: URLSearchParams; anchor: string | null }

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  // "#mcp" bağlantısı: Entegrasyonlar'daki MCP bölümüne gider.
  if (raw === 'mcp') return { path: '/integrations', query: new URLSearchParams(), anchor: 'mcp' };
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs ?? ''), anchor: null };
}

function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
const go = (p: string) => { window.location.hash = p; };

const TITLES: Record<string, string> = {
  '/tasks': 'Görevler', '/projects': 'Projeler', '/files': 'Dosyalar', '/integrations': 'Entegrasyonlar',
  '/connect': 'Program bağla', '/billing': 'Plan ve kredi', '/team': 'Takım', '/settings': 'Ayarlar',
};

export function CloudApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
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

  const taskId = route.path.startsWith('/t/') ? route.path.slice(3) : null;
  const taskTitle = taskId ? tasks.find((t) => t.id === taskId)?.title : undefined;
  useEffect(() => {
    const name = taskId ? taskTitle : TITLES[route.path];
    document.title = name ? `${name} · AICADBridge` : 'AICADBridge Studio';
  }, [route.path, taskId, taskTitle]);

  const start = async (prompt: string) => {
    try {
      const t = await api<Task>('/v1/tasks', { method: 'POST', json: {} });
      setPending(prompt); setTasks((ts) => [t, ...ts]); go(`/t/${t.id}`);
    } catch (e) { setApiErr((e as Error).message); }
  };

  if (session === undefined) return <div className="boot" aria-busy="true"><span className="spinner" /></div>;

  const p = route.path;
  const page = taskId ? (
    <TaskView key={taskId} taskId={taskId} me={me} devices={devices} initialPrompt={pending}
      onConsumedPrompt={() => setPending(null)} onChanged={refreshTasks} refreshMe={refreshMe} refreshDevices={refreshDevices} />
  ) : p === '/tasks' ? <TaskList tasks={tasks} projects={projects} onChanged={refreshTasks} />
    : p === '/projects' ? <Projects projects={projects} tasks={tasks} me={me} onChanged={refreshTasks} />
    : p === '/team' ? <TeamPage me={me} refreshMe={refreshMe} onChanged={refreshTasks} />
    : p === '/files' ? <Files />
    : p === '/integrations' || p === '/connect' ? <Integrations devices={devices} me={me} query={route.query} anchor={route.anchor} onChanged={refreshDevices} />
    : p === '/billing' ? <Billing me={me} query={route.query} />
    : p === '/settings' ? <Settings me={me} />
    : <Home me={me} onStart={start} />;

  return (
    <LucideProvider size={18} strokeWidth={1.5}>
      <div className="c-app">
        {!session ? <Login /> : (
          <Shell me={me} tasks={tasks} path={p}>
            {apiErr && <div className="c-api-err"><div className="c-error" role="alert">{apiErr}</div></div>}
            <Suspense fallback={<PageSkeleton />}>{page}</Suspense>
          </Shell>
        )}
      </div>
    </LucideProvider>
  );
}
