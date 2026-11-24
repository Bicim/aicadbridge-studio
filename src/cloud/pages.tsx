/* Hafif hesap sayfaları (Görevler, Projeler, Dosyalar, Plan, Takım, Ayarlar): tek parça halinde, ilk ziyarette yüklenir. */
import { useCallback, useEffect, useState } from 'react';
import { Check, FileBox, FolderKanban, ListTodo, LogOut, Search, SquarePen, Trash2 } from 'lucide-react';
import { getTheme, setTheme, type ThemeChoice } from '../theme';
import { api, auth, loadByok, saveByok, type AuditRow, type ByokSettings, type FileRow, type Me, type Plan, type Project, type Task, type Team } from './api';
import { Avatar, Empty, PLAN_LABEL, PageHeader, displayName, toast } from './ui';

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const NewTask = () => <a className="c-btn primary" href="#/"><SquarePen aria-hidden="true" />Yeni görev</a>;

export function TaskList({ tasks, projects, onChanged }: { tasks: Task[]; projects: Project[]; onChanged: () => void }) {
  const [q, setQ] = useState('');
  const n = q.trim().toLocaleLowerCase('tr-TR');
  const shown = tasks.filter((t) => t.title.toLocaleLowerCase('tr-TR').includes(n));
  return (
    <div className="c-page">
      <PageHeader title="Görevler" />
      {!tasks.length ? (
        <div className="c-card"><Empty icon={<ListTodo />} title="Henüz görev yok" text="İlk modelini bir cümleyle tarif et." action={<NewTask />} /></div>
      ) : (
        <>
          <div className="c-toolbar">
            <label className="c-search">
              <Search aria-hidden="true" />
              <input type="search" name="task-search" aria-label="Görevlerde ara" placeholder="Görevlerde ara" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <NewTask />
          </div>
          <div className="c-card flush c-table-wrap">
            <table className="c-table">
              <thead><tr><th>Görev</th><th>Proje</th><th>Güncellendi</th><th /></tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id}>
                    <td><a href={`#/t/${t.id}`}>{t.title}</a></td>
                    <td>{t.mine === false ? <span className="c-pill">Ortak</span> : (
                      <select className="sm" name={`project-${t.id}`} value={t.project_id ?? ''} aria-label={`${t.title}: proje`}
                        onChange={async (e) => { await api(`/v1/tasks/${t.id}`, { method: 'PATCH', json: { project_id: e.target.value || null } }); onChanged(); }}>
                        <option value="">Projesiz</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.team_id ? ' (ortak)' : ''}</option>)}
                      </select>
                    )}</td>
                    <td className="c-nowrap">{when(t.updated_at)}</td>
                    <td className="act">{t.mine !== false && (
                      <button type="button" className="c-icon-btn danger" title="Sil" aria-label={`${t.title} görevini sil`}
                        onClick={async () => { if (confirm(`"${t.title}" silinsin mi?`)) { await api(`/v1/tasks/${t.id}`, { method: 'DELETE' }); onChanged(); } }}><Trash2 /></button>
                    )}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={4} className="c-row-empty">"{q}" ile eşleşen görev yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function Projects({ projects, tasks, me, onChanged }: { projects: Project[]; tasks: Task[]; me: Me | null; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="c-page">
      <PageHeader title="Projeler" desc="Görevlerini projelerde topla; Görevler sayfasından projeye atayabilirsin." />
      <form className="c-inline" onSubmit={async (e) => {
        e.preventDefault(); if (!name.trim()) return; setErr(null);
        try { await api('/v1/projects', { method: 'POST', json: { name, shared } }); setName(''); onChanged(); } catch (x) { setErr((x as Error).message); }
      }}>
        <input name="project-name" aria-label="Yeni proje adı" placeholder="Yeni proje adı" value={name} onChange={(e) => setName(e.target.value)} />
        {me?.team && <label className="c-check"><input type="checkbox" name="project-shared" checked={shared} onChange={(e) => setShared(e.target.checked)} />{me.team.name} ile paylaş</label>}
        <button className="c-btn primary" disabled={!name.trim()}>Oluştur</button>
      </form>
      {err && <div className="c-error" role="alert">{err}</div>}
      {!projects.length && <div className="c-card"><Empty icon={<FolderKanban />} title="Henüz proje yok" text="Yukarıdan ilk projeni oluştur." /></div>}
      <div className="c-proj-grid">
        {projects.map((p) => {
          const ts = tasks.filter((t) => t.project_id === p.id);
          return (
            <section key={p.id} className="c-card" aria-label={p.name}>
              <div className="c-card-head">
                <h2>{p.name}</h2>
                <span className="c-inline">
                  {p.team_id && <span className="c-pill">Ortak</span>}
                  <span className="c-fine">{ts.length} görev</span>
                  {p.user_id === me?.id && (
                    <button type="button" className="c-icon-btn danger" title="Projeyi sil" aria-label={`${p.name} projesini sil`}
                      onClick={async () => { if (confirm('Proje silinsin mi? Görevler silinmez.')) { await api(`/v1/projects/${p.id}`, { method: 'DELETE' }); onChanged(); } }}><Trash2 /></button>
                  )}
                </span>
              </div>
              {ts.length > 0
                ? <ul className="c-proj-tasks">{ts.map((t) => <li key={t.id}><a href={`#/t/${t.id}`}>{t.title}</a></li>)}</ul>
                : <p className="c-fine">Bu projede görev yok.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function Files() {
  const [rows, setRows] = useState<FileRow[] | null>(null);
  useEffect(() => { api<FileRow[]>('/v1/files').then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="c-page">
      <PageHeader title="Dosyalar" desc="Ürettiğin modellerin STEP, STL ve GLB dosyaları." />
      {!rows ? <p className="c-muted">Yükleniyor…</p> : !rows.length ? (
        <div className="c-card"><Empty icon={<FileBox />} title="Henüz model yok" text="Ürettiğin modellerin STEP, STL ve GLB dosyaları burada toplanır." action={<NewTask />} /></div>
      ) : (
        <div className="c-card flush c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Model</th><th>Görev</th><th>Tarih</th><th>Tür</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.message_id}>
                <td>{r.title}</td>
                <td><a href={`#/t/${r.task_id}`}>{r.task_title}</a></td>
                <td className="c-nowrap">{when(r.created_at)}</td>
                <td className="type"><span className="c-dl">{Object.entries(r.files).map(([f, u]) => <a key={f} href={u} download={`${r.title}.${f}`} aria-label={`${r.title} ${f.toUpperCase()} indir`}>{f}</a>)}</span></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Billing({ me, query }: { me: Me | null; query: URLSearchParams }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const paid = !!query.get('ok');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<Plan[]>('/v1/plans', { anon: true }).then(setPlans).catch(() => undefined); }, []);
  useEffect(() => { if (paid) toast('Ödeme alındı, planın birkaç saniye içinde güncellenir.'); }, [paid]);
  // Tek birincil eylem: mevcut plandan sonraki ilk ücretli plan.
  const cur = plans.findIndex((p) => p.id === me?.plan);
  const next = plans.find((p, i) => p.id !== 'free' && i > cur);
  const buy = async (plan: string) => {
    try { const r = await api<{ url: string }>('/v1/billing/checkout', { method: 'POST', json: { plan } }); window.location.href = r.url; }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="c-page">
      <PageHeader title="Plan ve kredi" desc="Her model üretimi ya da düzeltme turu 1 kredi harcar; parametre kaydırıcılarıyla yeniden kurma ücretsizdir." />
      {paid && <div className="c-note ok" role="status"><Check aria-hidden="true" />Ödeme alındı, planın birkaç saniye içinde güncellenir.</div>}
      {msg && <div className="c-error" role="alert">{msg}</div>}
      {me && (
        <section className="c-card c-summary" aria-label="Mevcut durum">
          <div>
            <div className="c-label-t">Kalan kredi</div>
            <div className="c-summary-num">
              <b>{me.credits}</b>
              <span className="c-pill beta">{plans.find((p) => p.id === me.plan)?.name ?? PLAN_LABEL[me.plan]}</span>
            </div>
            <p className="c-fine" style={{ marginTop: 4 }}>{me.credits_period === 'day' ? 'Günlük yenilenir' : 'Aylık yenilenir'}</p>
          </div>
          {next && <button type="button" className="c-btn primary" onClick={() => buy(next.id)}>{next.id === 'pro' ? "Pro'ya geç" : `${next.name} planına geç`}</button>}
        </section>
      )}
      <div className="c-plans">
        {plans.map((p) => (
          <section key={p.id} className={`c-card c-plan${me?.plan === p.id ? ' current' : ''}${p.id === next?.id ? ' hot' : ''}`} aria-label={p.name}>
            <h2>{p.name}</h2>
            <div className="c-price"><i>$</i><b>{p.price_usd}</b><small>/ {p.period}</small></div>
            <hr />
            <ul className="c-features">{p.features.map((f) => <li key={f}><Check aria-hidden="true" />{f}</li>)}</ul>
            {me?.plan === p.id ? <span className="c-pill beta cur">Mevcut plan</span>
              : p.id !== 'free' && (
                <button type="button" className={`c-btn lg block${p.id === next?.id ? ' primary' : ''}`} onClick={() => buy(p.id)}>{p.name} planına geç</button>
              )}
          </section>
        ))}
      </div>
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  'team.create': 'takımı kurdu', 'team.invite': 'davet etti', 'team.join': 'takıma katıldı', 'team.remove': 'üyeyi çıkardı',
  'team.leave': 'takımdan ayrıldı', 'project.create': 'proje oluşturdu', 'project.delete': 'projeyi sildi',
  'task.create': 'görev oluşturdu', 'task.delete': 'görevi sildi', 'task.move': 'görevi taşıdı', 'model.generate': 'model üretti',
  'model.send': 'modeli programa gönderdi', 'device.connect': 'eklenti bağladı', 'device.revoke': 'eklentiyi kaldırdı',
};

export function TeamPage({ me, refreshMe, onChanged }: { me: Me | null; refreshMe: () => void; onChanged: () => void }) {
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
  useEffect(() => { load().catch((e) => { setTeam(null); setMsg((e as Error).message); }); }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try { await fn(); await load(); refreshMe(); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };

  if (team === undefined) return <div className="c-page"><PageHeader title="Takım" /><p className="c-muted">Yükleniyor…</p></div>;
  if (!team) return (
    <div className="c-page narrow">
      <PageHeader title="Takım" desc="Takımla ortak projeler açar, birbirinizin modellerini görüp düzenler ve kimin ne yaptığını denetim kaydından izlersiniz. Her üye kendi kredisini kullanır." />
      <section className="c-card">
        {me?.plan === 'team' ? (
          <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api('/v1/team', { method: 'POST', json: { name } })); }}>
            <input name="team-name" aria-label="Takım adı" placeholder="Takım adı" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="c-btn primary" disabled={!name.trim()}>Takımı kur</button>
          </form>
        ) : (
          <>
            <p>Takım kurmak Takım planı gerektirir. Bir takıma davet edildiysen, davet edilen e-postayla giriş yapman yeterli.</p>
            <div><a className="c-btn primary" href="#/billing">Planları gör</a></div>
          </>
        )}
      </section>
      {msg && <div className="c-error" role="alert">{msg}</div>}
    </div>
  );

  const owner = team.role === 'owner';
  const ini = (m: { name?: string | null; email: string }) => (m.name || m.email).slice(0, 2).toUpperCase();
  return (
    <div className="c-page">
      <PageHeader title={<>{team.name} <span className="c-pill">{owner ? 'Sahip' : 'Üye'}</span></>} />
      <section className="c-card c-summary" aria-label="Takım özeti">
        <div>
          <div className="c-label-t">Üyeler</div>
          <div className="c-summary-num"><b>{team.members.length}</b>{team.invites.length > 0 && <span className="c-pill">{team.invites.length} davet bekliyor</span>}</div>
        </div>
        {!owner && <button type="button" className="c-btn sm" onClick={() => confirm('Takımdan ayrılmak istiyor musun?') && act(() => api('/v1/team/leave', { method: 'POST' }))}><LogOut aria-hidden="true" />Takımdan ayrıl</button>}
      </section>
      {msg && <div className="c-error" role="alert">{msg}</div>}
      <section className="c-section" aria-labelledby="team-members-h">
        <h2 id="team-members-h" className="c-h2">Üyeler</h2>
        <div className="c-card flush c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Üye</th><th>E-posta</th><th>Rol</th><th /></tr></thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.user_id}>
                  <td><span className="who"><span className="c-avatar sm" aria-hidden="true">{ini(m)}</span>{m.name || m.email}</span></td>
                  <td>{m.email}</td>
                  <td><span className="c-pill">{m.role === 'owner' ? 'Sahip' : 'Üye'}</span></td>
                  <td className="act">{owner && m.role !== 'owner' && (
                    <button type="button" className="c-icon-btn danger" title="Takımdan çıkar" aria-label={`${m.email} üyesini çıkar`}
                      onClick={() => confirm(`${m.email} çıkarılsın mı?`) && act(() => api(`/v1/team/members/${m.user_id}`, { method: 'DELETE' }))}><Trash2 /></button>
                  )}</td>
                </tr>
              ))}
              {team.invites.map((i) => (
                <tr key={i.email}>
                  <td><span className="who"><span className="c-avatar sm" aria-hidden="true">{i.email.slice(0, 2).toUpperCase()}</span>{i.email}</span></td>
                  <td>–</td>
                  <td><span className="c-pill warn">Davet bekliyor</span></td>
                  <td className="act">{owner && (
                    <button type="button" className="c-icon-btn danger" title="Daveti iptal et" aria-label={`${i.email} davetini iptal et`}
                      onClick={() => act(() => api(`/v1/team/invites/${encodeURIComponent(i.email)}`, { method: 'DELETE' }))}><Trash2 /></button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {owner && (
          <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (email.trim()) act(async () => { await api('/v1/team/invite', { method: 'POST', json: { email } }); setEmail(''); }); }}>
            <input type="email" name="invite-email" aria-label="Davet edilecek e-posta" placeholder="ekip.arkadasi@firma.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="c-btn" disabled={!email.trim()}>Davet et</button>
          </form>
        )}
      </section>
      {owner && (
        <section className="c-section" aria-labelledby="team-audit-h">
          <h2 id="team-audit-h" className="c-h2">Denetim kaydı</h2>
          <div className="c-card flush c-table-wrap">
            <table className="c-table">
              <thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th></tr></thead>
              <tbody>{log.map((r) => (
                <tr key={r.id}>
                  <td className="c-nowrap">{when(r.created_at)}</td>
                  <td>{r.email ?? '–'}</td>
                  <td>{ACTIONS[r.action] ?? r.action}{r.meta && typeof r.meta.name === 'string' ? `: ${r.meta.name}` : ''}{r.meta && typeof r.meta.host === 'string' ? ` (${r.meta.host})` : ''}</td>
                </tr>))}
                {!log.length && <tr><td colSpan={3} className="c-muted">Kayıt yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const THEMES: { id: ThemeChoice; label: string }[] = [{ id: 'system', label: 'Sistem' }, { id: 'dark', label: 'Koyu' }, { id: 'light', label: 'Açık' }];

export function Settings({ me }: { me: Me | null }) {
  const [s, setS] = useState<ByokSettings>(loadByok);
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme);
  const set = (p: Partial<ByokSettings>) => setS({ ...s, ...p });
  return (
    <div className="c-page narrow">
      <PageHeader title="Ayarlar" />
      <section className="c-card" aria-labelledby="set-look-h">
        <h2 id="set-look-h">Görünüm</h2>
        <p>Koyu ya da açık temayı seç; Sistem seçilirse cihazının tercihi izlenir.</p>
        <div className="c-seg" role="group" aria-label="Tema">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => { setTheme(t.id); setThemeState(t.id); }}>{t.label}</button>
          ))}
        </div>
      </section>
      <section className="c-card" aria-labelledby="set-account-h">
        <h2 id="set-account-h">Profil</h2>
        <div className="c-profile">
          <Avatar me={me} large />
          <div>
            <b>{displayName(me)}</b>
            <p className="c-muted">{me?.email}</p>
            <p className="c-fine">Giriş yöntemi: {me?.provider === 'google' ? 'Google' : me?.provider === 'email' ? 'E-posta' : me?.provider ?? '–'} · Plan: {me ? PLAN_LABEL[me.plan] : '–'}</p>
          </div>
        </div>
        <p className="c-fine">Görevlerin, modellerin ve dosyaların AICADBridge sunucusunda hesabına bağlı saklanır; başka kullanıcılar göremez.</p>
        <div className="c-actions"><button type="button" className="c-btn" onClick={() => { void auth!.signOut(); }}><LogOut aria-hidden="true" />Çıkış yap</button></div>
      </section>
      <section className="c-card" aria-labelledby="set-model-h">
        <h2 id="set-model-h">API anahtarı</h2>
        <p>Varsayılan model: <span className="c-mono">{me?.llm.model ?? '…'}</span> (sunucuda çalışır, kredi harcar).</p>
        <label className="c-check"><input type="checkbox" name="byok-enabled" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} />Kendi API anahtarımı kullan (Pro/Takım, kredi harcamaz)</label>
        <div className="c-form-grid">
          <label className="c-field">Sağlayıcı
            <select name="byok-provider" value={s.provider} onChange={(e) => set({ provider: e.target.value })}>
              <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google Gemini</option>
              <option value="openrouter">OpenRouter</option><option value="custom">OpenAI uyumlu (özel URL)</option>
            </select>
          </label>
          <label className="c-field">Model<input className="c-mono" name="byok-model" value={s.model} onChange={(e) => set({ model: e.target.value })} /></label>
          <label className="c-field">API anahtarı<input type="password" name="byok-key" className="c-mono" value={s.api_key} onChange={(e) => set({ api_key: e.target.value })} placeholder="Yalnız bu tarayıcıda saklanır" autoComplete="off" /></label>
          {s.provider === 'custom' && <label className="c-field">Base URL<input className="c-mono" name="byok-base" value={s.base_url} onChange={(e) => set({ base_url: e.target.value })} /></label>}
        </div>
        <div className="c-actions">
          <button type="button" className="c-btn primary" onClick={() => { saveByok(s); toast('Ayarlar kaydedildi'); }}>Kaydet</button>
        </div>
      </section>
    </div>
  );
}
