/* Hafif hesap sayfaları (Görevler, Projeler, Dosyalar, Plan, Takım, Ayarlar): tek parça halinde, ilk ziyarette yüklenir. */
import { useCallback, useEffect, useState } from 'react';
import { Box, Check, FolderKanban, LogOut, MessagesSquare, Search, SquarePen, Trash2 } from 'lucide-react';
import { api, auth, loadByok, saveByok, type AuditRow, type ByokSettings, type FileRow, type Me, type Plan, type Project, type Task, type Team } from './api';
import { Avatar, Empty, PLAN_LABEL, PageHeader, displayName } from './ui';

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const NewTask = () => <a className="c-btn primary" href="#/"><SquarePen aria-hidden="true" />Yeni görev</a>;

export function TaskList({ tasks, projects, onChanged }: { tasks: Task[]; projects: Project[]; onChanged: () => void }) {
  const [q, setQ] = useState('');
  const n = q.trim().toLocaleLowerCase('tr-TR');
  const shown = tasks.filter((t) => t.title.toLocaleLowerCase('tr-TR').includes(n));
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.name;
  return (
    <div className="c-page">
      <PageHeader title="Görevler" actions={tasks.length > 0 ? <NewTask /> : undefined} />
      {!tasks.length ? (
        <div className="c-card"><Empty icon={<MessagesSquare />} text="Henüz görev yok." action={<NewTask />} /></div>
      ) : (
        <>
          <label className="c-search">
            <Search aria-hidden="true" />
            <input type="search" name="task-search" aria-label="Görevlerde ara" placeholder="Görevlerde ara" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="c-card flush">
            <ul className="c-rows">
              {shown.map((t) => (
                <li key={t.id} className="c-row">
                  <span className="c-row-main">
                    <a className="c-row-title" href={`#/t/${t.id}`}>{t.title}</a>
                    <span className="c-row-sub">{pname(t.project_id) ? `${pname(t.project_id)} · ` : ''}{when(t.updated_at)}</span>
                  </span>
                  {t.mine === false && <span className="c-pill">Ortak</span>}
                  {t.mine !== false && <>
                    <select name={`project-${t.id}`} value={t.project_id ?? ''} aria-label={`${t.title}: proje`}
                      onChange={async (e) => { await api(`/v1/tasks/${t.id}`, { method: 'PATCH', json: { project_id: e.target.value || null } }); onChanged(); }}>
                      <option value="">Projesiz</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.team_id ? ' (ortak)' : ''}</option>)}
                    </select>
                    <button type="button" className="c-icon-btn danger" title="Sil" aria-label={`${t.title} görevini sil`}
                      onClick={async () => { if (confirm(`"${t.title}" silinsin mi?`)) { await api(`/v1/tasks/${t.id}`, { method: 'DELETE' }); onChanged(); } }}><Trash2 /></button>
                  </>}
                </li>
              ))}
              {!shown.length && <li className="c-row-empty">"{q}" ile eşleşen görev yok.</li>}
            </ul>
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
      {!projects.length && <div className="c-card"><Empty icon={<FolderKanban />} text="Henüz proje yok. Yukarıdan ilk projeni oluştur." /></div>}
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
        <div className="c-card"><Empty icon={<Box />} text="Henüz model yok." action={<NewTask />} /></div>
      ) : (
        <div className="c-card flush c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Model</th><th>Görev</th><th>Tarih</th><th>İndir</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.message_id}>
                <td>{r.title}</td>
                <td><a href={`#/t/${r.task_id}`}>{r.task_title}</a></td>
                <td className="c-nowrap">{when(r.created_at)}</td>
                <td><span className="c-dl">{Object.entries(r.files).map(([f, u]) => <a key={f} className="c-chip" href={u} download={`${r.title}.${f}`}>{f.toUpperCase()}</a>)}</span></td>
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
  const [msg, setMsg] = useState<string | null>(query.get('ok') ? 'Ödeme alındı, planın birkaç saniye içinde güncellenir.' : null);
  useEffect(() => { api<Plan[]>('/v1/plans', { anon: true }).then(setPlans).catch(() => undefined); }, []);
  // Tek birincil eylem: mevcut plandan sonraki ilk ücretli plan.
  const cur = plans.findIndex((p) => p.id === me?.plan);
  const upgrade = plans.find((p, i) => p.id !== 'free' && i > cur)?.id;
  const buy = async (plan: string) => {
    try { const r = await api<{ url: string }>('/v1/billing/checkout', { method: 'POST', json: { plan } }); window.location.href = r.url; }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="c-page">
      <PageHeader title="Plan ve kredi" desc="Her model üretimi ya da düzeltme turu 1 kredi harcar; parametre kaydırıcılarıyla yeniden kurma ücretsizdir." />
      {msg && <div className="c-note" role="status">{msg}</div>}
      {me && (
        <section className="c-card c-summary" aria-label="Mevcut durum">
          <div className="c-stat"><small>Plan</small><b>{plans.find((p) => p.id === me.plan)?.name ?? PLAN_LABEL[me.plan]}</b></div>
          <div className="c-stat"><small>Kalan kredi</small><b className="c-mono">{me.credits}</b></div>
          <div className="c-stat"><small>Yenilenme</small><b>{me.credits_period === 'day' ? 'Günlük' : 'Aylık'}</b></div>
        </section>
      )}
      <div className="c-plans">
        {plans.map((p) => (
          <section key={p.id} className={`c-card c-plan${me?.plan === p.id ? ' current' : ''}`} aria-label={p.name}>
            <h2>{p.name}</h2>
            <div className="c-price">${p.price_usd}<small> / {p.period}</small></div>
            <ul className="c-features">{p.features.map((f) => <li key={f}><Check aria-hidden="true" />{f}</li>)}</ul>
            {me?.plan === p.id ? <span className="c-pill beta">Mevcut plan</span>
              : p.id !== 'free' && (
                <button type="button" className={`c-btn${p.id === upgrade ? ' primary' : ''}`} onClick={() => buy(p.id)}>{p.name} planına geç</button>
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
  return (
    <div className="c-page">
      <PageHeader title={<>{team.name} <span className="c-pill">{owner ? 'Sahip' : 'Üye'}</span></>} />
      {owner && (
        <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (email.trim()) act(async () => { await api('/v1/team/invite', { method: 'POST', json: { email } }); setEmail(''); }); }}>
          <input type="email" name="invite-email" aria-label="Davet edilecek e-posta" placeholder="ekip.arkadasi@firma.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="c-btn primary" disabled={!email.trim()}>Davet et</button>
        </form>
      )}
      {msg && <div className="c-error" role="alert">{msg}</div>}
      <section className="c-section" aria-labelledby="team-members-h">
        <div className="c-section-head">
          <h2 id="team-members-h" className="c-h2">Üyeler · {team.members.length}</h2>
          {!owner && <button type="button" className="c-btn sm" onClick={() => confirm('Takımdan ayrılmak istiyor musun?') && act(() => api('/v1/team/leave', { method: 'POST' }))}><LogOut aria-hidden="true" />Takımdan ayrıl</button>}
        </div>
        <div className="c-card flush">
          <ul className="c-rows">
            {team.members.map((m) => (
              <li key={m.user_id} className="c-row">
                <span className="c-row-main">
                  <span className="c-row-title">{m.name || m.email}</span>
                  <span className="c-row-sub">{m.role === 'owner' ? 'Sahip' : 'Üye'} · {new Date(m.joined_at).toLocaleDateString('tr-TR')}</span>
                </span>
                {owner && m.role !== 'owner' && (
                  <button type="button" className="c-icon-btn danger" title="Takımdan çıkar" aria-label={`${m.email} üyesini çıkar`}
                    onClick={() => confirm(`${m.email} çıkarılsın mı?`) && act(() => api(`/v1/team/members/${m.user_id}`, { method: 'DELETE' }))}><Trash2 /></button>
                )}
              </li>
            ))}
            {team.invites.map((i) => (
              <li key={i.email} className="c-row">
                <span className="c-row-main">
                  <span className="c-row-title">{i.email}</span>
                  <span className="c-row-sub">Davet bekliyor</span>
                </span>
                {owner && (
                  <button type="button" className="c-icon-btn danger" title="Daveti iptal et" aria-label={`${i.email} davetini iptal et`}
                    onClick={() => act(() => api(`/v1/team/invites/${encodeURIComponent(i.email)}`, { method: 'DELETE' }))}><Trash2 /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
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

export function Settings({ me }: { me: Me | null }) {
  const [s, setS] = useState<ByokSettings>(loadByok);
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<ByokSettings>) => { setS({ ...s, ...p }); setSaved(false); };
  return (
    <div className="c-page narrow">
      <PageHeader title="Ayarlar" />
      <section className="c-card" aria-labelledby="set-model-h">
        <h2 id="set-model-h">Model</h2>
        <p>Varsayılan: <span className="c-mono">{me?.llm.model ?? '…'}</span> (sunucuda çalışır, kredi harcar).</p>
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
        <div className="c-inline">
          <button type="button" className="c-btn primary" onClick={() => { saveByok(s); setSaved(true); }}>Kaydet</button>
          {saved && <span className="c-fine" role="status">Kaydedildi</span>}
        </div>
      </section>
      <section className="c-card" aria-labelledby="set-account-h">
        <h2 id="set-account-h">Hesap</h2>
        <div className="c-profile">
          <Avatar me={me} large />
          <div>
            <b>{displayName(me)}</b>
            <p className="c-muted">{me?.email}</p>
            <p className="c-fine">Giriş yöntemi: {me?.provider === 'google' ? 'Google' : me?.provider === 'email' ? 'E-posta' : me?.provider ?? '–'} · Plan: {me ? PLAN_LABEL[me.plan] : '–'}</p>
          </div>
        </div>
        <p className="c-fine">Görevlerin, modellerin ve dosyaların AICADBridge sunucusunda hesabına bağlı saklanır; başka kullanıcılar göremez.</p>
        <div><button type="button" className="c-btn" onClick={() => { void auth!.signOut(); }}><LogOut aria-hidden="true" />Çıkış yap</button></div>
      </section>
    </div>
  );
}
